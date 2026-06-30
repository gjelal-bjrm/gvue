import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { getConfig, setConfig } from './services/config-store'
import { appIconPath } from './icon'
import type { WindowState, WindowStatus } from '@shared/types'

/**
 * Création et état de la fenêtre.
 * Fenêtre frameless (barre de titre custom, cf. section 6) ; taille/position
 * restaurées depuis electron-store et resauvegardées à la fermeture.
 * Sécurité : contextIsolation true, nodeIntegration false, sandbox true.
 */
export function createWindow(): BrowserWindow {
  const saved = getConfig('window')

  // Icône de fenêtre (barre des tâches en dev) ; en production, l'icône de
  // l'exécutable est posée par l'empaqueteur.
  const iconPath = appIconPath()

  // Décale les fenêtres supplémentaires pour qu'elles ne se superposent pas.
  const existing = BrowserWindow.getAllWindows().length
  const offset = existing * 28

  const win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x != null ? saved.x + offset : undefined,
    y: saved.y != null ? saved.y + offset : undefined,
    minWidth: 760,
    minHeight: 520,
    show: false,
    frame: false,
    icon: iconPath ?? undefined,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a1f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Seule la première fenêtre restaure l'état maximisé (sinon elles se couvrent).
  if (saved.maximized && existing === 0) win.maximize()

  win.on('ready-to-show', () => win.show())

  // Liens externes → navigateur système, jamais dans la fenêtre app. On ne
  // transmet à l'OS que des URL web (évite « about:blank » → dialogue Windows
  // « aucune application pour ce lien »).
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const scheme = new URL(url).protocol
      if (scheme === 'http:' || scheme === 'https:' || scheme === 'mailto:') {
        void shell.openExternal(url)
      }
    } catch {
      /* URL invalide (ex. about:blank) : ignorée */
    }
    return { action: 'deny' }
  })

  // Persistance de l'état fenêtre.
  const persist = (): void => {
    if (win.isDestroyed()) return
    const bounds = win.getBounds()
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: win.isMaximized()
    }
    setConfig('window', state)
  }
  win.on('close', persist)

  // Notifie le renderer pour basculer l'icône agrandir/restaurer.
  const emitStatus = (): void => {
    if (win.isDestroyed()) return
    const status: WindowStatus = { maximized: win.isMaximized() }
    win.webContents.send(IPC.windowOnStatus, status)
  }
  win.on('maximize', emitStatus)
  win.on('unmaximize', emitStatus)

  // Boutons latéraux de la souris (précédent / suivant) : sous Windows ils
  // émettent l'événement « app-command ». On les relaie au renderer, qui pilote
  // l'historique de navigation interne.
  win.on('app-command', (e, command) => {
    if (command === 'browser-backward') {
      win.webContents.send(IPC.navOnCommand, 'back')
      e.preventDefault()
    } else if (command === 'browser-forward') {
      win.webContents.send(IPC.navOnCommand, 'forward')
      e.preventDefault()
    }
  })

  // Chargement : dev server en HMR, fichier statique en production.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
