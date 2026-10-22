import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import { IPC } from '@shared/ipc'
import type { McpContext, SshForward, SshHost, TerminalDock } from '@shared/types'
import { parseForwards } from '@shared/ssh-forward'
import { getPtyBuffer, getPtyProcess, writePty, killPty } from './pty-manager'
import { sshRunningUnder, sshState, type SshState } from './process-tree'
import { addForward, describeTunnel, isListening, removeForward, tunnelState } from './ssh-tunnels'
import { getConfig, setConfig } from './config-store'
import { readSshConfigForwards, readSshConfigHosts } from './ssh-config'
import { hostKeyOf } from './sftp-manager'
import { createWindow } from '../window'
import { logInfo, logError } from './logger'
import { stripAnsi, tailLines } from './strip-ansi'
import { makeTag, shellKindOf, wrapCommand, scanForExit } from '@shared/terminal-exit'
import { keySequence, tidy } from '@shared/mcp-text'

/**
 * Serveur MCP local (agents IA — Claude Code, etc.) : expose le contexte de la
 * session GVue (fenêtres, onglets, sélection, dépôt Git, terminaux et leurs
 * logs) et des actions (naviguer, terminaux, disposition, espaces de travail).
 *
 * Sécurité : OPT-IN (Paramètres → Général), écoute UNIQUEMENT sur 127.0.0.1,
 * port aléatoire, et chaque requête doit porter le jeton (généré au démarrage)
 * via l'en-tête `x-gvue-token`. Le couple port+jeton est écrit dans
 * `userData/mcp-endpoint.json`, lisible seulement par l'utilisateur local —
 * c'est ce fichier que lit le pont stdio `gvue-mcp.cjs`.
 *
 * PLUSIEURS FENÊTRES : chaque fenêtre pousse son propre instantané. Avant, un
 * cache unique gardait celui de la dernière fenêtre qui avait parlé : le MCP
 * ne « voyait » qu'une fenêtre, et ses terminaux disparaissaient de la liste
 * dès qu'une autre fenêtre s'ouvrait.
 */

let server: Server | null = null
let runSeq = 0
let token = ''
let port = 0

/* --------------------------- Contextes par fenêtre -------------------------- */

const EMPTY: McpContext = { panes: [], repo: null, terminals: [] }
const contexts = new Map<number, McpContext>()
const hooked = new Set<number>()
let lastFocusedId: number | null = null

type Term = McpContext['terminals'][number] & { windowId: number }

export function setMcpContext(win: BrowserWindow, ctx: McpContext): void {
  contexts.set(win.id, ctx)
  if (!hooked.has(win.id)) {
    hooked.add(win.id)
    const id = win.id
    win.once('closed', () => {
      contexts.delete(id)
      hooked.delete(id)
      if (lastFocusedId === id) lastFocusedId = null
    })
  }
}

/** Mémorise la dernière fenêtre utilisée (cible par défaut des actions). */
export function noteWindowFocus(win: BrowserWindow): void {
  lastFocusedId = win.id
}

function liveWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())
}

/**
 * Fenêtre visée : `windowId` si fourni, sinon la fenêtre qui a le focus, sinon
 * la dernière utilisée, sinon une fenêtre visible, sinon une fenêtre cachée
 * (plateau). On n'en CRÉE une que s'il n'en existe vraiment aucune — avant,
 * fermer la fenêtre faisait surgir une fenêtre neuve au premier appel.
 */
function pickWindow(args: Record<string, unknown>, create: boolean): BrowserWindow | null {
  if (args.windowId !== undefined && args.windowId !== null && args.windowId !== '') {
    const w = BrowserWindow.fromId(Number(args.windowId))
    if (!w || w.isDestroyed())
      throw new Error(`Fenêtre ${String(args.windowId)} introuvable (voir get_context → windows).`)
    return w
  }
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && !focused.isDestroyed()) return focused
  const last = lastFocusedId !== null ? BrowserWindow.fromId(lastFocusedId) : null
  if (last && !last.isDestroyed()) return last
  const all = liveWindows()
  const found = all.find((w) => w.isVisible()) ?? all[0]
  if (found) return found
  return create ? createWindow() : null
}

function targetWindow(args: Record<string, unknown>): BrowserWindow {
  return pickWindow(args, true) as BrowserWindow
}

/** Envoie une action à une fenêtre (réaffichée si cachée, sans voler le focus). */
function deliver(win: BrowserWindow, channel: string, payload: unknown): void {
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => win.webContents.send(channel, payload))
  } else {
    win.webContents.send(channel, payload)
  }
}

function ctxOf(win: BrowserWindow | null): McpContext {
  return (win && contexts.get(win.id)) || EMPTY
}

/** Tous les terminaux de toutes les fenêtres, chacun avec sa fenêtre. */
function allTerminals(): Term[] {
  const out: Term[] = []
  for (const [windowId, ctx] of contexts) {
    const w = BrowserWindow.fromId(windowId)
    if (!w || w.isDestroyed()) continue
    for (const t of ctx.terminals) out.push({ ...t, windowId })
  }
  return out
}

/**
 * Terminal visé par un outil : par ptyId, sinon par titre approché, sinon par
 * serveur SSH, sinon le dernier ouvert dans la fenêtre active. Les sessions
 * terminées ne sont choisies par défaut que s'il n'y a rien de vivant.
 */
function findTerminal(args: Record<string, unknown>): Term | null {
  const terms = allTerminals()
  const id = typeof args.ptyId === 'string' ? args.ptyId : ''
  const title = typeof args.title === 'string' ? args.title.toLowerCase() : ''
  const srv = typeof args.server === 'string' ? args.server.toLowerCase() : ''
  if (id) return terms.find((t) => t.ptyId === id) ?? null
  if (title) return terms.find((t) => t.title.toLowerCase().includes(title)) ?? null
  if (srv) return terms.find((t) => (t.sshHost ?? '').toLowerCase().includes(srv)) ?? null
  const win = pickWindow(args, false)
  const mine = win ? terms.filter((t) => t.windowId === win.id) : []
  for (const pool of [mine.filter((t) => !t.exited), terms.filter((t) => !t.exited), mine, terms]) {
    if (pool.length) return pool[pool.length - 1]
  }
  return null
}

type LiveTerm = Term & { sshState: SshState | null }

/**
 * Ajoute l'état RÉEL des sessions SSH (null pour un terminal local). Le shell
 * qui a lancé `ssh` survit à la coupure : seul un processus ssh encore présent
 * sous lui prouve que la session est ouverte.
 */
async function withSshState(terms: Term[]): Promise<LiveTerm[]> {
  const procs = new Map(
    terms.filter((t) => t.sshHost && !t.exited).map((t) => [t.ptyId, getPtyProcess(t.ptyId)] as const)
  )
  const pids = [...procs.values()].flatMap((p) => (p ? [p.pid] : []))
  const running = await sshRunningUnder(pids)
  return terms.map((t) => {
    if (!t.sshHost) return { ...t, sshState: null }
    const p = procs.get(t.ptyId)
    if (t.exited || !p) return { ...t, sshState: 'disconnected' }
    const alive = running ? (running.get(p.pid) ?? false) : null
    return { ...t, sshState: sshState(alive, Date.now() - p.startedAt) }
  })
}

const SSH_USABLE: ReadonlyArray<SshState | null> = ['connected', 'connecting', 'unknown']

/**
 * Comme findTerminal, mais une recherche par SERVEUR préfère une session
 * réellement connectée à un vieil onglet dont la connexion est tombée.
 */
async function resolveTerminal(args: Record<string, unknown>): Promise<LiveTerm | null> {
  const srv = typeof args.server === 'string' ? args.server.toLowerCase() : ''
  if (srv && !args.ptyId && !args.title) {
    const matches = await withSshState(
      allTerminals().filter((t) => !t.exited && (t.sshHost ?? '').toLowerCase().includes(srv))
    )
    const pick = matches.find((t) => t.sshState === 'connected') ?? matches.find((t) => SSH_USABLE.includes(t.sshState))
    if (pick || matches.length) return pick ?? matches[matches.length - 1]
  }
  const term = findTerminal(args)
  return term ? (await withSshState([term]))[0] : null
}

/** Attend un terminal ABSENT de `before` qui satisfait `pred` (création côté interface). */
async function waitNewTerminal(
  before: Set<string>,
  pred: (t: Term) => boolean,
  timeoutMs: number
): Promise<Term | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = allTerminals().find((t) => !before.has(t.ptyId) && !t.exited && pred(t))
    if (found) return found
    await new Promise((r) => setTimeout(r, 150))
  }
  return null
}

const norm = (p: string): string => p.replace(/[\\/]+$/, '').replace(/\//g, '\\').toLowerCase()

/** Laisse l'interface peindre (deux images) : un thème appliqué, puis capturé. */
async function waitRender(win: BrowserWindow): Promise<void> {
  try {
    await win.webContents.executeJavaScript(
      'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))',
      true
    )
  } catch {
    /* fenêtre en cours de chargement : on se contente du délai */
  }
  await new Promise((r) => setTimeout(r, 60))
}

/* ------------------------- Lecture du texte affiché ------------------------- */

const pendingReads = new Map<number, (text: string | null) => void>()
let readSeq = 0

export function resolveTerminalRead(reqId: number, text: string | null): void {
  pendingReads.get(reqId)?.(text)
  pendingReads.delete(reqId)
}

/** Texte affiché par le terminal (xterm), ou null si l'interface ne répond pas. */
function readDisplayedText(win: BrowserWindow, ptyId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const reqId = ++readSeq
    const timer = setTimeout(() => {
      pendingReads.delete(reqId)
      resolve(null)
    }, 1500)
    pendingReads.set(reqId, (text) => {
      clearTimeout(timer)
      resolve(text)
    })
    win.webContents.send(IPC.mcpReadTerminal, { reqId, ptyId })
  })
}

/* --------------------------------- Serveurs -------------------------------- */

/** Serveur nommé (manuel d'abord, puis alias du ~/.ssh/config). */
async function findServer(args: Record<string, unknown>): Promise<SshHost> {
  const wanted = typeof args.name === 'string' ? args.name.trim().toLowerCase() : ''
  if (!wanted) throw new Error('Paramètre « name » requis (voir list_servers).')
  const manual = getConfig('sshHosts') ?? []
  const fromConfig = await readSshConfigHosts()
  const host =
    manual.find((h) => h.name.toLowerCase() === wanted) ?? fromConfig.find((h) => h.name.toLowerCase() === wanted)
  if (host) return host
  const known = [...manual.map((h) => h.name), ...fromConfig.map((h) => h.name)]
  throw new Error(
    `Serveur introuvable : ${String(args.name)}. Serveurs connus de GVue : ${known.join(', ') || '(aucun)'}. ` +
      "Ne lancez PAS « ssh » vous-même dans un terminal : sans clé publique, l'authentification " +
      "échouera et le mot de passe enregistré ne sera pas utilisé. Demandez plutôt à l'utilisateur " +
      "d'ajouter ce serveur dans GVue (gestionnaire de serveurs : hôte, port, utilisateur, mot de " +
      'passe), puis rappelez open_ssh.'
  )
}

/** Tunnels d'un serveur : ceux de GVue, sinon ceux de son bloc ~/.ssh/config. */
function tunnelsOf(
  host: SshHost,
  configForwards: Map<string, SshForward[]>
): { forward: SshForward; origin: 'gvue' | 'ssh_config' }[] {
  if (host.source === 'manual') return (host.forwards ?? []).map((forward) => ({ forward, origin: 'gvue' }))
  return (configForwards.get(host.name) ?? []).map((forward) => ({ forward, origin: 'ssh_config' }))
}

/**
 * Toute modification de la configuration demandée par un agent passe par
 * l'utilisateur : boîte de dialogue de GVue (fenêtre réaffichée), « Refuser »
 * par défaut.
 */
async function confirmByUser(win: BrowserWindow, question: string): Promise<boolean> {
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'GVue',
    message: question,
    detail: 'Demande d’un agent IA (serveur MCP de GVue). Rien n’est modifié sans votre accord.',
    buttons: ['Autoriser', 'Refuser'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  })
  return response === 0
}

/* ------------------------------- Outils MCP ------------------------------ */

type ToolResult = unknown

function windowsSummary(active: BrowserWindow | null): unknown[] {
  return liveWindows().map((w) => {
    const ctx = ctxOf(w)
    return {
      windowId: w.id,
      title: w.getTitle(),
      active: active?.id === w.id,
      focused: w.isFocused(),
      visible: w.isVisible(),
      maximized: w.isMaximized(),
      workspace: ctx.ui?.workspace ?? null,
      panes: ctx.panes,
      repo: ctx.repo,
      terminals: ctx.terminals.map((t) => t.ptyId)
    }
  })
}

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'get_context': {
      const win = pickWindow(args, false)
      const ctx = ctxOf(win)
      return {
        version: app.getVersion(),
        activeWindowId: win?.id ?? null,
        windows: windowsSummary(win),
        // Colonnes et dépôt de la fenêtre active (compatibilité) ; les autres
        // fenêtres sont détaillées dans `windows`.
        panes: ctx.panes,
        repo: ctx.repo,
        terminals: (await withSshState(allTerminals())).map((t) => ({ ...t, hasOutput: !!getPtyBuffer(t.ptyId) }))
      }
    }

    case 'list_terminals':
      return withSshState(allTerminals())

    case 'get_terminal_output': {
      const lines = Math.min(2000, Math.max(1, Number(args.tailLines) || 200))
      const term = findTerminal(args)
      if (!term) throw new Error('Aucun terminal ouvert dans GVue.')
      // Le texte AFFICHÉ (écran + défilement) d'abord ; le flux brut en secours.
      const win = BrowserWindow.fromId(term.windowId)
      const shown = win && !win.isDestroyed() ? await readDisplayedText(win, term.ptyId) : null
      const text = shown ?? stripAnsi(getPtyBuffer(term.ptyId))
      return {
        ptyId: term.ptyId,
        windowId: term.windowId,
        title: term.title,
        cwd: term.cwd,
        exited: term.exited,
        source: shown !== null ? 'screen' : 'stream',
        output: tailLines(tidy(text), lines)
      }
    }

    /**
     * Écrit dans un terminal DÉJÀ ouvert, puis rend la sortie produite.
     * Sur une session SSH ouverte par GVue, la connexion (et son mot de passe
     * enregistré) est déjà établie — rien n'est redemandé à l'utilisateur.
     */
    case 'run_in_terminal': {
      const command = typeof args.command === 'string' ? args.command : ''
      const submit = args.submit !== false
      // Sans validation, un caractère de contrôle seul (\u0003…) est légitime :
      // ne refuser que le VIDE, pas le « blanc ».
      if (submit ? !command.trim() : command.length === 0)
        throw new Error('Paramètre « command » requis.')
      const term = await resolveTerminal(args)
      if (!term) throw new Error('Aucun terminal ouvert dans GVue (voir list_terminals).')
      if (term.exited) {
        throw new Error(
          `Le terminal « ${term.title} » est terminé : rouvrez-en un (open_terminal) ou visez-en un autre.`
        )
      }
      // Connexion tombée : le shell LOCAL a repris la main. Y envoyer une
      // commande destinée au serveur l'exécuterait sur ce poste.
      if (term.sshState === 'disconnected') {
        throw new Error(
          `La connexion SSH du terminal « ${term.title} » (${term.sshHost}) est FERMÉE : le shell local ` +
            'a repris la main, rien n’a été exécuté. Rouvrez la session avec open_ssh (même nom de serveur).'
        )
      }
      const before = getPtyBuffer(term.ptyId).length
      const timeoutMs = Math.min(300_000, Math.max(500, Number(args.timeoutMs || args.waitMs) || 20_000))

      if (!submit) {
        writePty(term.ptyId, command)
        await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 1500)))
        return {
          ptyId: term.ptyId,
          windowId: term.windowId,
          title: term.title,
          finished: false,
          exitCode: null,
          output: tailLines(tidy(stripAnsi(getPtyBuffer(term.ptyId).slice(before))), 400)
        }
      }

      // Écho balisé portant le code de sortie : on attend CETTE balise.
      const tag = makeTag(++runSeq)
      const kind = shellKindOf(term.shellId, Boolean(term.sshHost))
      writePty(term.ptyId, `${wrapCommand(command, tag, kind)}\r`)

      const deadline = Date.now() + timeoutMs
      const read = (): ReturnType<typeof scanForExit> =>
        scanForExit(stripAnsi(getPtyBuffer(term.ptyId).slice(before)), tag)
      let scan = read()
      while (!scan.done && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 150))
        scan = read()
      }

      return {
        ptyId: term.ptyId,
        windowId: term.windowId,
        title: term.title,
        sshHost: term.sshHost ?? null,
        sshState: term.sshState,
        finished: scan.done,
        exitCode: scan.code,
        output: tailLines(tidy(scan.output), 400),
        note: scan.done
          ? scan.code === 0
            ? 'Commande terminée avec succès (code 0).'
            : `Commande terminée en ÉCHEC (code ${scan.code}).`
          : 'Toujours en cours après le délai imparti — un serveur qui tourne, par ' +
            'exemple. Le processus continue : relisez avec get_terminal_output, ou ' +
            'arrêtez-le avec send_keys { keys: "ctrl+c" }.'
      }
    }

    case 'send_keys': {
      const keys = typeof args.keys === 'string' ? args.keys : ''
      const seq = keySequence(keys)
      const term = findTerminal(args)
      if (!term) throw new Error('Aucun terminal ouvert dans GVue (voir list_terminals).')
      if (term.exited) throw new Error(`Le terminal « ${term.title} » est terminé.`)
      const before = getPtyBuffer(term.ptyId).length
      writePty(term.ptyId, seq)
      await new Promise((r) => setTimeout(r, 600))
      return {
        ok: true,
        ptyId: term.ptyId,
        windowId: term.windowId,
        sent: keys,
        output: tailLines(tidy(stripAnsi(getPtyBuffer(term.ptyId).slice(before))), 100)
      }
    }

    case 'close_terminal': {
      const term = findTerminal(args)
      if (!term) throw new Error('Terminal introuvable (voir list_terminals).')
      const win = BrowserWindow.fromId(term.windowId)
      if (win && !win.isDestroyed()) deliver(win, IPC.mcpCloseTerminal, term.ptyId)
      else killPty(term.ptyId)
      return { ok: true, closed: term.ptyId, title: term.title }
    }

    case 'navigate': {
      const p = typeof args.path === 'string' ? args.path.trim() : ''
      if (!p) throw new Error('Paramètre « path » requis.')
      const win = targetWindow(args)
      deliver(win, IPC.trayOpenPath, p)
      return { ok: true, opened: p, windowId: win.id }
    }

    case 'list_launch_tasks': {
      const tasks = getConfig('runnerTasks')
      return tasks.map((t) => ({
        id: t.id,
        name: t.name,
        command: t.command,
        cwd: t.cwd,
        project: t.project ?? null,
        category: t.category ?? null
      }))
    }

    case 'run_launch_task': {
      const tasks = getConfig('runnerTasks')
      const id = typeof args.id === 'string' ? args.id : ''
      const nm = typeof args.name === 'string' ? args.name.toLowerCase() : ''
      const task =
        tasks.find((t) => t.id === id) ?? (nm ? tasks.find((t) => t.name.toLowerCase() === nm) : undefined)
      if (!task) throw new Error('Lancement introuvable (id ou name requis — voir list_launch_tasks).')
      const win = targetWindow(args)
      deliver(win, IPC.trayRunTask, task.id)
      return { ok: true, started: task.name, windowId: win.id }
    }

    case 'get_ui_state': {
      const win = pickWindow(args, false)
      const ui = ctxOf(win).ui
      if (!win || !ui) throw new Error('État UI indisponible (fenêtre pas encore prête).')
      return { windowId: win.id, maximized: win.isMaximized(), fullscreen: win.isFullScreen(), ...ui }
    }

    case 'screenshot': {
      const win = pickWindow(args, false)
      if (!win) throw new Error('Aucune fenêtre GVue ouverte.')
      // Attendre le rendu en cours : capturer juste après set_theme montrait
      // encore l'ancien thème.
      await waitRender(win)
      const img = await win.webContents.capturePage()
      const file = join(app.getPath('temp'), `gvue-screenshot-${Date.now()}.png`)
      writeFileSync(file, img.toPNG())
      const { width, height } = img.getSize()
      return { path: file, width, height, windowId: win.id }
    }

    case 'open_terminal': {
      const cwd = typeof args.cwd === 'string' ? args.cwd.trim() : ''
      const command = typeof args.command === 'string' ? args.command.trim() : ''
      const title = typeof args.title === 'string' ? args.title.trim() : ''
      if (!cwd) throw new Error('Paramètre « cwd » requis (dossier de travail).')
      const win = targetWindow(args)

      // Un terminal local déjà ouvert dans ce dossier ? On le réutilise plutôt
      // que d'empiler des onglets : l'utilisateur préfère qu'on travaille dans
      // SES terminaux.
      if (!command && args.newTerminal !== true) {
        const same = allTerminals().find(
          (t) => t.windowId === win.id && !t.exited && !t.sshHost && norm(t.cwd) === norm(cwd)
        )
        if (same) {
          if (title && title !== same.title) deliver(win, IPC.mcpRenameTerminal, { ptyId: same.ptyId, title })
          if (args.split === true) deliver(win, IPC.mcpSetUi, { panel: 'terminal', open: true, split: true })
          return {
            ok: true,
            ptyId: same.ptyId,
            windowId: win.id,
            reused: true,
            note: 'Un terminal était déjà ouvert dans ce dossier : réutilisé (newTerminal: true pour en forcer un autre).'
          }
        }
      }

      const before = new Set(allTerminals().map((t) => t.ptyId))
      deliver(win, IPC.mcpOpenTerminal, { cwd, command, title, split: args.split === true })
      const created = await waitNewTerminal(before, (t) => t.windowId === win.id, 6000)
      return {
        ok: true,
        ptyId: created?.ptyId ?? null,
        windowId: win.id,
        reused: false,
        note: created
          ? command
            ? 'Terminal ouvert, commande lancée sous les yeux de l’utilisateur (le processus survit à la session de l’agent).'
            : 'Terminal ouvert.'
          : 'Terminal demandé, mais son identifiant n’est pas encore visible — appelez list_terminals.'
      }
    }

    case 'reveal': {
      const p = typeof args.path === 'string' ? args.path.trim() : ''
      if (!p) throw new Error('Paramètre « path » requis.')
      const win = targetWindow(args)
      const ui = ctxOf(win).ui
      // Un fichier « point » (.gitignore, .env…) n'est pas visible quand les
      // fichiers cachés sont masqués : sélectionné mais invisible. On les
      // affiche (comme le fait l'Explorateur Windows pour « Ouvrir l'emplacement »).
      const dotfile = basename(p).startsWith('.')
      const mustShow = dotfile && ui?.showHidden === false && args.showHidden !== false
      if (mustShow) deliver(win, IPC.mcpSetUi, { panel: 'hiddenFiles', open: true })
      deliver(win, IPC.mcpReveal, p)
      return {
        ok: true,
        revealed: p,
        windowId: win.id,
        hidden: dotfile,
        hiddenFilesShown: mustShow,
        ...(mustShow
          ? { note: 'Fichier caché : l’affichage des fichiers cachés a été activé pour le montrer.' }
          : {})
      }
    }

    case 'notify': {
      const message = typeof args.message === 'string' ? args.message.trim() : ''
      if (!message) throw new Error('Paramètre « message » requis.')
      const win = targetWindow(args)
      deliver(win, IPC.mcpNotify, message)
      return { ok: true, windowId: win.id }
    }

    case 'set_ui': {
      const panels = [
        'git',
        'terminal',
        'preview',
        'settings',
        'recycleBin',
        'servers',
        'tidyRules',
        'shortcuts',
        'palette',
        'hiddenFiles'
      ]
      const panel = typeof args.panel === 'string' ? args.panel : ''
      if (!panels.includes(panel))
        throw new Error(`Paramètre « panel » requis — au choix : ${panels.join(', ')}.`)
      const open = args.open === undefined ? true : Boolean(args.open)
      const req: Record<string, unknown> = { panel, open }
      if (panel === 'terminal') {
        if (args.maximized !== undefined) req.maximized = Boolean(args.maximized)
        if (args.split !== undefined) req.split = Boolean(args.split)
        const dock = typeof args.dock === 'string' ? args.dock : ''
        if (dock) {
          if (!['bottom', 'right', 'left'].includes(dock))
            throw new Error('« dock » : bottom, right ou left.')
          req.dock = dock as TerminalDock
        }
      }
      const win = targetWindow(args)
      deliver(win, IPC.mcpSetUi, req)
      await waitRender(win)
      return { ok: true, windowId: win.id, ...req }
    }

    case 'set_theme': {
      const theme = typeof args.theme === 'string' ? args.theme.trim() : ''
      if (!theme) throw new Error('Paramètre « theme » requis (auto, light, dark ou id de palette).')
      const win = targetWindow(args)
      deliver(win, IPC.mcpSetTheme, theme)
      // Ne rendre la main qu'une fois le nouveau thème PEINT (capture fiable).
      await new Promise((r) => setTimeout(r, 120))
      await waitRender(win)
      return { ok: true, theme, windowId: win.id }
    }

    case 'resize_window': {
      const width = Number(args.width)
      const height = Number(args.height)
      if (!Number.isFinite(width) || !Number.isFinite(height))
        throw new Error('Paramètres « width » et « height » requis (pixels).')
      const win = targetWindow(args)
      if (win.isFullScreen()) win.setFullScreen(false)
      if (win.isMaximized()) win.unmaximize()
      win.setSize(Math.max(640, Math.round(width)), Math.max(480, Math.round(height)))
      win.center()
      const [w, h] = win.getSize()
      return { ok: true, width: w, height: h, windowId: win.id }
    }

    case 'set_window': {
      const state = typeof args.state === 'string' ? args.state : ''
      const win = targetWindow(args)
      switch (state) {
        case 'maximized':
          if (win.isFullScreen()) win.setFullScreen(false)
          if (!win.isVisible()) win.show()
          win.maximize()
          break
        case 'fullscreen':
          if (!win.isVisible()) win.show()
          win.setFullScreen(true)
          break
        case 'normal':
          if (win.isFullScreen()) win.setFullScreen(false)
          if (win.isMaximized()) win.unmaximize()
          if (win.isMinimized()) win.restore()
          if (!win.isVisible()) win.show()
          break
        case 'minimized':
          win.minimize()
          break
        case 'focus':
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
          break
        default:
          throw new Error('« state » : maximized, fullscreen, normal, minimized ou focus.')
      }
      return { ok: true, windowId: win.id, state }
    }

    case 'list_workspaces': {
      const ws = getConfig('workspaces') ?? {}
      return {
        workspaces: Object.entries(ws).map(([n, d]) => ({
          name: n,
          panes: d.panes?.map((p) => p.path) ?? [],
          terminals: d.terminals?.length ?? 0,
          terminalDock: d.terminalDock ?? 'bottom',
          theme: d.appearance?.themeId || d.appearance?.theme || null
        })),
        loaded: liveWindows().map((w) => ({ windowId: w.id, workspace: ctxOf(w).ui?.workspace ?? null }))
      }
    }

    case 'load_workspace': {
      const wanted = typeof args.name === 'string' ? args.name.trim() : ''
      if (!wanted) throw new Error('Paramètre « name » requis (voir list_workspaces).')
      const ws = getConfig('workspaces') ?? {}
      const key = Object.keys(ws).find((k) => k.toLowerCase() === wanted.toLowerCase())
      if (!key) throw new Error(`Espace de travail introuvable : ${wanted}. Disponibles : ${Object.keys(ws).join(', ') || '(aucun)'}.`)
      const win = targetWindow(args)
      deliver(win, IPC.trayLoadWorkspace, key)
      await new Promise((r) => setTimeout(r, 400))
      return { ok: true, workspace: key, windowId: win.id }
    }

    case 'save_workspace': {
      const nm = typeof args.name === 'string' ? args.name.trim() : ''
      if (!nm) throw new Error('Paramètre « name » requis.')
      const win = targetWindow(args)
      deliver(win, IPC.mcpSaveWorkspace, nm)
      return { ok: true, workspace: nm, windowId: win.id }
    }

    case 'list_presets': {
      const ap = getConfig('appearance') as { presets?: Record<string, Record<string, unknown>> } | undefined
      const presets = ap?.presets ?? {}
      return {
        presets: Object.entries(presets).map(([n, p]) => ({
          name: n,
          theme: (p.themeId as string) || (p.theme as string) || null,
          accent: (p.accent as string) ?? null
        }))
      }
    }

    case 'apply_preset': {
      const nm = typeof args.name === 'string' ? args.name.trim() : ''
      if (!nm) throw new Error('Paramètre « name » requis (voir list_presets).')
      const ap = getConfig('appearance') as { presets?: Record<string, unknown> } | undefined
      const key = Object.keys(ap?.presets ?? {}).find((k) => k.toLowerCase() === nm.toLowerCase())
      if (!key) throw new Error(`Préréglage introuvable : ${nm}.`)
      const win = targetWindow(args)
      deliver(win, IPC.mcpApplyPreset, key)
      await new Promise((r) => setTimeout(r, 120))
      await waitRender(win)
      return { ok: true, preset: key, windowId: win.id }
    }

    case 'list_servers': {
      const manual = getConfig('sshHosts') ?? []
      const fromConfig = (await readSshConfigHosts()).filter((h) => !manual.some((m) => m.name === h.name))
      const configForwards = await readSshConfigForwards()
      const terms = await withSshState(allTerminals().filter((t) => t.sshHost && !t.exited))
      const servers = await Promise.all(
        [...manual, ...fromConfig].map(async (h) => {
          const sessions = terms
            .filter((t) => t.sshHost === hostKeyOf(h))
            .map((t) => ({ ptyId: t.ptyId, windowId: t.windowId, title: t.title, sshState: t.sshState }))
          const connected = sessions.some((s) => s.sshState === 'connected')
          return {
            name: h.name,
            source: h.source,
            target: `${h.user ? `${h.user}@` : ''}${h.hostName ?? h.name}${h.port ? `:${h.port}` : ''}`,
            connected,
            sessions,
            tunnels: await Promise.all(
              tunnelsOf(h, configForwards).map(async ({ forward, origin }) => {
                const listening = await isListening(forward)
                return {
                  type: forward.type,
                  ...describeTunnel(forward),
                  origin,
                  listening,
                  state: tunnelState(forward, { listening, sessionConnected: connected })
                }
              })
            )
          }
        })
      )
      return { servers }
    }

    case 'add_tunnel':
    case 'remove_tunnel': {
      const host = await findServer(args)
      if (host.source === 'config' && !(getConfig('sshHosts') ?? []).some((m) => m.name === host.name)) {
        throw new Error(
          `« ${host.name} » est défini dans ~/.ssh/config, que GVue ne modifie jamais. Pour un ` +
            'tunnel ponctuel, utilisez open_tunnel { spec } (rien n’est enregistré) ; pour un tunnel ' +
            'permanent, l’utilisateur peut ajouter une ligne LocalForward à ce fichier.'
        )
      }
      const manual = getConfig('sshHosts') ?? []
      const win = targetWindow(args)
      let next: typeof manual
      let question: string
      let summary: ReturnType<typeof describeTunnel>
      if (name === 'add_tunnel') {
        const r = addForward(manual, host.name, typeof args.spec === 'string' ? args.spec : '')
        next = r.hosts
        summary = describeTunnel(r.forward)
        question = `Ajouter le tunnel ${summary.flag} ${summary.spec} au serveur « ${host.name} » ?`
      } else {
        const type = typeof args.type === 'string' ? (args.type as SshForward['type']) : undefined
        const r = removeForward(manual, host.name, Number(args.listenPort), type)
        next = r.hosts
        summary = describeTunnel(r.removed)
        question = `Retirer le tunnel ${summary.flag} ${summary.spec} du serveur « ${host.name} » ?`
      }
      if (!(await confirmByUser(win, question))) {
        return { ok: false, refused: true, note: 'L’utilisateur a refusé : la configuration est inchangée.' }
      }
      setConfig('sshHosts', next)
      for (const w of liveWindows()) w.webContents.send(IPC.sshHostsChanged, next)
      return {
        ok: true,
        server: host.name,
        tunnel: summary,
        note:
          name === 'add_tunnel'
            ? 'Tunnel enregistré : il sera monté aux prochaines connexions. Pour l’activer tout de ' +
              `suite : open_tunnel { name: "${host.name}", listenPort: ${Number(summary.listen.split(':').pop())} }.`
            : 'Tunnel retiré de la configuration. Une session déjà ouverte le garde jusqu’à sa fermeture.'
      }
    }

    case 'open_tunnel': {
      const host = await findServer(args)
      const configForwards = await readSshConfigForwards()
      let forward: SshForward
      let origin: 'gvue' | 'ssh_config' | 'adhoc' = 'adhoc'
      if (typeof args.spec === 'string' && args.spec.trim()) {
        const parsed = parseForwards(args.spec)
        if (parsed.length !== 1) throw new Error(`Tunnel illisible : « ${args.spec} » (ex. « 14330:app.lan:1433 »).`)
        forward = parsed[0]
      } else {
        const port = Number(args.listenPort)
        const known = tunnelsOf(host, configForwards).find((t) => t.forward.listenPort === port)
        if (!known) {
          throw new Error(
            `Aucun tunnel sur le port ${String(args.listenPort)} pour ${host.name} (voir list_servers), ` +
              'ou passez un tunnel ponctuel : spec « portLocal:hôte:portDistant ».'
          )
        }
        forward = known.forward
        origin = known.origin
      }
      const desc = describeTunnel(forward)
      const key = hostKeyOf(host)
      const connected = (await withSshState(allTerminals().filter((t) => t.sshHost === key && !t.exited))).some(
        (t) => t.sshState === 'connected'
      )
      if (await isListening(forward)) {
        if (connected) return { ok: true, server: host.name, tunnel: desc, listening: true, state: 'active', reused: true }
        throw new Error(
          `Le port local ${forward.listenPort} est déjà occupé par un autre programme : choisissez un ` +
            'autre port local (spec).'
        )
      }

      // Session dédiée portant CE tunnel (un tunnel du ssh_config est déjà
      // appliqué par ssh lui-même : ne pas le doubler).
      const win = targetWindow(args)
      const before = new Set(allTerminals().map((t) => t.ptyId))
      deliver(win, IPC.trayOpenSsh, { ...host, forwards: origin === 'ssh_config' ? [] : [forward] })
      const created = await waitNewTerminal(before, (t) => t.sshHost === key, 8000)
      if (created) {
        deliver(win, IPC.mcpRenameTerminal, { ptyId: created.ptyId, title: `${host.name} · tunnel ${forward.listenPort}` })
      }
      // Actif = le port écoute ET le ssh de la session tourne, deux fois de
      // suite : un serveur qui accepte puis coupe aussitôt la session (pas de
      // shell) ouvre le port l'espace d'un instant.
      const timeoutMs = Math.min(120_000, Math.max(1000, Number(args.timeoutMs) || 20_000))
      const deadline = Date.now() + timeoutMs
      const probe = async (): Promise<{ listening: boolean | null; ssh: SshState | null }> => {
        const [l, s] = await Promise.all([
          isListening(forward),
          created ? withSshState([created]).then((r) => r[0].sshState) : Promise.resolve(null)
        ])
        return { listening: l, ssh: s }
      }
      let listening: boolean | null = false
      let stable = 0
      while (Date.now() < deadline) {
        const p = await probe()
        const up = p.ssh === 'connected' && p.listening !== false
        stable = up ? stable + 1 : 0
        listening = up ? p.listening : false
        if (stable >= 2 || p.ssh === 'disconnected') break
        await new Promise((r) => setTimeout(r, 700))
      }
      if (stable < 2) listening = false
      const output = created ? tailLines(tidy(stripAnsi(getPtyBuffer(created.ptyId))), 15) : ''
      return {
        ok: listening !== false,
        server: host.name,
        tunnel: desc,
        origin,
        ptyId: created?.ptyId ?? null,
        listening,
        state: listening ? 'active' : listening === null ? 'unknown' : 'inactive',
        note:
          listening === true
            ? `Tunnel actif : ${desc.listen} → ${desc.destination ?? 'SOCKS'}. Il reste ouvert tant que ` +
              'l’onglet de cette session l’est.'
            : listening === null
              ? 'Tunnel distant (-R) : il écoute sur le serveur, invérifiable d’ici. Session ouverte.'
              : 'Le port local n’écoute toujours pas : connexion refusée, mot de passe absent ou ' +
                'destination injoignable ? Voir `output` (fin du terminal).',
        ...(listening === false ? { output } : {})
      }
    }

    case 'open_ssh':
    case 'open_sftp': {
      const host = await findServer(args)
      const win = targetWindow(args)

      if (name === 'open_sftp') {
        deliver(win, IPC.trayBrowseSsh, host)
        return { ok: true, server: host.name, mode: 'sftp', windowId: win.id }
      }

      const key = hostKeyOf(host)
      // Seule une session dont le ssh tourne ENCORE est réutilisable : un onglet
      // dont la connexion est tombée est revenu au shell local.
      const sessions = await withSshState(allTerminals().filter((t) => !t.exited && t.sshHost === key))
      const existing =
        sessions.find((t) => t.sshState === 'connected') ?? sessions.find((t) => SSH_USABLE.includes(t.sshState))
      const stale = sessions.filter((t) => t.sshState === 'disconnected').map((t) => t.ptyId)
      if (existing && args.newSession !== true) {
        return {
          ok: true,
          server: host.name,
          mode: 'terminal',
          ptyId: existing.ptyId,
          windowId: existing.windowId,
          reused: true,
          sshState: existing.sshState,
          note: 'Session déjà ouverte — réutilisée. Enchaînez avec run_in_terminal sur ce ptyId.'
        }
      }

      // On mémorise les terminaux EXISTANTS : avec newSession, l'ancienne
      // session vers ce serveur était aussitôt « trouvée » et son ptyId rendu
      // à la place de celui de la nouvelle.
      const before = new Set(allTerminals().map((t) => t.ptyId))
      deliver(win, IPC.trayOpenSsh, host)
      const created = await waitNewTerminal(before, (t) => t.sshHost === key, 8000)
      return {
        ok: true,
        server: host.name,
        mode: 'terminal',
        ptyId: created?.ptyId ?? null,
        windowId: created?.windowId ?? win.id,
        reused: false,
        ...(stale.length ? { reopened: true, disconnected: stale } : {}),
        note:
          (stale.length
            ? `La session précédente (${stale.join(', ')}) avait perdu sa connexion : une nouvelle a été ` +
              'ouverte (l’ancien onglet est laissé tel quel). '
            : '') +
          (created
            ? 'Session ouverte. Le mot de passe enregistré, s’il existe, est fourni ' +
              'automatiquement : laissez ~2 s avant la première commande (run_in_terminal).'
            : 'Session demandée, mais son identifiant n’est pas encore visible — ' +
              'appelez list_terminals dans un instant.')
      }
    }

    default:
      throw new Error(`Outil inconnu : ${name}`)
  }
}

/* ------------------------------ Serveur HTTP ------------------------------ */

export function startMcpServer(): void {
  if (server) return
  token = randomBytes(24).toString('hex')

  server = createServer((req, res) => {
    if (req.headers['x-gvue-token'] !== token) {
      res.writeHead(403).end()
      return
    }
    if (req.method !== 'POST' || req.url !== '/rpc') {
      res.writeHead(404).end()
      return
    }
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > 1_000_000) req.destroy()
    })
    req.on('end', () => {
      void (async () => {
        try {
          const { tool, args } = JSON.parse(body) as { tool: string; args?: Record<string, unknown> }
          const result = await callTool(tool, args ?? {})
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true, result }))
        } catch (e) {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
        }
      })()
    })
  })

  server.listen(0, '127.0.0.1', () => {
    const addr = server?.address()
    port = typeof addr === 'object' && addr ? addr.port : 0
    try {
      mkdirSync(app.getPath('userData'), { recursive: true })
      writeFileSync(endpointFile(), JSON.stringify({ port, token, pid: process.pid, version: app.getVersion() }))
    } catch (e) {
      logError('mcp', e)
    }
    logInfo('mcp', `Serveur MCP démarré sur 127.0.0.1:${port}.`)
  })
  server.on('error', (e) => logError('mcp', e))
}

function endpointFile(): string {
  return join(app.getPath('userData'), 'mcp-endpoint.json')
}

/** Chemin du pont stdio à enregistrer côté client MCP (Claude Code…). */
export function bridgePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'gvue-mcp.cjs')
    : join(app.getAppPath(), 'scripts', 'gvue-mcp.cjs')
}

export function stopMcpServer(): void {
  if (!server) return
  server.close()
  server = null
  port = 0
  try {
    unlinkSync(endpointFile())
  } catch {
    /* déjà absent */
  }
  logInfo('mcp', 'Serveur MCP arrêté.')
}

export function mcpStatus(): { enabled: boolean; port: number; bridgePath: string } {
  return { enabled: server !== null, port, bridgePath: bridgePath() }
}
