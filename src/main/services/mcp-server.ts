import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { McpContext } from '@shared/types'
import { getPtyBuffer, writePty } from './pty-manager'
import { getConfig } from './config-store'
import { readSshConfigHosts } from './ssh-config'
import { hostKeyOf } from './sftp-manager'
import { sendToWindow } from '../tray'
import { logInfo, logError } from './logger'
import { stripAnsi, tailLines } from './strip-ansi'

/**
 * Serveur MCP local (agents IA — Claude Code, etc.) : expose le contexte de la
 * session GVue (onglets, sélection, dépôt Git, terminaux et leurs logs) et
 * quelques actions (naviguer, lancer un lancement).
 *
 * Sécurité : OPT-IN (Paramètres → Général), écoute UNIQUEMENT sur 127.0.0.1,
 * port aléatoire, et chaque requête doit porter le jeton (généré au démarrage)
 * via l'en-tête `x-gvue-token`. Le couple port+jeton est écrit dans
 * `userData/mcp-endpoint.json`, lisible seulement par l'utilisateur local —
 * c'est ce fichier que lit le pont stdio `gvue-mcp.cjs`.
 */

let server: Server | null = null
let token = ''
let port = 0

// Dernier instantané de contexte poussé par le renderer (fenêtre active).
let context: McpContext = { panes: [], repo: null, terminals: [] }

export function setMcpContext(ctx: McpContext): void {
  context = ctx
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

/** Attend l'apparition du terminal SSH que l'interface vient d'ouvrir. */
async function waitForSshTerminal(hostKey: string, timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = context.terminals.find((t) => !t.exited && t.sshHost === hostKey)
    if (found) return found.ptyId
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

/**
 * Terminal visé par un outil : par ptyId, sinon par titre approché, sinon par
 * serveur SSH, sinon le dernier ouvert. Les sessions terminées ne sont
 * choisies par défaut que s'il n'y a rien de vivant.
 */
function findTerminal(args: Record<string, unknown>): McpContext['terminals'][number] | null {
  const id = typeof args.ptyId === 'string' ? args.ptyId : ''
  const title = typeof args.title === 'string' ? args.title.toLowerCase() : ''
  const server = typeof args.server === 'string' ? args.server.toLowerCase() : ''
  if (id) return context.terminals.find((t) => t.ptyId === id) ?? null
  if (title) return context.terminals.find((t) => t.title.toLowerCase().includes(title)) ?? null
  if (server) {
    return context.terminals.find((t) => (t.sshHost ?? '').toLowerCase().includes(server)) ?? null
  }
  const alive = context.terminals.filter((t) => !t.exited)
  const pool = alive.length ? alive : context.terminals
  return pool[pool.length - 1] ?? null
}

/* ------------------------------- Outils MCP ------------------------------ */

type ToolResult = unknown

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'get_context': {
      return {
        version: app.getVersion(),
        panes: context.panes,
        repo: context.repo,
        terminals: context.terminals.map((t) => ({ ...t, hasOutput: !!getPtyBuffer(t.ptyId) }))
      }
    }

    case 'list_terminals':
      return context.terminals

    case 'get_terminal_output': {
      const lines = Math.min(2000, Math.max(1, Number(args.tailLines) || 200))
      const term = findTerminal(args)
      if (!term) throw new Error('Aucun terminal ouvert dans GVue.')
      const raw = getPtyBuffer(term.ptyId)
      return {
        ptyId: term.ptyId,
        title: term.title,
        cwd: term.cwd,
        exited: term.exited,
        output: tailLines(stripAnsi(raw), lines)
      }
    }

    /**
     * Écrit dans un terminal DÉJÀ ouvert, puis rend la sortie produite.
     *
     * C'est ce qui manquait pour travailler dans une session existante :
     * jusqu'ici un agent ne pouvait qu'ouvrir un onglet de plus. Sur une
     * session SSH ouverte par GVue, la connexion (et son mot de passe
     * enregistré) est déjà établie — la commande part directement sur le
     * serveur, sans rien redemander à l'utilisateur.
     */
    case 'run_in_terminal': {
      const command = typeof args.command === 'string' ? args.command : ''
      if (!command.trim()) throw new Error('Paramètre « command » requis.')
      const term = findTerminal(args)
      if (!term) throw new Error('Aucun terminal ouvert dans GVue (voir list_terminals).')
      if (term.exited) {
        throw new Error(
          `Le terminal « ${term.title} » est terminé : rouvrez-en un (open_terminal) ou visez-en un autre.`
        )
      }
      // Repère de départ : on ne rend que ce que CETTE commande a produit.
      const before = getPtyBuffer(term.ptyId).length
      const submit = args.submit !== false
      writePty(term.ptyId, submit ? `${command}
` : command)

      const waitMs = Math.min(30_000, Math.max(0, Number(args.waitMs) || 1500))
      await new Promise((r) => setTimeout(r, waitMs))
      const produced = getPtyBuffer(term.ptyId).slice(before)
      return {
        ptyId: term.ptyId,
        title: term.title,
        sshHost: term.sshHost ?? null,
        output: tailLines(stripAnsi(produced), 400),
        note:
          'Sortie produite pendant l’attente. Une commande plus longue continue ' +
          'de tourner : rappelez get_terminal_output pour lire la suite.'
      }
    }

    case 'navigate': {
      const p = typeof args.path === 'string' ? args.path.trim() : ''
      if (!p) throw new Error('Paramètre « path » requis.')
      sendToWindow(IPC.trayOpenPath, p)
      return { ok: true, opened: p }
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
      const name = typeof args.name === 'string' ? args.name.toLowerCase() : ''
      const task =
        tasks.find((t) => t.id === id) ??
        (name ? tasks.find((t) => t.name.toLowerCase() === name) : undefined)
      if (!task) throw new Error('Lancement introuvable (id ou name requis — voir list_launch_tasks).')
      sendToWindow(IPC.trayRunTask, task.id)
      return { ok: true, started: task.name }
    }

    case 'get_ui_state': {
      if (!context.ui) throw new Error("État UI indisponible (fenêtre pas encore prête).")
      return context.ui
    }

    case 'screenshot': {
      // Capture la fenêtre GVue (rendu réel) → PNG temporaire, chemin renvoyé.
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) throw new Error('Aucune fenêtre GVue ouverte.')
      const img = await win.webContents.capturePage()
      const file = join(app.getPath('temp'), `gvue-screenshot-${Date.now()}.png`)
      writeFileSync(file, img.toPNG())
      const { width, height } = img.getSize()
      return { path: file, width, height }
    }

    case 'open_terminal': {
      const cwd = typeof args.cwd === 'string' ? args.cwd.trim() : ''
      const command = typeof args.command === 'string' ? args.command.trim() : ''
      const title = typeof args.title === 'string' ? args.title.trim() : ''
      if (!cwd) throw new Error('Paramètre « cwd » requis (dossier de travail).')
      sendToWindow(IPC.mcpOpenTerminal, { cwd, command, title })
      return {
        ok: true,
        note: command
          ? 'Terminal ouvert dans GVue, commande lancée sous les yeux de l’utilisateur (le processus survit à la session de l’agent).'
          : 'Terminal ouvert dans GVue.'
      }
    }

    case 'reveal': {
      const p = typeof args.path === 'string' ? args.path.trim() : ''
      if (!p) throw new Error('Paramètre « path » requis.')
      sendToWindow(IPC.mcpReveal, p)
      return { ok: true, revealed: p }
    }

    case 'notify': {
      const message = typeof args.message === 'string' ? args.message.trim() : ''
      if (!message) throw new Error('Paramètre « message » requis.')
      sendToWindow(IPC.mcpNotify, message)
      return { ok: true }
    }

    case 'set_ui': {
      // Ouvre/ferme un panneau ou un dialogue — sert aux captures dirigées
      // et à un agent qui veut montrer quelque chose à l'utilisateur.
      const panels = [
        'git',
        'terminal',
        'preview',
        'settings',
        'recycleBin',
        'servers',
        'tidyRules',
        'shortcuts',
        'palette'
      ]
      const panel = typeof args.panel === 'string' ? args.panel : ''
      if (!panels.includes(panel))
        throw new Error(`Paramètre « panel » requis — au choix : ${panels.join(', ')}.`)
      const open = args.open === undefined ? true : Boolean(args.open)
      sendToWindow(IPC.mcpSetUi, { panel, open })
      return { ok: true, panel, open }
    }

    case 'set_theme': {
      // 'auto' | 'light' | 'dark' | id de palette (cyber, matrix, tokyo…).
      const theme = typeof args.theme === 'string' ? args.theme.trim() : ''
      if (!theme) throw new Error('Paramètre « theme » requis (auto, light, dark ou id de palette).')
      sendToWindow(IPC.mcpSetTheme, theme)
      return { ok: true, theme }
    }

    case 'resize_window': {
      const width = Number(args.width)
      const height = Number(args.height)
      if (!Number.isFinite(width) || !Number.isFinite(height))
        throw new Error('Paramètres « width » et « height » requis (pixels).')
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win || win.isDestroyed()) throw new Error('Aucune fenêtre GVue ouverte.')
      if (win.isMaximized()) win.unmaximize()
      win.setSize(Math.max(640, Math.round(width)), Math.max(480, Math.round(height)))
      win.center()
      const [w, h] = win.getSize()
      return { ok: true, width: w, height: h }
    }

    case 'list_servers': {
      // Hôtes manuels (config GVue) + alias du ~/.ssh/config, sans doublon.
      const manual = getConfig('sshHosts') ?? []
      const fromConfig = (await readSshConfigHosts()).filter(
        (h) => !manual.some((m) => m.name === h.name)
      )
      return {
        servers: [...manual, ...fromConfig].map((h) => ({
          name: h.name,
          source: h.source,
          target: `${h.user ? `${h.user}@` : ''}${h.hostName ?? h.name}${h.port ? `:${h.port}` : ''}`,
          tunnels: h.forwards?.length ?? 0
        }))
      }
    }

    case 'open_ssh':
    case 'open_sftp': {
      const wanted = typeof args.name === 'string' ? args.name.trim().toLowerCase() : ''
      if (!wanted) throw new Error('Paramètre « name » requis (voir list_servers).')
      const manual = getConfig('sshHosts') ?? []
      const host =
        manual.find((h) => h.name.toLowerCase() === wanted) ??
        (await readSshConfigHosts()).find((h) => h.name.toLowerCase() === wanted)
      if (!host) {
        // Un agent qui ne trouve pas le serveur se rabat sur « ssh » lancé à la
        // main dans un terminal — souvent avec BatchMode=yes, qui INTERDIT la
        // saisie du mot de passe : l'échec est garanti sans clé publique. On
        // lui dit donc quoi faire au lieu de le laisser improviser.
        const known = [...manual.map((h) => h.name), ...(await readSshConfigHosts()).map((h) => h.name)]
        throw new Error(
          `Serveur introuvable : ${args.name}. Serveurs connus de GVue : ${known.join(', ') || '(aucun)'}. ` +
            "Ne lancez PAS « ssh » vous-même dans un terminal : sans clé publique, l'authentification " +
            "échouera et le mot de passe enregistré ne sera pas utilisé. Demandez plutôt à l'utilisateur " +
            "d'ajouter ce serveur dans GVue (gestionnaire de serveurs : hôte, port, utilisateur, mot de " +
            'passe), puis rappelez open_ssh.'
        )
      }

      if (name === 'open_sftp') {
        sendToWindow(IPC.trayBrowseSsh, host)
        return { ok: true, server: host.name, mode: 'sftp' }
      }

      // Une session vers ce serveur est peut-être DÉJÀ ouverte : la réutiliser
      // plutôt qu'empiler un onglet de plus (et refaire saisir le mot de passe).
      const key = hostKeyOf(host)
      const existing = context.terminals.find((t) => !t.exited && t.sshHost === key)
      if (existing && args.newSession !== true) {
        return {
          ok: true,
          server: host.name,
          mode: 'terminal',
          ptyId: existing.ptyId,
          reused: true,
          note: 'Session déjà ouverte — réutilisée. Enchaînez avec run_in_terminal sur ce ptyId.'
        }
      }

      sendToWindow(IPC.trayOpenSsh, host)
      // Le terminal naît côté interface : on attend qu'il apparaisse dans le
      // contexte pour rendre son ptyId, sans quoi l'agent n'a rien à viser.
      const ptyId = await waitForSshTerminal(key, 8000)
      return {
        ok: true,
        server: host.name,
        mode: 'terminal',
        ptyId,
        reused: false,
        note: ptyId
          ? 'Session ouverte. Le mot de passe enregistré, s’il existe, est fourni ' +
            'automatiquement : laissez ~2 s avant la première commande (run_in_terminal).'
          : 'Session demandée, mais son identifiant n’est pas encore visible — ' +
            'appelez list_terminals dans un instant.'
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
    // Localhost uniquement + jeton obligatoire.
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
      writeFileSync(
        endpointFile(),
        JSON.stringify({ port, token, pid: process.pid, version: app.getVersion() })
      )
    } catch (e) {
      logError('mcp', e)
    }
    logInfo('mcp', `Serveur MCP démarré sur 127.0.0.1:${port}.`)
  })
  server.on('error', (e) => logError('mcp', e))
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
