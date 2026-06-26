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

// Verrou d'instance unique : une seule fenêtre GVue à la fois. Évite que deux
// instances se disputent le cache (erreurs « Unable to move the cache »).
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    registerIpc()
    createWindow()

    app.on('activate', () => {
      // macOS : recrée une fenêtre si le dock est cliqué sans fenêtre ouverte.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('before-quit', () => {
  // Termine proprement tous les pseudo-terminaux et recherches encore vivants.
  killAll()
  killAllSearches()
  closeWatch()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
