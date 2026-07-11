import { describe, it, expect } from 'vitest'
import { parse7zList, parseZipLines } from '../src/main/services/archive'

describe('parse7zList', () => {
  it('parse des blocs -slt (fichier + dossier)', () => {
    const raw = [
      'Path = src\\app.ts',
      'Size = 1234',
      'Attributes = A',
      '',
      'Path = src',
      'Size = 0',
      'Folder = +',
      'Attributes = D'
    ].join('\n')
    expect(parse7zList(raw)).toEqual([
      { path: 'src', size: 0, dir: true },
      { path: 'src/app.ts', size: 1234, dir: false }
    ])
  })

  it('détecte les dossiers via Attributes = D (sans champ Folder)', () => {
    const raw = 'Path = docs\nSize = 0\nAttributes = D'
    expect(parse7zList(raw)[0].dir).toBe(true)
  })

  it('entrée vide → liste vide', () => {
    expect(parse7zList('')).toEqual([])
  })
})

describe('parseZipLines', () => {
  it('parse « taille|chemin », dossiers = suffixe /', () => {
    const raw = ['1234|src/app.ts', '0|src/', '56|readme.md'].join('\n')
    expect(parseZipLines(raw)).toEqual([
      { path: 'readme.md', size: 56, dir: false },
      { path: 'src', size: 0, dir: true },
      { path: 'src/app.ts', size: 1234, dir: false }
    ])
  })

  it('ignore les lignes malformées', () => {
    expect(parseZipLines('garbage\n|x\n10|ok.txt')).toEqual([
      { path: 'ok.txt', size: 10, dir: false }
    ])
  })
})
