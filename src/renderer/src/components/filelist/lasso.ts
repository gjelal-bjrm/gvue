/**
 * Géométrie du lasso de sélection (rectangle à la souris), pure et testable.
 * La liste étant virtualisée, on ne teste pas les nœuds DOM : les positions
 * des lignes/tuiles sont entièrement déterminées par leur index (hauteur de
 * ligne fixe en liste, grille régulière en vue grille) — on convertit donc le
 * rectangle (coordonnées de contenu, défilement inclus) en plage d'index.
 */

export interface LassoRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Rectangle normalisé (coins ordonnés). */
export function normRect(r: LassoRect): { left: number; top: number; right: number; bottom: number } {
  return {
    left: Math.min(r.x1, r.x2),
    top: Math.min(r.y1, r.y2),
    right: Math.max(r.x1, r.x2),
    bottom: Math.max(r.y1, r.y2)
  }
}

export interface LassoLayout {
  mode: 'list' | 'grid'
  /** Hauteur d'une ligne (liste) ou d'une rangée de tuiles (grille). */
  rowHeight: number
  /** Tuiles par rangée (1 en liste). */
  cols: number
  /** Largeur d'une cellule de grille (px) — ignorée en liste. */
  colWidth: number
  /** Marge horizontale avant la première colonne (px-1 → 4). */
  padX: number
  /** Nombre d'éléments visibles. */
  count: number
}

/** Indices des éléments intersectés par le rectangle du lasso. */
export function lassoIndices(rect: LassoRect, l: LassoLayout): number[] {
  const { left, top, right, bottom } = normRect(rect)
  if (l.count === 0 || l.rowHeight <= 0) return []

  const rowFrom = Math.max(0, Math.floor(top / l.rowHeight))
  const rowTo = Math.max(0, Math.floor(bottom / l.rowHeight))

  if (l.mode === 'list') {
    const out: number[] = []
    for (let i = rowFrom; i <= rowTo && i < l.count; i++) out.push(i)
    return out
  }

  // Grille : intersection aussi sur les colonnes.
  const cw = l.colWidth > 0 ? l.colWidth : 1
  const colFrom = Math.max(0, Math.floor((left - l.padX) / cw))
  const colTo = Math.min(l.cols - 1, Math.max(0, Math.floor((right - l.padX) / cw)))
  const out: number[] = []
  for (let r = rowFrom; r <= rowTo; r++) {
    for (let c = colFrom; c <= colTo; c++) {
      const i = r * l.cols + c
      if (i < l.count) out.push(i)
    }
  }
  return out
}
