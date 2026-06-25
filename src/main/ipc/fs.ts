import { ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import * as filesystem from '../services/filesystem'
import { pushRecent } from '../services/config-store'

/**
 * Handlers IPC du système de fichiers : adaptateurs fins au-dessus du
 * service `filesystem`. Validation des entrées (chemins absolus) déléguée
 * au service ; ici on se contente d'aiguiller.
 */
export function registerFsHandlers(): void {
  ipcMain.handle(IPC.fsList, async (_e, dirPath: string) => {
    const result = await filesystem.list(dirPath)
    pushRecent(result.path)
    return result
  })

  ipcMain.handle(IPC.fsLocations, async () => {
    return filesystem.getLocations()
  })

  ipcMain.handle(IPC.fsReveal, async (_e, targetPath: string) => {
    const safe = filesystem.assertAbsolute(targetPath)
    shell.showItemInFolder(safe)
  })

  ipcMain.handle(IPC.fsOpen, async (_e, targetPath: string) => {
    const safe = filesystem.assertAbsolute(targetPath)
    // Ouvre avec l'application par défaut de l'OS.
    return shell.openPath(safe)
  })
}
