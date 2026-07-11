import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { McpContext } from '@shared/types'
import { setMcpContext, startMcpServer, stopMcpServer, mcpStatus } from '../services/mcp-server'
import { setConfig } from '../services/config-store'

/** Handlers IPC du serveur MCP : contexte poussé par le renderer + bascule. */
export function registerMcpHandlers(): void {
  ipcMain.on(IPC.mcpContext, (_e, ctx: McpContext) => setMcpContext(ctx))

  ipcMain.handle(IPC.mcpToggle, async (_e, enabled: boolean) => {
    if (enabled) startMcpServer()
    else stopMcpServer()
    setConfig('mcpEnabled', enabled)
    return mcpStatus()
  })

  ipcMain.handle(IPC.mcpStatus, async () => mcpStatus())
}
