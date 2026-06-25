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

function keyFor(entry: DirEntry): string {
  const ext = extOf(entry.name)
  if (ext === '' || PER_FILE.has(ext) || IMAGE.has(ext)) return entry.path
  return `ext:${ext}`
}

const cache = new Map<string, string>()
const pending = new Set<string>()
const listeners = new Set<() => void>()

function getIcon(entry: DirEntry): string | null {
  const v = cache.get(keyFor(entry))
  return v ? v : null
}

function requestIcon(entry: DirEntry): void {
  const key = keyFor(entry)
  if (cache.has(key) || pending.has(key)) return
  pending.add(key)
  window.api.fs
    .icon(entry.path)
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

/** Icône système d'un fichier (null tant qu'indisponible → repli sur l'icône lucide). */
export function useOsIcon(entry: DirEntry): string | null {
  const [, bump] = useState(0)
  useEffect(() => {
    if (entry.kind !== 'file') return
    const onUpdate = (): void => bump((n) => n + 1)
    listeners.add(onUpdate)
    requestIcon(entry)
    return () => {
      listeners.delete(onUpdate)
    }
  }, [entry.path, entry.kind])
  return entry.kind === 'file' ? getIcon(entry) : null
}
