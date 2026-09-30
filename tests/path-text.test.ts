import { describe, expect, it } from 'vitest'
import { extractWindowsPath } from '@renderer/lib/pathText'

describe('extractWindowsPath', () => {
  it('reconnaît un chemin de lecteur, avec les deux sens de barre', () => {
    expect(extractWindowsPath('C:\\Dev\\gvue')).toBe('C:\\Dev\\gvue')
    expect(extractWindowsPath('C:/Dev/gvue/src')).toBe('C:\\Dev\\gvue\\src')
    expect(extractWindowsPath('d:\\')).toBe('d:\\')
  })

  it('reconnaît un chemin réseau UNC', () => {
    expect(extractWindowsPath('\\\\nas\\partage\\docs')).toBe('\\\\nas\\partage\\docs')
  })

  it('tolère guillemets, parenthèses et ponctuation de fin', () => {
    expect(extractWindowsPath('"C:\\Program Files\\App"')).toBe('C:\\Program Files\\App')
    expect(extractWindowsPath("(voir 'C:\\x\\y')")).toBe('C:\\x\\y')
    expect(extractWindowsPath('C:\\x\\y.')).toBe('C:\\x\\y')
  })

  it('retire le suffixe ligne:colonne des traces d’erreur', () => {
    expect(extractWindowsPath('C:\\app\\src\\main.ts:12:5')).toBe('C:\\app\\src\\main.ts')
    expect(extractWindowsPath('    at C:\\app\\x.js:3')).toBe('C:\\app\\x.js')
  })

  it('accepte une URL file:///', () => {
    expect(extractWindowsPath('file:///C:/Users/moi/Documents/rapport%20final.pdf')).toBe(
      'C:\\Users\\moi\\Documents\\rapport final.pdf'
    )
  })

  it('ne prend que la première ligne d’une sélection multiple', () => {
    expect(extractWindowsPath('C:\\a\\b\ntotal 4\napp.js')).toBe('C:\\a\\b')
    expect(extractWindowsPath('\n\n  C:\\a  \n')).toBe('C:\\a')
  })

  it('refuse ce qui n’est pas un chemin', () => {
    expect(extractWindowsPath('npm run dev')).toBeNull()
    expect(extractWindowsPath('/usr/bin/bash')).toBeNull()
    expect(extractWindowsPath('http://localhost:3000')).toBeNull()
    expect(extractWindowsPath('')).toBeNull()
    expect(extractWindowsPath('C:\\x|y')).toBeNull()
  })
})
