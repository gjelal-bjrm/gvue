import { app, ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { t } from '../i18n'
import { logInfo } from './logger'
import { isTransientNetworkError, isNoReleaseError, friendlyUpdateError } from './updater-errors'
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
// Mémorise si la vérification courante a été déclenchée manuellement, pour ne
// pas afficher d'erreur lors des vérifications automatiques en arrière-plan.
let manualCheck = false

function broadcast(status: UpdateStatus): void {
  lastStatus = status
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(IPC.updateStatus, status)
  }
}

// Réessais des erreurs réseau transitoires (flux refusé, coupure, DNS…) :
// deux tentatives espacées avant d'embêter l'utilisateur.
const RETRY_DELAYS = [5_000, 20_000]
let retries = 0
let retryTimer: NodeJS.Timeout | null = null

/** Remise à zéro dès qu'une vérification aboutit (ou qu'on en relance une). */
function resetRetries(): void {
  retries = 0
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

// Traite une erreur de mise à jour sans inquiéter l'utilisateur :
// - erreur réseau passagère → réessai silencieux (le cas le plus fréquent) ;
// - « pas de release publiée » = rien à installer ;
// - le reste → message clair, visible seulement si vérification manuelle.
function reportError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e)

  // Réseau : on retente avant tout affichage — y compris en vérification
  // manuelle, où l'interface reste simplement sur « Recherche… ».
  if (isTransientNetworkError(msg) && !isNoReleaseError(msg) && retries < RETRY_DELAYS.length) {
    const delay = RETRY_DELAYS[retries]
    retries++
    logInfo('updater', `erreur réseau (${msg}) — nouvelle tentative dans ${delay / 1000} s`)
    if (manualCheck) broadcast({ state: 'checking' })
    retryTimer = setTimeout(() => {
      retryTimer = null
      runCheck(manualCheck)
    }, delay)
    return
  }

  resetRetries()
  if (!manualCheck) {
    // Vérification automatique en arrière-plan : on reste silencieux.
    broadcast({ state: 'idle' })
    return
  }
  if (isNoReleaseError(msg)) {
    // Distinct de « à jour » : aucune release VISIBLE. Les deux causes réelles
    // (dépôt de releases privé → 404 anonyme ; release restée en brouillon)
    // sont nommées, sinon le message n'aide personne à s'en sortir.
    broadcast({
      state: 'error',
      message: t(
        'Aucune release publiée n’est visible. Vérifiez que le dépôt des releases est public et que la release n’est pas restée en brouillon.'
      )
    })
  } else {
    broadcast({ state: 'error', message: t(friendlyUpdateError(msg)) })
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
    u.on('update-available', (i: { version?: string }) => {
      resetRetries()
      broadcast({ state: 'available', version: i?.version ?? '' })
    })
    u.on('update-not-available', (i: { version?: string }) => {
      resetRetries()
      broadcast({ state: 'none', version: i?.version ?? app.getVersion() })
    })
    u.on('download-progress', (p: { percent?: number }) =>
      broadcast({ state: 'downloading', percent: Math.round(p?.percent ?? 0) })
    )
    u.on('update-downloaded', (i: { version?: string }) => {
      resetRetries()
      broadcast({ state: 'ready', version: i?.version ?? '' })
    })
    u.on('error', (e: Error) => reportError(e))
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

/** Vérification effective (appelée aussi par les réessais réseau). */
function runCheck(manual: boolean): void {
  const u = loadUpdater()
  if (!u) {
    if (manual) broadcast({ state: 'unsupported' })
    return
  }
  manualCheck = manual
  if (manual) broadcast({ state: 'checking' })
  u.checkForUpdates().catch((e: unknown) => reportError(e))
}

/** Lance une vérification (manuelle ou auto). */
export function checkForUpdates(manual = false): void {
  if (!app.isPackaged) {
    if (manual) broadcast({ state: 'unsupported' })
    return
  }
  // Une demande explicite repart de zéro : le compteur de réessais ne doit
  // pas être épuisé par une panne réseau précédente.
  resetRetries()
  runCheck(manual)
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
