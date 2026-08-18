import { app, BrowserWindow, dialog, protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { isAbsolute, normalize } from 'node:path'
import { createWindow } from './window'
import { createTray, trayActive } from './tray'
import { syncTidy } from './services/tidy'
import { registerFsHandlers } from './ipc/fs'
import { registerConfigHandlers } from './ipc/config'
import { registerWindowHandlers } from './ipc/window'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerSearchHandlers } from './ipc/search'
import { registerGitHandlers } from './ipc/git'
import { registerAppsHandlers } from './ipc/apps'
import { registerLogHandlers } from './ipc/log'
import { registerMenuHandlers } from './ipc/menu'
import { registerMcpHandlers } from './ipc/mcp'
import { registerClipboardHandlers } from './ipc/clipboard'
import { registerBinHandlers } from './ipc/bin'
import { registerSshHandlers } from './ipc/ssh'
import { registerIntegrationHandlers } from './ipc/integration'
import { registerTidyScriptHandlers } from './services/tidy-scripts'
import { IPC } from '@shared/ipc'
import { dirFromArgv, pickOutFromArgv, workspaceFromArgv } from './services/shell-integration'
import { registerPickHandlers, setPickOut } from './ipc/pick'
import { sendToWindow } from './tray'
import { registerSftpHandlers } from './ipc/sftp'
import { disconnectAll } from './services/sftp-manager'
import { startMcpServer, stopMcpServer } from './services/mcp-server'
import { getConfig } from './services/config-store'
import { registerUpdateHandlers, initAutoUpdate } from './services/updater'
import { logInfo, logError, getLogPath } from './services/logger'
import { killAll } from './services/pty-manager'
import { killAllSearches } from './services/search'
import { closeWatch } from './services/fs-watch'
import { t } from './i18n'

/**
 * Garde-fous globaux : une erreur non interceptée ne doit pas tuer l'app en
 * silence. On journalise tout dans le fichier de log, et en production on
 * informe l'utilisateur (sans quitter) plutôt que de laisser une fenêtre figée.
 */
process.on('uncaughtException', (err) => {
  logError('uncaughtException', err)
  if (app.isPackaged) {
    dialog.showErrorBox(
      t('GVue — erreur inattendue'),
      t('Une erreur est survenue mais l\'application reste ouverte.\n\n{error}\n\nDétails : {log}', {
        error: `${err?.message ?? err}`,
        log: getLogPath()
      })
    )
  }
})

process.on('unhandledRejection', (reason) => {
  logError('unhandledRejection', reason)
})

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
  registerLogHandlers()
  registerMenuHandlers()
  registerMcpHandlers()
  registerClipboardHandlers()
  registerBinHandlers()
  registerSshHandlers()
  registerSftpHandlers()
  registerIntegrationHandlers()
  registerTidyScriptHandlers()
  registerPickHandlers()
}

// Protocole gvue-file:// — sert les fichiers locaux au renderer (aperçu
// vidéo/audio/PDF) en streaming avec support des requêtes Range (seek).
// Doit être déclaré AVANT app.whenReady.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'gvue-file',
    privileges: { stream: true, supportFetchAPI: true, bypassCSP: true }
  }
])

function registerFileProtocol(): void {
  protocol.handle('gvue-file', (req) => {
    try {
      const raw = decodeURIComponent(new URL(req.url).pathname.replace(/^\//, ''))
      const p = normalize(raw)
      if (!isAbsolute(p) || p.includes('..')) return new Response(null, { status: 403 })
      // net.fetch sur file:// gère les en-têtes Range (seek dans les vidéos).
      return net.fetch(pathToFileURL(p).toString(), { headers: req.headers })
    } catch {
      return new Response(null, { status: 400 })
    }
  })
}

// Mode sélecteur (--pick --pick-out <fichier>) : instance transitoire lancée
// par un autre outil G (GRay…) pour choisir un fichier. Elle vit hors du
// verrou d'instance (l'instance principale peut tourner en parallèle), sans
// tray, sans mises à jour, sans MCP.
const pickOut = pickOutFromArgv(process.argv)

// Verrou d'instance unique : un seul *processus* GVue (les fenêtres multiples
// vivent dans ce processus). Évite que deux processus se disputent le cache
// (erreurs « Unable to move the cache »).
const gotLock = pickOut !== null || app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  // Relance de l'exécutable : « Ouvrir dans GVue » (Explorateur) passe le
  // dossier en argument → on y navigue dans la fenêtre existante ; sans
  // argument, on ouvre une nouvelle fenêtre (comportement historique).
  app.on('second-instance', (_e, argv) => {
    // « GVue.exe --workspace <nom> » (lancé par GRay) : on charge le profil
    // demandé dans la fenêtre existante, comme le fait le menu du plateau.
    const ws = workspaceFromArgv(argv)
    if (ws) {
      sendToWindow(IPC.trayLoadWorkspace, ws)
      return
    }
    void dirFromArgv(argv, app.isPackaged).then((dir) => {
      if (dir) sendToWindow(IPC.trayOpenPath, dir)
      else createWindow()
    })
  })

  app.whenReady().then(() => {
    logInfo('app', `GVue ${app.getVersion()} démarré (packagé: ${app.isPackaged}).`)
    registerIpc()
    registerFileProtocol()
    if (pickOut === null) {
      createTray()
      syncTidy()
    } else {
      setPickOut(pickOut)
    }
    const win = createWindow({ pick: pickOut !== null })
    if (pickOut !== null) {
      // Mode sélecteur : prévenir le renderer dès que la fenêtre est prête.
      win.webContents.once('did-finish-load', () => win.webContents.send(IPC.pickMode))
    } else {
      // Lancé avec un espace de travail en argument (GRay ouvre le profil du
      // projet) : on le charge dès que la fenêtre est prête.
      const ws = workspaceFromArgv(process.argv)
      if (ws) {
        win.webContents.once('did-finish-load', () =>
          win.webContents.send(IPC.trayLoadWorkspace, ws)
        )
      }
      // Lancé avec un dossier en argument (« Ouvrir dans GVue » alors que GVue
      // était fermé) : on y navigue dès que la fenêtre est prête.
      void dirFromArgv(process.argv, app.isPackaged).then((dir) => {
        if (dir)
          win.webContents.once('did-finish-load', () => win.webContents.send(IPC.trayOpenPath, dir))
      })
      initAutoUpdate()

      // Serveur MCP (agents IA) : opt-in, relancé si activé lors d'une session précédente.
      try {
        if (getConfig('mcpEnabled')) startMcpServer()
      } catch {
        /* config indisponible : reste désactivé */
      }
    }

    // Mort d'un process de rendu (page blanche) : on journalise pour diagnostic.
    app.on('render-process-gone', (_e, _wc, details) => {
      logError('render-process-gone', JSON.stringify(details))
    })
    app.on('child-process-gone', (_e, details) => {
      logError('child-process-gone', JSON.stringify(details))
    })

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
  stopMcpServer() // supprime aussi le fichier d'endpoint (jeton périmé)
  disconnectAll() // ferme proprement les sessions SFTP
})

app.on('window-all-closed', () => {
  // En production avec le plateau actif, GVue reste en arrière-plan quand toutes
  // les fenêtres sont fermées (on quitte via « Quitter GVue » dans le plateau).
  // En dev, on quitte normalement pour ne pas bloquer le redémarrage d'Electron
  // (verrou d'instance) à chaud.
  if (app.isPackaged && trayActive()) return
  if (process.platform !== 'darwin') app.quit()
})
