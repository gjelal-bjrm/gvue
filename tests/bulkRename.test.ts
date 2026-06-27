import { describe, it, expect } from 'vitest'
import {
  escapeRe,
  computeNewNames,
  analyzeBulkRename,
  type BulkRenameRules
} from '@renderer/lib/bulkRename'

const base: BulkRenameRules = {
  find: '',
  replace: '',
  regex: false,
  ci: false,
  prefix: '',
  suffix: '',
  numbering: false,
  start: 1,
  pad: 2,
  numPos: 'suffix',
  numSep: '_'
}

describe('escapeRe', () => {
  it('échappe les métacaractères regex', () => {
    expect(escapeRe('a.b*c')).toBe('a\\.b\\*c')
    expect(escapeRe('(x)[y]')).toBe('\\(x\\)\\[y\\]')
  })
})

describe('computeNewNames', () => {
  it('rechercher/remplacer littéral n’interprète pas les points', () => {
    const { newNames } = computeNewNames(['a.txt', 'ab.txt'], { ...base, find: '.', replace: '_' })
    // « . » littéral → seul le point est remplacé, pas chaque caractère.
    expect(newNames).toEqual(['a_txt', 'ab_txt'])
  })

  it('mode regex interprète le motif', () => {
    const { newNames } = computeNewNames(['img1.png', 'img2.png'], {
      ...base,
      find: '\\d',
      replace: '#',
      regex: true
    })
    expect(newNames).toEqual(['img#.png', 'img#.png'])
  })

  it('signale un motif regex invalide sans planter', () => {
    const { regexError, newNames } = computeNewNames(['a'], { ...base, find: '(', regex: true })
    expect(regexError).toBe(true)
    expect(newNames).toEqual(['a'])
  })

  it('préfixe et suffixe préservent l’extension', () => {
    const { newNames } = computeNewNames(['photo.jpg'], { ...base, prefix: 'v_', suffix: '_ok' })
    expect(newNames).toEqual(['v_photo_ok.jpg'])
  })

  it('numérotation suffixe avec padding', () => {
    const { newNames } = computeNewNames(['a.txt', 'b.txt', 'c.txt'], {
      ...base,
      numbering: true,
      start: 1,
      pad: 3,
      numPos: 'suffix',
      numSep: '-'
    })
    expect(newNames).toEqual(['a-001.txt', 'b-002.txt', 'c-003.txt'])
  })

  it('numérotation préfixe', () => {
    const { newNames } = computeNewNames(['x.md'], {
      ...base,
      numbering: true,
      start: 5,
      pad: 2,
      numPos: 'prefix',
      numSep: '.'
    })
    expect(newNames).toEqual(['05.x.md'])
  })

  it('fichier sans extension : pas de point ajouté', () => {
    const { newNames } = computeNewNames(['README'], { ...base, suffix: '_v2' })
    expect(newNames).toEqual(['README_v2'])
  })

  it('fichier caché (point en tête) n’est pas traité comme extension', () => {
    const { newNames } = computeNewNames(['.gitignore'], { ...base, prefix: 'x' })
    // lastIndexOf('.') === 0 → dot > 0 est faux → tout le nom est la base.
    expect(newNames).toEqual(['x.gitignore'])
  })
})

describe('analyzeBulkRename', () => {
  it('détecte les doublons générés', () => {
    const a = analyzeBulkRename(['a.txt', 'b.txt'], { ...base, find: 'a|b', replace: 'x', regex: true })
    expect(a.hasDup).toBe(true)
    expect(a.blocked).toBe(true)
  })

  it('détecte les noms vides', () => {
    const a = analyzeBulkRename(['a'], { ...base, find: 'a', replace: '' })
    expect(a.hasEmpty).toBe(true)
    expect(a.blocked).toBe(true)
  })

  it('bloque quand rien ne change', () => {
    const a = analyzeBulkRename(['a.txt'], base)
    expect(a.changedCount).toBe(0)
    expect(a.blocked).toBe(true)
  })

  it('compte correctement les éléments modifiés', () => {
    const a = analyzeBulkRename(['a.txt', 'keep.txt'], { ...base, find: 'a.txt', replace: 'z.txt' })
    expect(a.changedCount).toBe(1)
    expect(a.blocked).toBe(false)
  })
})
