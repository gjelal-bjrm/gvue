import { describe, expect, it } from 'vitest'
import { keySequence, tidy } from '@shared/mcp-text'

describe('keySequence', () => {
  it('traduit Ctrl+C et Ctrl+D en caractères de contrôle', () => {
    expect(keySequence('ctrl+c')).toBe('\x03')
    expect(keySequence('Ctrl+D')).toBe('\x04')
  })
  it('enchaîne plusieurs touches nommées', () => {
    expect(keySequence('up up enter')).toBe('\x1b[A\x1b[A\r')
    expect(keySequence('esc, tab')).toBe('\x1b\t')
  })
  it('refuse une touche inconnue ou une liste vide', () => {
    expect(() => keySequence('ctrl+alt+suppr')).toThrow(/inconnue/)
    expect(() => keySequence('  ')).toThrow(/requis/)
  })
})

describe('tidy', () => {
  it('écrase les rafales de lignes vides et les espaces de fin', () => {
    expect(tidy('\n\n\nC:\Git>echo a   \na\n\n\n\n\nC:\Git>')).toBe('C:\Git>echo a\na\n\nC:\Git>')
  })
  it('applique les retours arrière', () => {
    expect(tidy('abx\x08c')).toBe('abc')
  })
})
