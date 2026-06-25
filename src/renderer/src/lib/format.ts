import type { DirEntry } from '@shared/types'

/** Joint un nom d'enfant à un chemin parent en devinant le séparateur. */
export function childPath(parent: string, name: string): string {
  const sep = parent.includes('\\') ? '\\' : '/'
  return parent.endsWith(sep) ? `${parent}${name}` : `${parent}${sep}${name}`
}

/** Dossier parent d'un chemin absolu (sépare sur « \ » ou « / »). */
export function parentPath(p: string): string {
  const idx = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return idx <= 0 ? p : p.slice(0, idx)
}

/** Dernier segment (nom) d'un chemin. */
export function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

/** Chemin affiché relativement à un dossier racine, séparateurs « / ». */
export function relativeTo(base: string, full: string): string {
  const norm = (s: string): string => s.replace(/[\\/]+/g, '/').replace(/\/$/, '')
  const b = norm(base)
  const f = norm(full)
  return f.startsWith(b + '/') ? f.slice(b.length + 1) : f
}

/** Formate une taille en octets de façon lisible. */
export function formatSize(bytes: number, kind: DirEntry['kind']): string {
  if (kind === 'directory') return ''
  if (bytes < 1024) return `${bytes} o`
  const units = ['Ko', 'Mo', 'Go', 'To']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

/** Formate une date epoch ms en chaîne courte locale (tooltip). */
export function formatDate(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Date relative façon explorateur : aujourd'hui → heure, hier → « hier »,
 * cette semaine → jour court, au-delà → date courte.
 */
export function formatRelativeDate(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayMs = 86_400_000
  const diffDays = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / dayMs)

  if (diffDays <= 0) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return 'hier'
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' })
  }
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
}

/** Découpe un chemin absolu en segments pour le fil d'Ariane. */
export function breadcrumbSegments(p: string): { label: string; path: string }[] {
  const isWin = /^[a-zA-Z]:[\\/]/.test(p)
  const sep = isWin ? '\\' : '/'
  const parts = p.split(/[\\/]+/).filter(Boolean)
  const segments: { label: string; path: string }[] = []
  let acc = ''
  parts.forEach((part, idx) => {
    if (isWin && idx === 0) {
      acc = part + sep // « C: » → « C:\ »
      segments.push({ label: part, path: acc })
    } else {
      acc = acc ? `${acc}${acc.endsWith(sep) ? '' : sep}${part}` : sep + part
      segments.push({ label: part, path: acc })
    }
  })
  if (!isWin && segments.length === 0) {
    segments.push({ label: '/', path: '/' })
  }
  return segments
}
