import { describe, it, expect } from 'vitest'
import { lassoIndices, normRect } from '@renderer/components/filelist/lasso'

describe('normRect', () => {
  it('ordonne les coins quel que soit le sens du glisser', () => {
    expect(normRect({ x1: 100, y1: 80, x2: 20, y2: 10 })).toEqual({
      left: 20,
      top: 10,
      right: 100,
      bottom: 80
    })
  })
})

describe('lassoIndices — liste', () => {
  const layout = { mode: 'list' as const, rowHeight: 30, cols: 1, colWidth: 0, padX: 0, count: 10 }

  it('sélectionne les lignes traversées verticalement', () => {
    // De y=35 (ligne 1) à y=95 (ligne 3).
    expect(lassoIndices({ x1: 5, y1: 35, x2: 50, y2: 95 }, layout)).toEqual([1, 2, 3])
  })

  it('borne aux éléments existants', () => {
    expect(lassoIndices({ x1: 0, y1: 250, x2: 10, y2: 900 }, layout)).toEqual([8, 9])
  })

  it('un glisser minuscule sélectionne la ligne sous le curseur', () => {
    expect(lassoIndices({ x1: 10, y1: 45, x2: 12, y2: 47 }, layout)).toEqual([1])
  })

  it('liste vide → rien', () => {
    expect(lassoIndices({ x1: 0, y1: 0, x2: 50, y2: 50 }, { ...layout, count: 0 })).toEqual([])
  })
})

describe('lassoIndices — grille', () => {
  // 3 colonnes de 100 px, rangées de 120 px, 8 tuiles (dernière rangée incomplète).
  const layout = { mode: 'grid' as const, rowHeight: 120, cols: 3, colWidth: 100, padX: 4, count: 8 }

  it('sélectionne le bloc rectangulaire de tuiles', () => {
    // Colonnes 1-2 des rangées 0-1 → indices 1,2,4,5.
    expect(lassoIndices({ x1: 110, y1: 10, x2: 290, y2: 130 }, layout)).toEqual([1, 2, 4, 5])
  })

  it('ignore les cellules au-delà du dernier élément', () => {
    // Rangée 2 entière : indices 6,7 (la cellule 8 n'existe pas).
    expect(lassoIndices({ x1: 5, y1: 250, x2: 295, y2: 300 }, layout)).toEqual([6, 7])
  })

  it('reste dans les bornes de colonnes à droite', () => {
    // x très à droite → dernière colonne seulement.
    expect(lassoIndices({ x1: 250, y1: 0, x2: 900, y2: 50 }, layout)).toEqual([2])
  })
})
