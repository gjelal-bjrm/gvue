import { watch, type FSWatcher } from 'node:fs'

/**
 * Surveillance du dossier affiché (un seul à la fois). Utilise `fs.watch`
 * natif — pas de dépendance (chokidar évité). Non récursif : on observe les
 * entrées directes du dossier courant (création/suppression/renommage), ce qui
 * suffit à rafraîchir la liste. Les événements sont débattus pour coalescer les
 * rafales (build qui écrit plusieurs fichiers, par ex.).
 */

let current: { dir: string; watcher: FSWatcher } | null = null
let timer: ReturnType<typeof setTimeout> | null = null

const DEBOUNCE_MS = 200

/** Surveille `dir` (remplace la surveillance précédente). No-op si déjà surveillé. */
export function watchDir(dir: string, emit: (dir: string) => void): void {
  if (current && current.dir === dir) return
  closeWatch()
  try {
    const watcher = watch(dir, { persistent: false }, () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => emit(dir), DEBOUNCE_MS)
    })
    // Dossier supprimé, permissions, volume retiré… : on abandonne sans planter.
    watcher.on('error', closeWatch)
    current = { dir, watcher }
  } catch {
    current = null
  }
}

/** Arrête la surveillance en cours (changement de dossier, fermeture de l'app). */
export function closeWatch(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (current) {
    try {
      current.watcher.close()
    } catch {
      /* déjà fermé */
    }
    current = null
  }
}
