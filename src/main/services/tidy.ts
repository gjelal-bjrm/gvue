import { watch, type FSWatcher, promises as fsp } from 'node:fs'
import * as path from 'node:path'
import { app, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { TidyMovedEvent } from '@shared/types'
import { getConfig } from './config-store'
import { pushUndo } from './undo-stack'
import { isTempDownload, pickRule, renderSubfolder, freeName } from './tidy-rules'
import { t } from '../i18n'

/**
 * Rangement automatique des téléchargements (opt-in). Surveille le dossier
 * Téléchargements ; quand un fichier apparaît ET que sa taille est stable
 * (jamais un téléchargement en cours), la première règle correspondante le
 * déplace — avec sous-dossier optionnel ({date}, {ext}) et suffixe « (n) »
 * en cas de collision. Chaque déplacement est annulable (Ctrl+Z) et signalé
 * au renderer (toast).
 */

let watcher: FSWatcher | null = null
let watchedDir = ''
const pending = new Map<string, NodeJS.Timeout>()

function watchDir(): string {
  const cfg = getConfig('tidy')
  const dir = cfg?.watchDir?.trim()
  if (dir) return dir
  try {
    return app.getPath('downloads')
  } catch {
    return ''
  }
}

/** (Re)démarre ou arrête l'observateur selon la config — idempotent. */
export function syncTidy(): void {
  const cfg = getConfig('tidy')
  const dir = watchDir()
  const wanted = Boolean(cfg?.enabled && dir && cfg.rules.some((r) => r.enabled && r.destDir.trim()))

  if (!wanted || dir !== watchedDir) {
    watcher?.close()
    watcher = null
    watchedDir = ''
    for (const timer of pending.values()) clearTimeout(timer)
    pending.clear()
  }
  if (!wanted || watcher) return

  try {
    // persistent:false — l'observateur ne doit pas retenir le processus.
    watcher = watch(dir, { persistent: false }, (_event, fileName) => {
      if (fileName) schedule(dir, String(fileName))
    })
    watchedDir = dir
    // Volontairement AUCUN rattrapage de l'existant : activer la fonction ne
    // doit jamais vider d'un coup un dossier Téléchargements plein d'ancien.
    // Seuls les fichiers qui ARRIVENT après l'activation sont rangés.
  } catch {
    watcher = null
    watchedDir = ''
  }
}

/** Débounce par fichier : les navigateurs émettent des rafales d'événements. */
function schedule(dir: string, name: string): void {
  if (isTempDownload(name)) return
  const prev = pending.get(name)
  if (prev) clearTimeout(prev)
  pending.set(
    name,
    setTimeout(() => {
      pending.delete(name)
      void settleThenMove(dir, name, 0)
    }, 900)
  )
}

/**
 * Attend que la TAILLE soit stable entre deux mesures avant de déplacer —
 * on ne touche jamais un téléchargement en cours. Abandon après ~5 minutes.
 */
async function settleThenMove(dir: string, name: string, tries: number): Promise<void> {
  const full = path.join(dir, name)
  let stat
  try {
    stat = await fsp.stat(full)
  } catch {
    return // disparu (renommé par le navigateur, déjà déplacé…)
  }
  if (!stat.isFile()) return

  await new Promise((r) => setTimeout(r, 800))
  let after
  try {
    after = await fsp.stat(full)
  } catch {
    return
  }
  if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) {
    if (tries < 380) void settleThenMove(dir, name, tries + 1)
    return
  }

  const cfg = getConfig('tidy')
  if (!cfg?.enabled) return
  const rule = pickRule(cfg.rules, name)
  if (!rule) return

  const sub = rule.subfolder ? renderSubfolder(rule.subfolder, name, new Date()) : ''
  const destDir = sub ? path.join(rule.destDir.trim(), sub) : rule.destDir.trim()
  if (!path.isAbsolute(destDir)) return
  // Ne jamais « ranger » vers le dossier surveillé lui-même (boucle infinie).
  if (path.resolve(destDir).toLowerCase() === path.resolve(dir).toLowerCase()) return

  try {
    await fsp.mkdir(destDir, { recursive: true })
    const existing = new Set(await fsp.readdir(destDir))
    const finalName = freeName(existing, name)
    const to = path.join(destDir, finalName)
    try {
      await fsp.rename(full, to)
    } catch {
      // Autre volume (EXDEV) : copie puis suppression de la source.
      await fsp.copyFile(full, to)
      await fsp.unlink(full)
    }
    pushUndo({ kind: 'move', label: t('Rangement de « {name} »', { name: finalName }), pairs: [{ from: full, to }] })
    const payload: TidyMovedEvent = { name: finalName, toDir: destDir }
    BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.tidyMoved, payload)
  } catch {
    /* destination injoignable ou fichier verrouillé : on n'insiste pas. */
  }
}
