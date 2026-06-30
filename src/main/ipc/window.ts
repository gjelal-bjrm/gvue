import { ipcMain, BrowserWindow, shell } from 'electron'
import { IPC } from '@shared/ipc'
import { createWindow } from '../window'
import type { WindowAction, WindowStatus } from '@shared/types'

/** Schémas autorisés à l'ouverture externe (jamais file:, about:, etc.). */
const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

/** Handlers IPC de contrôle de la fenêtre frameless (barre de titre custom). */
export function registerWindowHandlers(): void {
  ipcMain.handle(IPC.windowNew, async () => {
    createWindow()
  })

  // Ouvre une URL dans le navigateur système (liens cliqués dans le terminal…).
  // Valide le schéma pour ne jamais transmettre « about: »/« file: » à l'OS.
  ipcMain.handle(IPC.openExternal, async (_e, url: string) => {
    try {
      if (EXTERNAL_SCHEMES.has(new URL(url).protocol)) await shell.openExternal(url)
    } catch {
      /* URL invalide : ignorée */
    }
  })

  ipcMain.handle(IPC.windowAction, async (e, action: WindowAction) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    switch (action) {
      case 'minimize':
        win.minimize()
        break
      case 'maximize-toggle':
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
        break
      case 'close':
        win.close()
        break
    }
  })

  ipcMain.handle(IPC.windowStatus, async (e): Promise<WindowStatus> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return { maximized: win?.isMaximized() ?? false }
  })

  ipcMain.handle(IPC.windowSetOpacity, async (e, value: number) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    // Opacité OS réelle (on voit le bureau derrière) ; bornée pour rester visible.
    win?.setOpacity(Math.min(1, Math.max(0.3, value)))
  })
}
