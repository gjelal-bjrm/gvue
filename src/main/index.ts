import { app, BrowserWindow } from 'electron'
import { createWindow } from './window'
import { createTray, trayActive } from './tray'
import { registerFsHandlers } from './ipc/fs'
import { registerConfigHandlers } from './ipc/config'
import { registerWindowHandlers } from './ipc/window'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerSearchHandlers } from './ipc/search'
import { registerGitHandlers } from './ipc/git'
import { registerAppsHandlers } from './ipc/apps'
import { registerUpdateHandlers, initAutoUpdate } from './services/updater'
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
  registerUpdateHandlers()
}

// Verrou d'instance unique : un seul *processus* GVue (les fenêtres multiples
// vivent dans ce processus). Évite que deux processus se disputent le cache
// (erreurs « Unable to move the cache »).
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  // Relancer l'exécutable ouvre une nouvelle fenêtre GVue.
  app.on('second-instance', () => {
    createWindow()
  })

  app.whenReady().then(() => {
    registerIpc()
    createTray()
    createWindow()
    initAutoUpdate()

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
  // En production avec le plateau actif, GVue reste en arrière-plan quand toutes
  // les fenêtres sont fermées (on quitte via « Quitter GVue » dans le plateau).
  // En dev, on quitte normalement pour ne pas bloquer le redémarrage d'Electron
  // (verrou d'instance) à chaud.
  if (app.isPackaged && trayActive()) return
  if (process.platform !== 'darwin') app.quit()
})
