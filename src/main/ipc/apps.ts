import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { ExternalAppId } from '@shared/types'
import * as apps from '../services/apps'

/** Handlers IPC des intégrations d'applications externes. */
export function registerAppsHandlers(): void {
  ipcMain.handle(IPC.appsList, async () => apps.detect())

  ipcMain.on(IPC.appsOpenWith, (_e, appId: ExternalAppId, paths: string[]) => {
    apps.openWith(appId, paths)
  })

  ipcMain.on(IPC.appsOpenPathWith, (_e, exe: string, paths: string[]) => {
    apps.openPathWith(exe, paths)
  })

  // Boîte de dialogue native pour choisir un programme (.exe).
  ipcMain.handle(IPC.appsPickProgram, async (e): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options = {
      title: 'Choisir une application',
      properties: ['openFile' as const],
      filters: [{ name: 'Programmes', extensions: ['exe'] }],
      defaultPath: process.env.ProgramFiles
    }
    const res = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })

  ipcMain.handle(IPC.appsArchive, async (_e, paths: string[]) => apps.archive(paths))

  ipcMain.handle(IPC.appsExtract, async (_e, archivePath: string) => apps.extract(archivePath))
}
