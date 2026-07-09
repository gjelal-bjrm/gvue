import { describe, it, expect } from 'vitest'
import { compareDirs } from '@renderer/lib/compareDirs'
import type { DirEntry } from '../src/shared/types'

function entry(name: string, over: Partial<DirEntry> = {}): DirEntry {
  return {
    name,
    path: `C:/x/${name}`,
    kind: 'file',
    size: 100,
    modifiedMs: 1_700_000_000_000,
    hidden: false,
    symlink: false,
    ...over
  }
}

describe('compareDirs', () => {
  it('sépare uniquement-gauche / uniquement-droite', () => {
    const r = compareDirs([entry('a.txt'), entry('b.txt')], [entry('b.txt'), entry('c.txt')])
    expect(r.onlyLeft.map((e) => e.name)).toEqual(['a.txt'])
    expect(r.onlyRight.map((e) => e.name)).toEqual(['c.txt'])
    expect(r.identical).toBe(1)
    expect(r.different).toEqual([])
  })

  it('apparie sans tenir compte de la casse (sémantique Windows)', () => {
    const r = compareDirs([entry('README.md')], [entry('readme.md')])
    expect(r.onlyLeft).toEqual([])
    expect(r.onlyRight).toEqual([])
    expect(r.identical).toBe(1)
  })

  it('détecte une différence de taille', () => {
    const r = compareDirs([entry('a.txt', { size: 10 })], [entry('a.txt', { size: 20 })])
    expect(r.different).toHaveLength(1)
    expect(r.different[0].reason).toBe('size')
  })

  it('détecte une différence de date au-delà de la tolérance de 2 s', () => {
    const base = 1_700_000_000_000
    const same = compareDirs(
      [entry('a.txt', { modifiedMs: base })],
      [entry('a.txt', { modifiedMs: base + 1500 })]
    )
    expect(same.identical).toBe(1) // sous la tolérance FAT

    const diff = compareDirs(
      [entry('a.txt', { modifiedMs: base })],
      [entry('a.txt', { modifiedMs: base + 5000 })]
    )
    expect(diff.different[0]?.reason).toBe('date')
  })

  it('signale un conflit de type fichier/dossier', () => {
    const r = compareDirs([entry('x', { kind: 'file' })], [entry('x', { kind: 'directory' })])
    expect(r.different[0]?.reason).toBe('kind')
  })

  it('deux dossiers de même nom sont identiques au sens superficiel', () => {
    const r = compareDirs(
      [entry('src', { kind: 'directory', size: 0 })],
      [entry('src', { kind: 'directory', size: 0 })]
    )
    expect(r.identical).toBe(1)
  })

  it('trie les résultats par nom (numérique)', () => {
    const r = compareDirs([entry('f10.txt'), entry('f2.txt')], [])
    expect(r.onlyLeft.map((e) => e.name)).toEqual(['f2.txt', 'f10.txt'])
  })
})
