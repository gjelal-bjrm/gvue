import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { readFileClipboard, writeFileClipboard, clearFileClipboard } from '../services/sys-clipboard'

/** Handler IPC du presse-papiers système de fichiers (interop Explorateur). */
export function registerClipboardHandlers(): void {
  ipcMain.handle(IPC.clipReadFiles, async () => readFileClipboard())

  ipcMain.handle(IPC.clipWriteFiles, async (_e, files: string[], move: boolean) =>
    writeFileClipboard(files, move)
  )

  ipcMain.handle(IPC.clipClear, async () => clearFileClipboard())
}
