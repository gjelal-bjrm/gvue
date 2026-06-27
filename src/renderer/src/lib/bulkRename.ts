/**
 * Logique pure du renommage en masse — extraite du composant pour être testable
 * et réutilisable. Aucune dépendance React/DOM : entrées = noms + règles,
 * sorties = nouveaux noms + diagnostics (regex invalide, vides, doublons).
 */

export interface BulkRenameRules {
  find: string
  replace: string
  regex: boolean
  ci: boolean
  prefix: string
  suffix: string
  numbering: boolean
  start: number
  pad: number
  numPos: 'prefix' | 'suffix'
  numSep: string
}

export interface BulkRenameAnalysis {
  newNames: string[]
  regexError: boolean
  hasEmpty: boolean
  hasDup: boolean
  changedCount: number
  /** Vrai si l'opération ne doit pas être appliquée (rien à faire ou conflit). */
  blocked: boolean
}

/** Échappe une chaîne pour l'utiliser comme motif regex littéral. */
export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Calcule les nouveaux noms (et signale un motif regex invalide). */
export function computeNewNames(
  names: string[],
  r: BulkRenameRules
): { newNames: string[]; regexError: boolean } {
  let re: RegExp | null = null
  let regexError = false
  if (r.find) {
    try {
      re = new RegExp(r.regex ? r.find : escapeRe(r.find), 'g' + (r.ci ? 'i' : ''))
    } catch {
      regexError = true
    }
  }
  const newNames = names.map((name, i) => {
    let n = name
    if (re) n = n.replace(re, r.replace)
    const dot = n.lastIndexOf('.')
    let base = dot > 0 ? n.slice(0, dot) : n
    const ext = dot > 0 ? n.slice(dot) : ''
    base = r.prefix + base + r.suffix
    if (r.numbering) {
      const num = String(r.start + i).padStart(Math.max(1, r.pad), '0')
      base = r.numPos === 'prefix' ? num + r.numSep + base : base + r.numSep + num
    }
    return base + ext
  })
  return { newNames, regexError }
}

/** Analyse complète : noms calculés + conflits + indicateur de blocage. */
export function analyzeBulkRename(names: string[], r: BulkRenameRules): BulkRenameAnalysis {
  const { newNames, regexError } = computeNewNames(names, r)
  const counts = new Map<string, number>()
  for (const n of newNames) counts.set(n, (counts.get(n) ?? 0) + 1)
  const hasEmpty = newNames.some((n) => !n.trim())
  const hasDup = newNames.some((n) => (counts.get(n) ?? 0) > 1)
  const changedCount = newNames.filter((n, i) => n !== names[i]).length
  const blocked = regexError || hasEmpty || hasDup || changedCount === 0
  return { newNames, regexError, hasEmpty, hasDup, changedCount, blocked }
}
