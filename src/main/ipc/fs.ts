import { ipcMain, shell, app } from 'electron'
import { IPC } from '@shared/ipc'
import type { NavLocations, DirEntry, QuickAccessData } from '@shared/types'
import * as filesystem from '../services/filesystem'
import { pushRecent, pushRecentFile, getConfig } from '../services/config-store'

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
    const base = await filesystem.getLocations()
    // app.getPath résout les dossiers connus de façon fiable, même redirigés
    // (Bureau/Téléchargements sous OneDrive, par ex.).
    return {
      ...base,
      desktop: app.getPath('desktop'),
      downloads: app.getPath('downloads'),
      documents: app.getPath('documents')
    } satisfies NavLocations
  })

  ipcMain.handle(IPC.fsReveal, async (_e, targetPath: string) => {
    const safe = filesystem.assertAbsolute(targetPath)
    shell.showItemInFolder(safe)
  })

  ipcMain.handle(IPC.fsOpen, async (_e, targetPath: string) => {
    const safe = filesystem.assertAbsolute(targetPath)
    pushRecentFile(safe)
    // Ouvre avec l'application par défaut de l'OS.
    return shell.openPath(safe)
  })

  ipcMain.handle(IPC.fsProbe, async (_e, targetPath: string) => {
    return filesystem.probe(targetPath)
  })

  ipcMain.handle(IPC.fsTrash, async (_e, targetPath: string) => {
    const safe = filesystem.assertAbsolute(targetPath)
    // Corbeille de l'OS (réversible), jamais de suppression définitive.
    await shell.trashItem(safe)
  })

  ipcMain.handle(IPC.fsQuickAccess, async () => {
    // Dossiers les plus fréquents (filtrés des disparus), puis fichiers récents.
    const freq = getConfig('folderFreq')
    const topFolders = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([p]) => p)
    const frequentRaw = await Promise.all(topFolders.map((p) => filesystem.entryFor(p)))
    const frequent = frequentRaw
      .filter((e): e is DirEntry => e !== null && e.kind === 'directory')
      .slice(0, 12)

    const recentRaw = await Promise.all(getConfig('recentFiles').map((p) => filesystem.entryFor(p)))
    const recentFiles = recentRaw
      .filter((e): e is DirEntry => e !== null && e.kind === 'file')
      .slice(0, 20)

    return { frequent, recentFiles } satisfies QuickAccessData
  })
}
