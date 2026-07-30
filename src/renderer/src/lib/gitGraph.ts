import type { GitCommit } from '@shared/types'

/**
 * Calcul des couloirs du graphe Git (façon GitKraken/gitk), pur et testable.
 *
 * Les commits arrivent du plus récent au plus ancien (--date-order garantit
 * qu'un enfant précède toujours ses parents). On maintient un tableau de
 * couloirs : chaque couloir « attend » un hash (le prochain commit de cette
 * ligne). Quand un commit arrive, toutes les lignes qui l'attendaient plongent
 * dans son point ; son premier parent hérite du couloir, les parents
 * supplémentaires (fusions) ouvrent ou rejoignent d'autres couloirs.
 */

export interface GraphRow {
  /** Couloir du point de ce commit. */
  lane: number
  /** Lignes qui traversent la rangée sans s'y arrêter (couloir stable). */
  passes: number[]
  /** Couloirs (bord haut) dont la ligne plonge dans le point. */
  intoDot: number[]
  /** Couloirs (bord bas) vers lesquels le point se prolonge (parents). */
  outOfDot: number[]
  /** Nombre de couloirs occupés sur cette rangée (largeur du dessin). */
  width: number
}

export function computeGraph(commits: GitCommit[]): GraphRow[] {
  const cols: (string | null)[] = []
  const rows: GraphRow[] = []

  const firstFree = (): number => {
    const i = cols.indexOf(null)
    return i >= 0 ? i : cols.length
  }

  for (const c of commits) {
    // Lignes venant du haut qui attendaient ce commit.
    const intoDot: number[] = []
    for (let i = 0; i < cols.length; i++) if (cols[i] === c.hash) intoDot.push(i)

    const lane = intoDot.length ? Math.min(...intoDot) : firstFree()

    // Lignes qui traversent : occupées avant et non concernées par ce commit.
    const passes: number[] = []
    for (let i = 0; i < cols.length; i++) {
      if (cols[i] !== null && cols[i] !== c.hash) passes.push(i)
    }

    // Les lignes entrantes se terminent ici.
    for (const i of intoDot) cols[i] = null

    // Premier parent : hérite du couloir du point.
    const outOfDot: number[] = []
    const p0 = c.parents[0]
    if (p0) {
      if (cols.length <= lane) cols.length = lane + 1
      // Remplit les trous éventuels créés par cols.length = lane + 1.
      for (let i = 0; i < cols.length; i++) if (cols[i] === undefined) cols[i] = null
      cols[lane] = p0
      outOfDot.push(lane)
    }

    // Parents supplémentaires (fusion) : rejoignent une ligne existante qui
    // attend déjà ce hash, sinon ouvrent un nouveau couloir.
    for (const p of c.parents.slice(1)) {
      const existing = cols.indexOf(p)
      if (existing >= 0 && existing !== lane) {
        outOfDot.push(existing)
      } else if (existing < 0) {
        const slot = firstFree()
        if (cols.length <= slot) cols.length = slot + 1
        for (let i = 0; i < cols.length; i++) if (cols[i] === undefined) cols[i] = null
        cols[slot] = p
        outOfDot.push(slot)
      }
    }

    // Taille de la rangée : couloirs actifs haut/bas + le point lui-même.
    let width = lane + 1
    for (const i of passes) width = Math.max(width, i + 1)
    for (const i of outOfDot) width = Math.max(width, i + 1)

    rows.push({ lane, passes, intoDot, outOfDot, width })

    // Compacte la fin du tableau pour limiter la largeur des rangées suivantes.
    while (cols.length && cols[cols.length - 1] === null) cols.pop()
  }

  return rows
}

/** Palette des couloirs — lisible sur thème clair comme sombre. */
export const LANE_COLORS = [
  '#4f8ef7',
  '#98c379',
  '#e06c75',
  '#c678dd',
  '#e5c07b',
  '#56b6c2',
  '#d19a66',
  '#8a919c'
] as const

/** Couleur d'un couloir (cyclique). */
export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length]
}

/** Décoration d'un commit : refs `%D` triées en branches / remotes / tags. */
export interface CommitDecorations {
  head: boolean
  branches: string[]
  remotes: string[]
  tags: string[]
}

export function parseRefs(refs: string[]): CommitDecorations {
  const d: CommitDecorations = { head: false, branches: [], remotes: [], tags: [] }
  for (const raw of refs) {
    let r = raw
    if (r.startsWith('HEAD -> ')) {
      d.head = true
      r = r.slice('HEAD -> '.length)
    } else if (r === 'HEAD') {
      d.head = true
      continue
    }
    if (r.startsWith('tag: ')) d.tags.push(r.slice(5))
    else if (r.includes('/')) d.remotes.push(r)
    else d.branches.push(r)
  }
  return d
}

/** Date relative compacte (« à l'instant », « il y a 3 h », « 12 mars »…). */
export function relativeDate(tsSeconds: number, nowMs: number): string {
  if (!tsSeconds) return ''
  const diff = Math.max(0, Math.floor(nowMs / 1000) - tsSeconds)
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`
  const d = new Date(tsSeconds * 1000)
  const sameYear = d.getFullYear() === new Date(nowMs).getFullYear()
  const day = d.getDate()
  const month = d.toLocaleDateString('fr-FR', { month: 'short' })
  return sameYear ? `${day} ${month}` : `${day} ${month} ${d.getFullYear()}`
}
