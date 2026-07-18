import { useEffect, useState } from 'react'
import type { DirEntry } from '@shared/types'

/**
 * Icônes système (façon Windows) pour les fichiers : récupérées à la demande
 * via `window.api.fs.icon` (vignette d'image ou icône de type associée),
 * mémoïsées côté renderer. Clé par extension (icône de type) ou par chemin
 * (exe/lnk/images, dont l'icône est propre). Les abonnés sont notifiés à chaque
 * arrivée d'icône pour rafraîchir les lignes visibles.
 */

const PER_FILE = new Set(['exe', 'lnk', 'ico', 'msi', 'cur', 'ani', 'scr', 'dll'])
const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff', 'tif'])

function extOf(name: string): string {
  const d = name.lastIndexOf('.')
  return d > 0 ? name.slice(d + 1).toLowerCase() : ''
}

/** Paliers de taille (px) : borne supérieure, pour maximiser les hits de cache. */
export function iconBucket(px: number): number {
  for (const b of [48, 96, 160, 256]) if (px <= b) return b
  return 256
}

function keyFor(entry: DirEntry, size: number): string {
  const ext = extOf(entry.name)
  const base = ext === '' || PER_FILE.has(ext) || IMAGE.has(ext) ? entry.path : `ext:${ext}`
  return `${size}:${base}`
}

const cache = new Map<string, string>()
const pending = new Set<string>()
const listeners = new Set<() => void>()

function getIcon(entry: DirEntry, size: number): string | null {
  const v = cache.get(keyFor(entry, size))
  return v ? v : null
}

function requestIcon(entry: DirEntry, size: number): void {
  const key = keyFor(entry, size)
  if (cache.has(key) || pending.has(key)) return
  pending.add(key)
  window.api.fs
    .icon(entry.path, size)
    .then((url) => {
      pending.delete(key)
      cache.set(key, url || '') // on mémorise même l'échec pour ne pas re-demander
      if (url) listeners.forEach((l) => l())
    })
    .catch(() => {
      pending.delete(key)
      cache.set(key, '')
    })
}

/**
 * Icône système d'un fichier (null tant qu'indisponible → repli sur l'icône
 * lucide). `size` en px : 48 pour la liste (défaut), la taille de tuile pour
 * la grille — les vignettes d'images sont générées à cette résolution.
 */
export function useOsIcon(entry: DirEntry, size = 48): string | null {
  const bucket = iconBucket(size)
  const [, bump] = useState(0)
  useEffect(() => {
    if (entry.kind !== 'file') return
    const onUpdate = (): void => bump((n) => n + 1)
    listeners.add(onUpdate)
    requestIcon(entry, bucket)
    return () => {
      listeners.delete(onUpdate)
    }
  }, [entry.path, entry.kind, bucket])
  // Repli visuel : si la grande taille n'est pas encore arrivée, sert la 48 px
  // déjà en cache (évite le « flash » d'icône lucide en zoomant).
  return entry.kind === 'file' ? getIcon(entry, bucket) ?? getIcon(entry, 48) : null
}
