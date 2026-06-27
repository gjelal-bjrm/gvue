import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { RendererErrorReport } from '@shared/types'
import { logError, getLogPath } from '../services/logger'

/** Handlers IPC de journalisation : le renderer remonte ses erreurs au fichier de log. */
export function registerLogHandlers(): void {
  ipcMain.handle(IPC.logReport, async (_e, report: RendererErrorReport) => {
    const detail = [report.message, report.stack, report.componentStack]
      .filter(Boolean)
      .join('\n')
    logError(`renderer:${report.scope ?? 'unknown'}`, detail)
  })

  ipcMain.handle(IPC.logPath, async () => getLogPath())
}
