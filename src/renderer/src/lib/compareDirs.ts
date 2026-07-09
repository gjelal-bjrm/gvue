import type { DirEntry } from '@shared/types'

/**
 * Comparaison superficielle (niveau courant) de deux dossiers, à partir des
 * entrées déjà chargées par les volets — logique pure, testable.
 * Appariement par nom insensible à la casse (sémantique Windows).
 */

export type DiffReason = 'kind' | 'size' | 'date'

export interface CompareRow {
  name: string
  left: DirEntry
  right: DirEntry
  reason: DiffReason
}

export interface CompareResult {
  onlyLeft: DirEntry[]
  onlyRight: DirEntry[]
  different: CompareRow[]
  /** Nombre d'entrées jugées identiques (nom + type + taille/date). */
  identical: number
}

// FAT/exFAT arrondissent les mtimes à 2 s : en dessous de cette tolérance, deux
// horodatages sont considérés égaux (sinon toute copie vers une clé USB
// apparaîtrait « différente »).
const MTIME_TOLERANCE_MS = 2000

const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name, undefined, { numeric: true })

export function compareDirs(left: DirEntry[], right: DirEntry[]): CompareResult {
  const rightByKey = new Map<string, DirEntry>()
  for (const e of right) rightByKey.set(e.name.toLowerCase(), e)

  const onlyLeft: DirEntry[] = []
  const different: CompareRow[] = []
  let identical = 0
  const matchedRight = new Set<string>()

  for (const l of left) {
    const key = l.name.toLowerCase()
    const r = rightByKey.get(key)
    if (!r) {
      onlyLeft.push(l)
      continue
    }
    matchedRight.add(key)
    if (l.kind !== r.kind) {
      different.push({ name: l.name, left: l, right: r, reason: 'kind' })
    } else if (l.kind === 'file' && l.size !== r.size) {
      different.push({ name: l.name, left: l, right: r, reason: 'size' })
    } else if (l.kind === 'file' && Math.abs(l.modifiedMs - r.modifiedMs) > MTIME_TOLERANCE_MS) {
      different.push({ name: l.name, left: l, right: r, reason: 'date' })
    } else {
      // Dossiers de même nom : identiques au sens superficiel (contenu non parcouru).
      identical++
    }
  }

  const onlyRight = right.filter((e) => !matchedRight.has(e.name.toLowerCase()))

  return {
    onlyLeft: [...onlyLeft].sort(byName),
    onlyRight: [...onlyRight].sort(byName),
    different: [...different].sort(byName),
    identical
  }
}
