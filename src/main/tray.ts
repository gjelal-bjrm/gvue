import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { basename, join } from 'node:path'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { IPC } from '@shared/ipc'
import { getConfig } from './services/config-store'
import { createWindow } from './window'
import { appIconPath } from './icon'
import { checkForUpdates } from './services/updater'

let runSeq = 0
/**
 * Exécute une commande dans une **console externe** (sans ouvrir GVue), façon
 * double-clic sur un .bat. On passe par un .cmd temporaire pour éviter les
 * cauchemars de quoting de `start`/cmd.
 */
async function runExternal(command: string, cwd: string, title: string): Promise<void> {
  try {
    if (process.platform !== 'win32') {
      spawn('sh', ['-c', command], { cwd, detached: true, stdio: 'ignore' }).unref()
      return
    }
    const file = join(tmpdir(), `gvue-run-${process.pid}-${++runSeq}.cmd`)
    const script = `@echo off\r\ntitle ${title}\r\ncd /d "${cwd}"\r\n${command}\r\n`
    await writeFile(file, script, 'utf8')
    spawn('cmd.exe', ['/c', 'start', '', file], {
      detached: true,
      windowsHide: false,
      stdio: 'ignore'
    }).unref()
  } catch {
    /* ignore */
  }
}

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
  const projectLaunch = getConfig('projectLaunch')
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

  // Un projet : ouvrir le dossier (dans GVue), et/ou lancer sa commande ▶ dans une
  // console externe (sans ouvrir GVue) si elle est définie.
  const projectItem = (root: string): Electron.MenuItemConstructorOptions => {
    const cmd = projectLaunch[root]
    if (!cmd) return folderItem(root)
    return {
      label: basename(root) || root,
      toolTip: root,
      submenu: [
        { label: 'Ouvrir le dossier', click: () => sendToWindow(IPC.trayOpenPath, root) },
        {
          label: 'Démarrer',
          toolTip: cmd,
          click: () => void runExternal(cmd, root, `GVue — ${basename(root)}`)
        },
        { label: 'Démarrer dans GVue', toolTip: cmd, click: () => sendToWindow(IPC.trayRunProject, root) }
      ]
    }
  }

  return Menu.buildFromTemplate([
    { label: 'Ouvrir GVue', click: () => showWindow() },
    { type: 'separator' },
    { label: 'Accès rapide', submenu: orEmpty(topFolders.map(folderItem)) },
    { label: 'Projets', submenu: orEmpty(projectRoots.map(projectItem)) },
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
    { label: 'Vérifier les mises à jour', click: () => checkForUpdates(true) },
    { label: `Version ${app.getVersion()}`, enabled: false },
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
