import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppConfig } from '@shared/types'
import { getConfig, setConfig, getAllConfig } from '../services/config-store'

/** Handlers IPC de configuration : lecture/écriture du store persistant. */
export function registerConfigHandlers(): void {
  ipcMain.handle(IPC.configGet, async (_e, key: keyof AppConfig) => {
    return getConfig(key)
  })

  ipcMain.handle(
    IPC.configSet,
    async (_e, key: keyof AppConfig, value: AppConfig[keyof AppConfig]) => {
      setConfig(key, value)
    }
  )

  ipcMain.handle(IPC.configAll, async () => {
    return getAllConfig()
  })
}
