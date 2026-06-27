import type { GitCategory } from '@shared/types'

/** Lettre + couleur (variable de thème) associées à une catégorie Git. */
export function gitBadge(category: GitCategory): { letter: string; color: string } {
  switch (category) {
    case 'untracked':
      return { letter: 'U', color: 'var(--success-fg)' }
    case 'added':
      return { letter: 'A', color: 'var(--success-fg)' }
    case 'deleted':
      return { letter: 'D', color: 'var(--danger-fg)' }
    case 'renamed':
      return { letter: 'R', color: 'var(--info-fg)' }
    case 'conflict':
      return { letter: '!', color: 'var(--danger-fg)' }
    case 'ignored':
      return { letter: '·', color: 'var(--fg-muted)' }
    default:
      return { letter: 'M', color: 'var(--warning-fg)' }
  }
}

export const ARCHIVE_EXT = new Set([
  'zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'cab', 'iso', 'wim', 'lzh', 'arj', 'zipx'
])

/** Extension (minuscule, sans point) d'un nom de fichier, ou '' si aucune. */
export function extOf(name: string): string {
  const d = name.lastIndexOf('.')
  return d > 0 ? name.slice(d + 1).toLowerCase() : ''
}

/** Nom lisible d'un exécutable (basename sans « .exe »). */
export function programName(exe: string): string {
  return (exe.split(/[\\/]/).pop() ?? exe).replace(/\.exe$/i, '')
}

/** Dernier segment d'un chemin (basename), séparateurs Windows ou POSIX. */
export function baseSegment(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}
