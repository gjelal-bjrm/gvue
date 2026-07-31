import { app, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import {
  registerExplorerEntry,
  unregisterExplorerEntry,
  explorerEntryRegistered
} from '../services/shell-integration'

/** Handler IPC de l'intégration Explorateur (« Ouvrir dans GVue »). */
export function registerIntegrationHandlers(): void {
  ipcMain.handle(IPC.integrationGet, async () => {
    if (process.platform !== 'win32') return { supported: false, enabled: false }
    return { supported: true, enabled: await explorerEntryRegistered() }
  })

  ipcMain.handle(IPC.integrationSet, async (_e, enabled: boolean) => {
    if (process.platform !== 'win32') return false
    if (!enabled) return unregisterExplorerEntry()
    // Packagé : l'exe GVue. Dev : electron + dossier de l'app (fonctionne, mais
    // l'entrée pointera sur la build de dev — l'UI le précise).
    return registerExplorerEntry(
      process.execPath,
      app.isPackaged ? undefined : app.getAppPath()
    )
  })
}
