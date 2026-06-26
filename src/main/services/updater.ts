import { app, ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { UpdateStatus } from '@shared/types'

/**
 * Mises à jour automatiques via `electron-updater` (flux GitHub Releases).
 *
 * La dépendance est **optionnelle** : si elle n'est pas installée, l'auto-update
 * est simplement inactif (état « unsupported ») et l'application fonctionne
 * normalement. Idem en développement (non empaqueté).
 *
 * Flux de publication : bump de version → `npm run publish` (téléverse
 * l'installeur + `latest.yml` sur une release GitHub) → les apps installées
 * détectent, téléchargent et installent la mise à jour.
 */

let lastStatus: UpdateStatus = { state: 'idle' }

function broadcast(status: UpdateStatus): void {
  lastStatus = status
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(IPC.updateStatus, status)
  }
}

// Charge electron-updater à la demande, en se passant de lui s'il est absent.
// Le require est indirect pour éviter une résolution statique à la compilation.
let cached: { autoUpdater: unknown } | null | undefined
function loadUpdater(): UpdaterLike | null {
  if (cached !== undefined) return cached ? (cached.autoUpdater as UpdaterLike) : null
  try {
    const moduleName = 'electron-updater'
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(moduleName)
    const u = mod.autoUpdater as UpdaterLike
    u.autoDownload = true
    u.autoInstallOnAppQuit = true
    u.on('checking-for-update', () => broadcast({ state: 'checking' }))
    u.on('update-available', (i: { version?: string }) =>
      broadcast({ state: 'available', version: i?.version ?? '' })
    )
    u.on('update-not-available', (i: { version?: string }) =>
      broadcast({ state: 'none', version: i?.version ?? app.getVersion() })
    )
    u.on('download-progress', (p: { percent?: number }) =>
      broadcast({ state: 'downloading', percent: Math.round(p?.percent ?? 0) })
    )
    u.on('update-downloaded', (i: { version?: string }) =>
      broadcast({ state: 'ready', version: i?.version ?? '' })
    )
    u.on('error', (e: Error) => broadcast({ state: 'error', message: e?.message ?? String(e) }))
    cached = { autoUpdater: u }
    return u
  } catch {
    cached = null
    return null
  }
}

/** Type minimal d'electron-updater (évite d'exiger ses types à la compilation). */
interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on(event: string, cb: (...args: never[]) => void): void
  checkForUpdates(): Promise<unknown>
  quitAndInstall(): void
}

/** Lance une vérification (manuelle ou auto). */
export function checkForUpdates(manual = false): void {
  if (!app.isPackaged) {
    if (manual) broadcast({ state: 'unsupported' })
    return
  }
  const u = loadUpdater()
  if (!u) {
    if (manual) broadcast({ state: 'unsupported' })
    return
  }
  if (manual) broadcast({ state: 'checking' })
  u.checkForUpdates().catch((e: Error) =>
    broadcast({ state: 'error', message: e?.message ?? String(e) })
  )
}

/** Vérifie au démarrage puis périodiquement (toutes les 6 h). */
export function initAutoUpdate(): void {
  if (!app.isPackaged) return
  checkForUpdates(false)
  setInterval(() => checkForUpdates(false), 6 * 60 * 60 * 1000)
}

export function registerUpdateHandlers(): void {
  ipcMain.handle(IPC.updateCheck, () => checkForUpdates(true))
  ipcMain.handle(IPC.updateInstall, () => {
    const u = loadUpdater()
    if (u) u.quitAndInstall()
  })
  ipcMain.handle(IPC.updateGet, () => ({ status: lastStatus, version: app.getVersion() }))
}
