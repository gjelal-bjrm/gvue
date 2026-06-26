import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { basename } from 'node:path'
import { IPC } from '@shared/ipc'
import { getConfig } from './services/config-store'
import { createWindow } from './window'
import { appIconPath } from './icon'

/**
 * Plateau système (tray) : permet à GVue de rester en arrière-plan (fenêtre
 * fermée) et offre un menu d'actions rapides (accès rapide, projets, lancements,
 * espaces de travail) reconstruit à chaque ouverture à partir de la config.
 */
let tray: Tray | null = null

/** Le plateau est-il actif ? (sinon, fermer toutes les fenêtres quitte l'app.) */
export function trayActive(): boolean {
  return tray !== null
}

// Affiche/restaure une fenêtre existante, ou en crée une.
function showWindow(): BrowserWindow {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return win
  }
  return createWindow()
}

// Envoie un message au renderer (fenêtre existante, ou nouvelle après chargement).
function sendToWindow(channel: string, payload: string): void {
  const existing = BrowserWindow.getAllWindows()[0]
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    existing.webContents.send(channel, payload)
  } else {
    const win = createWindow()
    win.webContents.once('did-finish-load', () => win.webContents.send(channel, payload))
  }
}

function buildMenu(): Menu {
  const folderFreq = getConfig('folderFreq')
  const projectRoots = getConfig('projectRoots')
  const tasks = getConfig('runnerTasks')
  const profiles = getConfig('runnerProfiles')
  const workspaces = getConfig('workspaces')

  const topFolders = Object.entries(folderFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([p]) => p)

  // Garantit un sous-menu non vide (sinon Electron masque l'entrée).
  const orEmpty = (items: Electron.MenuItemConstructorOptions[]): Electron.MenuItemConstructorOptions[] =>
    items.length ? items : [{ label: '(vide)', enabled: false }]

  const folderItem = (p: string): Electron.MenuItemConstructorOptions => ({
    label: basename(p) || p,
    toolTip: p,
    click: () => sendToWindow(IPC.trayOpenPath, p)
  })

  return Menu.buildFromTemplate([
    { label: 'Ouvrir GVue', click: () => showWindow() },
    { type: 'separator' },
    { label: 'Accès rapide', submenu: orEmpty(topFolders.map(folderItem)) },
    { label: 'Projets', submenu: orEmpty(projectRoots.map(folderItem)) },
    {
      label: 'Lancements',
      submenu: orEmpty([
        ...tasks.map((t) => ({
          label: t.name,
          click: () => sendToWindow(IPC.trayRunTask, t.id)
        })),
        ...(profiles.length
          ? ([{ type: 'separator' as const }] as Electron.MenuItemConstructorOptions[]).concat(
              profiles.map((p) => ({
                label: `Profil : ${p.name}`,
                click: () => sendToWindow(IPC.trayRunTask, p.id)
              }))
            )
          : [])
      ])
    },
    {
      label: 'Espaces de travail',
      submenu: orEmpty(
        Object.keys(workspaces).map((n) => ({
          label: n,
          click: () => sendToWindow(IPC.trayLoadWorkspace, n)
        }))
      )
    },
    { type: 'separator' },
    { label: 'Quitter GVue', click: () => app.quit() }
  ])
}

/** Crée l'icône du plateau (si l'icône est disponible). */
export function createTray(): void {
  if (tray) return
  const iconPath = appIconPath()
  if (!iconPath) return
  const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(image)
  tray.setToolTip('GVue')
  // Menu reconstruit à chaque clic droit (données fraîches depuis la config).
  tray.on('right-click', () => tray?.popUpContextMenu(buildMenu()))
  // Repli Windows : clic gauche (et double-clic) ouvre/affiche la fenêtre.
  tray.on('click', () => showWindow())
  tray.on('double-click', () => showWindow())
  // Menu par défaut (clic droit natif sur certaines plateformes).
  tray.setContextMenu(buildMenu())
}
