import { ipcMain, app } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppConfig } from '@shared/types'
import { getConfig, setConfig, getAllConfig } from '../services/config-store'
import { syncTidy } from '../services/tidy'

/** Handlers IPC de configuration : lecture/écriture du store persistant. */
export function registerConfigHandlers(): void {
  ipcMain.handle(IPC.configGet, async (_e, key: keyof AppConfig) => {
    // Filet de sécurité : une config héritée d'un poste de dev ne doit pas
    // faire tourner une version packagée en mode démo.
    if (key === 'demoMode' && app.isPackaged) return false as AppConfig['demoMode']
    return getConfig(key)
  })

  ipcMain.handle(
    IPC.configSet,
    async (_e, key: keyof AppConfig, value: AppConfig[keyof AppConfig]) => {
      // Le mode démo (données fictives) est un outil de DÉVELOPPEMENT :
      // jamais activable dans une application packagée, quoi qu'on écrive.
      if (key === 'demoMode' && app.isPackaged) return
      setConfig(key, value)
      // Le rangement auto suit sa config en direct (démarrage/arrêt du watcher).
      if (key === 'tidy') syncTidy()
    }
  )

  ipcMain.handle(IPC.configAll, async () => {
    return getAllConfig()
  })
}
