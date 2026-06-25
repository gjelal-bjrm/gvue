import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { ExternalAppId } from '@shared/types'
import * as apps from '../services/apps'

/** Handlers IPC des intégrations d'applications externes. */
export function registerAppsHandlers(): void {
  ipcMain.handle(IPC.appsList, async () => apps.detect())

  ipcMain.on(IPC.appsOpenWith, (_e, appId: ExternalAppId, paths: string[]) => {
    apps.openWith(appId, paths)
  })

  ipcMain.handle(IPC.appsArchive, async (_e, paths: string[]) => apps.archive(paths))

  ipcMain.handle(IPC.appsExtract, async (_e, archivePath: string) => apps.extract(archivePath))
}
