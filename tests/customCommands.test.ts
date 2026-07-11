import { describe, it, expect } from 'vitest'
import { substituteTokens, cwdFor } from '@renderer/lib/customCommands'

describe('substituteTokens', () => {
  it('substitue tous les jetons pour un fichier', () => {
    const out = substituteTokens(
    'echo "{path}" | {dir} | {name} | {stem} | {ext}',
      'C:\\proj\\src\\app.test.ts',
      false
    )
    expect(out).toBe('echo "C:\\proj\\src\\app.test.ts" | C:\\proj\\src | app.test.ts | app.test | ts')
  })

  it('pour un dossier : {dir} = le dossier lui-même, pas d’extension', () => {
    const out = substituteTokens('{dir} · {name} · {stem} · [{ext}]', 'C:\\proj\\src', true)
    expect(out).toBe('C:\\proj\\src · src · src · []')
  })

  it('fichier sans extension', () => {
    const out = substituteTokens('{stem}.{ext}', 'C:\\x\\Makefile', false)
    expect(out).toBe('Makefile.')
  })

  it('jeton répété substitué partout', () => {
    expect(substituteTokens('{name} {name}', 'C:\\a\\b.txt', false)).toBe('b.txt b.txt')
  })
})

describe('cwdFor', () => {
  it('fichier → dossier parent ; dossier → lui-même', () => {
    expect(cwdFor('C:\\a\\b\\c.txt', false)).toBe('C:\\a\\b')
    expect(cwdFor('C:\\a\\b\\', true)).toBe('C:\\a\\b')
  })
})
