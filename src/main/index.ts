import { app, BrowserWindow } from 'electron'
import { createWindow } from './window'
import { registerFsHandlers } from './ipc/fs'
import { registerConfigHandlers } from './ipc/config'
import { registerWindowHandlers } from './ipc/window'
import { registerTerminalHandlers } from './ipc/terminal'
import { killAll } from './services/pty-manager'

/**
 * Bootstrap de l'application.
 * Enregistre les handlers IPC une seule fois, puis crée la fenêtre.
 */
function registerIpc(): void {
  registerFsHandlers()
  registerConfigHandlers()
  registerWindowHandlers()
  registerTerminalHandlers()
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    // macOS : recrée une fenêtre si le dock est cliqué sans fenêtre ouverte.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  // Termine proprement tous les pseudo-terminaux encore vivants.
  killAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
