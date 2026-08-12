import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { basename, join } from 'node:path'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { IPC } from '@shared/ipc'
import { getConfig, setConfig } from './services/config-store'
import { syncTidy } from './services/tidy'
import { createWindow } from './window'
import { appIconPath } from './icon'
import { checkForUpdates } from './services/updater'
import { readSshConfigHosts } from './services/ssh-config'
import { t } from './i18n'
import type { SshHost } from '@shared/types'

// Hôtes du ~/.ssh/config, rafraîchis à chaque ouverture du menu (lecture
// asynchrone → cache utilisé par le buildMenu synchrone).
let sshConfigHosts: SshHost[] = []

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
// Exporté : réutilisé par le serveur MCP (navigate / run_launch_task).
export function sendToWindow(channel: string, payload: unknown): void {
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
    items.length ? items : [{ label: t('(vide)'), enabled: false }]

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
        { label: t('Ouvrir le dossier'), click: () => sendToWindow(IPC.trayOpenPath, root) },
        {
          label: t('Démarrer'),
          toolTip: cmd,
          click: () => void runExternal(cmd, root, `GVue — ${basename(root)}`)
        },
        { label: t('Démarrer dans GVue'), toolTip: cmd, click: () => sendToWindow(IPC.trayRunProject, root) }
      ]
    }
  }

  // Un serveur SSH : terminal ou explorateur de fichiers (SFTP) dans GVue.
  const serverItem = (h: SshHost): Electron.MenuItemConstructorOptions => ({
    label: h.name,
    toolTip: h.hostName ?? h.name,
    submenu: [
      { label: t('Terminal SSH'), click: () => sendToWindow(IPC.trayOpenSsh, h) },
      { label: t('Fichiers (SFTP)'), click: () => sendToWindow(IPC.trayBrowseSsh, h) }
    ]
  })
  // Respecte le réglage « import à la demande » et évite les doublons.
  const manual = getConfig('sshHosts')
  const autoList = getConfig('sshConfigAutoList') !== false
  const servers = [
    ...(autoList ? sshConfigHosts.filter((h) => !manual.some((m) => m.name === h.name)) : []),
    ...manual
  ]

  return Menu.buildFromTemplate([
    { label: t('Ouvrir GVue'), click: () => showWindow() },
    { type: 'separator' },
    { label: t('Accès rapide'), submenu: orEmpty(topFolders.map(folderItem)) },
    { label: t('Projets'), submenu: orEmpty(projectRoots.map(projectItem)) },
    { label: t('SSH / SFTP'), submenu: orEmpty(servers.map(serverItem)) },
    {
      label: t('Lancements'),
      submenu: orEmpty([
        ...tasks.map((task) => ({
          label: task.name,
          click: () => sendToWindow(IPC.trayRunTask, task.id)
        })),
        ...(profiles.length
          ? ([{ type: 'separator' as const }] as Electron.MenuItemConstructorOptions[]).concat(
              profiles.map((p) => ({
                label: t('Profil : {name}', { name: p.name }),
                click: () => sendToWindow(IPC.trayRunTask, p.id)
              }))
            )
          : [])
      ])
    },
    {
      label: t('Espaces de travail'),
      submenu: orEmpty(
        Object.keys(workspaces).map((n) => ({
          label: n,
          click: () => sendToWindow(IPC.trayLoadWorkspace, n)
        }))
      )
    },
    { type: 'separator' },
    {
      // Interrupteur express du rangement auto (demande : « s'active et se
      // désactive facilement ») — la config détaillée reste dans Paramètres.
      label: t('Rangement auto des téléchargements'),
      type: 'checkbox',
      checked: getConfig('tidy')?.enabled ?? false,
      click: (item) => {
        const cfg = getConfig('tidy')
        setConfig('tidy', { ...cfg, enabled: item.checked })
        syncTidy()
      }
    },
    { type: 'separator' },
    { label: t('Vérifier les mises à jour'), click: () => checkForUpdates(true) },
    { label: t('Version {v}', { v: app.getVersion() }), enabled: false },
    { type: 'separator' },
    { label: t('Quitter GVue'), click: () => app.quit() }
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
  // Menu reconstruit à chaque clic droit (données fraîches depuis la config ;
  // les hôtes du ~/.ssh/config sont relus juste avant l'affichage).
  tray.on('right-click', () => {
    void readSshConfigHosts()
      .then((h) => {
        sshConfigHosts = h
      })
      .catch(() => undefined)
      .then(() => tray?.popUpContextMenu(buildMenu()))
  })
  // Repli Windows : clic gauche (et double-clic) ouvre/affiche la fenêtre.
  tray.on('click', () => showWindow())
  tray.on('double-click', () => showWindow())
  // Menu par défaut (clic droit natif sur certaines plateformes).
  tray.setContextMenu(buildMenu())
}
