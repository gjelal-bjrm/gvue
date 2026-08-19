import { app, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import {
  registerExplorerEntry,
  unregisterExplorerEntry,
  explorerEntryRegistered
} from '../services/shell-integration'

/**
 * Ce que la ligne de commande demandait au lancement, gardé jusqu'à ce que
 * l'interface vienne le chercher.
 *
 * L'envoi sur `did-finish-load` arrivait AVANT que React ait monté ses
 * écouteurs : le message partait dans le vide, et un GVue lancé depuis GRay
 * s'ouvrait sans charger l'espace demandé. Une demande de l'interface, elle,
 * ne peut pas arriver trop tôt.
 */
let pending: { workspace?: string; dir?: string } | null = null

export function setPendingStartup(value: { workspace?: string; dir?: string }): void {
  pending = value
}

/** Handler IPC de l'intégration Explorateur (« Ouvrir dans GVue »). */
export function registerIntegrationHandlers(): void {
  // Servi une seule fois : la demande est consommée.
  ipcMain.handle(IPC.cliPending, () => {
    const value = pending
    pending = null
    return value
  })

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
