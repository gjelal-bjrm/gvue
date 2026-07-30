import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import {
  listRecycleBin,
  restoreItems,
  deleteItems,
  emptyRecycleBin
} from '../services/recycle-bin'

/** Handler IPC de la corbeille Windows : adaptateur fin au service. */
export function registerBinHandlers(): void {
  ipcMain.handle(IPC.binList, async () => listRecycleBin())
  ipcMain.handle(IPC.binRestore, async (_e, ids: string[]) => restoreItems(ids))
  ipcMain.handle(IPC.binDelete, async (_e, ids: string[]) => deleteItems(ids))
  ipcMain.handle(IPC.binEmpty, async () => emptyRecycleBin())
}
