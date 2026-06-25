import { app, BrowserWindow } from 'electron'
import { createWindow } from './window'
import { registerFsHandlers } from './ipc/fs'
import { registerConfigHandlers } from './ipc/config'
import { registerWindowHandlers } from './ipc/window'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerSearchHandlers } from './ipc/search'
import { registerGitHandlers } from './ipc/git'
import { registerAppsHandlers } from './ipc/apps'
import { killAll } from './services/pty-manager'
import { killAllSearches } from './services/search'
import { closeWatch } from './services/fs-watch'

/**
 * Bootstrap de l'application.
 * Enregistre les handlers IPC une seule fois, puis crée la fenêtre.
 */
function registerIpc(): void {
  registerFsHandlers()
  registerConfigHandlers()
  registerWindowHandlers()
  registerTerminalHandlers()
  registerSearchHandlers()
  registerGitHandlers()
  registerAppsHandlers()
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
  // Termine proprement tous les pseudo-terminaux et recherches encore vivants.
  killAll()
  killAllSearches()
  closeWatch()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
