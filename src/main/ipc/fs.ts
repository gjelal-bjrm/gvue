import { ipcMain, shell, app, nativeImage } from 'electron'
import { dirname, basename } from 'node:path'
import { IPC } from '@shared/ipc'
import type { NavLocations, DirEntry, QuickAccessData } from '@shared/types'
import * as filesystem from '../services/filesystem'
import * as fileops from '../services/fileops'
import { readPreview } from '../services/preview'
import { pushRecent, pushRecentFile, getConfig } from '../services/config-store'
import { watchDir } from '../services/fs-watch'

// Icône minimale pour le glisser-déposer natif (startDrag exige une icône non vide).
const DRAG_ICON = nativeImage
  .createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  )
  .resize({ width: 24, height: 24 })

/**
 * Handlers IPC du système de fichiers : adaptateurs fins au-dessus du
 * service `filesystem`. Validation des entrées (chemins absolus) déléguée
 * au service ; ici on se contente d'aiguiller.
 */
export function registerFsHandlers(): void {
  ipcMain.handle(IPC.fsList, async (e, dirPath: string, track = true) => {
    const result = await filesystem.list(dirPath)
    // `track` distingue une vraie navigation (compte la visite) d'un simple
    // rafraîchissement auto déclenché par la surveillance disque.
    if (track) pushRecent(result.path)
    const wc = e.sender
    watchDir(result.path, (dir) => {
      if (!wc.isDestroyed()) wc.send(IPC.fsOnChange, dir)
    })
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

  ipcMain.handle(IPC.fsPreview, async (_e, targetPath: string) => {
    return readPreview(targetPath)
  })

  ipcMain.handle(IPC.fsCopy, async (_e, paths: string[], destDir: string) => {
    return fileops.copy(paths, destDir)
  })

  ipcMain.handle(IPC.fsMove, async (_e, paths: string[], destDir: string) => {
    return fileops.move(paths, destDir)
  })

  ipcMain.handle(IPC.fsRename, async (_e, targetPath: string, newName: string) => {
    return fileops.rename(targetPath, newName)
  })

  ipcMain.handle(IPC.fsCreateFile, async (_e, dir: string, base: string) => {
    return fileops.createFile(dir, base)
  })

  ipcMain.handle(IPC.fsCreateDir, async (_e, dir: string, base: string) => {
    return fileops.createDir(dir, base)
  })

  // Raccourci Windows (.lnk) vers l'élément, déposé dans son dossier.
  ipcMain.handle(IPC.fsCreateShortcut, async (_e, targetPath: string) => {
    try {
      const target = filesystem.assertAbsolute(targetPath)
      const link = await fileops.freeName(dirname(target), `${basename(target)} - Raccourci.lnk`)
      const ok = shell.writeShortcutLink(link, 'create', { target })
      return ok ? { ok: true, path: link } : { ok: false, error: 'Échec de création du raccourci.' }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Démarre un glisser natif (vrais fichiers) → fonctionne vers l'explorateur
  // Windows ou une autre instance de GVue.
  ipcMain.on(IPC.fsStartDrag, (e, paths: string[]) => {
    if (!Array.isArray(paths) || paths.length === 0) return
    e.sender.startDrag({ file: paths[0], files: paths, icon: DRAG_ICON })
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
