import { describe, it, expect } from 'vitest'
import { computeGraph, parseRefs, relativeDate } from '@renderer/lib/gitGraph'
import type { GitCommit } from '@shared/types'

/** Commit minimal pour les tests de graphe. */
function c(hash: string, parents: string[], refs: string[] = []): GitCommit {
  return { hash, shortHash: hash.slice(0, 7), author: 'a', date: '', ts: 0, subject: hash, parents, refs }
}

describe('computeGraph', () => {
  it('trace une ligne droite pour un historique linéaire', () => {
    const rows = computeGraph([c('c3', ['c2']), c('c2', ['c1']), c('c1', [])])
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0])
    expect(rows[0].intoDot).toEqual([]) // le sommet n'a pas de ligne entrante
    expect(rows[1].intoDot).toEqual([0])
    expect(rows[2].outOfDot).toEqual([]) // le commit racine ne se prolonge pas
    expect(rows.every((r) => r.width === 1)).toBe(true)
  })

  it('ouvre un second couloir pour une fusion puis le referme', () => {
    // merge (m) de b dans main : m -> [a2, b1], a2 -> a1, b1 -> a1, a1 -> []
    const rows = computeGraph([
      c('m', ['a2', 'b1']),
      c('a2', ['a1']),
      c('b1', ['a1']),
      c('a1', [])
    ])
    expect(rows[0].lane).toBe(0)
    expect(rows[0].outOfDot).toEqual([0, 1]) // deux parents, deux couloirs
    expect(rows[1].lane).toBe(0)
    expect(rows[1].passes).toEqual([1]) // la ligne de b1 traverse la rangée de a2
    expect(rows[2].lane).toBe(1) // b1 vit dans le second couloir
    // a1 est attendu par les deux couloirs : ils convergent sur sa rangée.
    expect(rows[3].intoDot).toEqual([0, 1])
    expect(rows[3].lane).toBe(0)
  })

  it('affecte un nouveau couloir à une branche indépendante (--all)', () => {
    // Deux têtes sans lien affiché avant leur ancêtre commun hors fenêtre.
    const rows = computeGraph([c('x1', ['deep1']), c('y1', ['deep2'])])
    expect(rows[0].lane).toBe(0)
    expect(rows[1].lane).toBe(1)
  })

  it('réutilise les couloirs libérés', () => {
    const rows = computeGraph([
      c('m', ['a2', 'b1']),
      c('a2', ['a1']),
      c('b1', ['a1']),
      c('a1', ['a0']),
      c('t', ['a0']) // nouvelle tête après la convergence : couloir 1 de nouveau libre
    ])
    expect(rows[4].lane).toBe(1)
  })
})

describe('parseRefs', () => {
  it('sépare HEAD, branches, remotes et tags', () => {
    const d = parseRefs(['HEAD -> main', 'origin/main', 'tag: v1.2', 'dev'])
    expect(d.head).toBe(true)
    expect(d.branches).toEqual(['main', 'dev'])
    expect(d.remotes).toEqual(['origin/main'])
    expect(d.tags).toEqual(['v1.2'])
  })

  it('gère un HEAD détaché et une liste vide', () => {
    expect(parseRefs(['HEAD'])).toEqual({ head: true, branches: [], remotes: [], tags: [] })
    expect(parseRefs([])).toEqual({ head: false, branches: [], remotes: [], tags: [] })
  })
})

describe('relativeDate', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0) // 30 juillet 2026, midi UTC
  const s = (secondsAgo: number): number => Math.floor(now / 1000) - secondsAgo

  it('formate les durées récentes', () => {
    expect(relativeDate(s(10), now)).toBe("à l'instant")
    expect(relativeDate(s(5 * 60), now)).toBe('il y a 5 min')
    expect(relativeDate(s(3 * 3600), now)).toBe('il y a 3 h')
    expect(relativeDate(s(2 * 86400), now)).toBe('il y a 2 j')
  })

  it('bascule sur la date au-delà d’une semaine et gère ts=0', () => {
    expect(relativeDate(s(30 * 86400), now)).toMatch(/^\d{1,2} /)
    expect(relativeDate(0, now)).toBe('')
  })
})
