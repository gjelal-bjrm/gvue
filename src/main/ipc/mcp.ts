import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { McpContext } from '@shared/types'
import {
  setMcpContext,
  noteWindowFocus,
  resolveTerminalRead,
  startMcpServer,
  stopMcpServer,
  mcpStatus
} from '../services/mcp-server'
import { setConfig } from '../services/config-store'

/** Handlers IPC du serveur MCP : contexte poussé par CHAQUE fenêtre + bascule. */
export function registerMcpHandlers(): void {
  ipcMain.on(IPC.mcpContext, (e, ctx: McpContext) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) setMcpContext(win, ctx)
  })
  ipcMain.on(IPC.mcpReadTerminalReply, (_e, r: { reqId: number; text: string | null }) =>
    resolveTerminalRead(r.reqId, r.text)
  )
  // Cible par défaut des actions : la dernière fenêtre utilisée.
  app.on('browser-window-focus', (_e, win) => noteWindowFocus(win))

  ipcMain.handle(IPC.mcpToggle, async (_e, enabled: boolean) => {
    if (enabled) startMcpServer()
    else stopMcpServer()
    setConfig('mcpEnabled', enabled)
    return mcpStatus()
  })

  ipcMain.handle(IPC.mcpStatus, async () => mcpStatus())
}
