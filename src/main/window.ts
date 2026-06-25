import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { getConfig, setConfig } from './services/config-store'
import type { WindowState, WindowStatus } from '@shared/types'

/**
 * Création et état de la fenêtre.
 * Fenêtre frameless (barre de titre custom, cf. section 6) ; taille/position
 * restaurées depuis electron-store et resauvegardées à la fermeture.
 * Sécurité : contextIsolation true, nodeIntegration false, sandbox true.
 */
export function createWindow(): BrowserWindow {
  const saved = getConfig('window')

  const win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 760,
    minHeight: 520,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a1f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (saved.maximized) win.maximize()

  win.on('ready-to-show', () => win.show())

  // Liens externes → navigateur système, jamais dans la fenêtre app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
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

  // Chargement : dev server en HMR, fichier statique en production.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
