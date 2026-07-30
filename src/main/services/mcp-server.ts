import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { McpContext } from '@shared/types'
import { getPtyBuffer } from './pty-manager'
import { getConfig } from './config-store'
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
      const wantedId = typeof args.ptyId === 'string' ? args.ptyId : ''
      const wantedTitle = typeof args.title === 'string' ? args.title.toLowerCase() : ''
      const lines = Math.min(2000, Math.max(1, Number(args.tailLines) || 200))
      const term =
        context.terminals.find((t) => t.ptyId === wantedId) ??
        (wantedTitle
          ? context.terminals.find((t) => t.title.toLowerCase().includes(wantedTitle))
          : // Par défaut : le dernier terminal (le plus récent).
            context.terminals[context.terminals.length - 1])
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
