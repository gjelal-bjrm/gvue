import { describe, it, expect } from 'vitest'
import {
  launchCommand,
  registryAdds,
  candidateArgs
} from '../src/main/services/shell-integration'

describe('launchCommand', () => {
  it('packagé : exe + %V ; dev : exe + dossier app + %V', () => {
    expect(launchCommand('C:\\Apps\\GVue.exe')).toBe('"C:\\Apps\\GVue.exe" "%V"')
    expect(launchCommand('C:\\electron.exe', 'C:\\Dev\\gvue')).toBe(
      '"C:\\electron.exe" "C:\\Dev\\gvue" "%V"'
    )
  })
})

describe('registryAdds', () => {
  const ops = registryAdds('C:\\Apps\\GVue.exe')

  it('couvre dossiers, fond de dossier et lecteurs (3 clés × 3 valeurs)', () => {
    expect(ops).toHaveLength(9)
    const keys = ops.map((o) => o[1])
    expect(keys).toContain('HKCU\\Software\\Classes\\Directory\\shell\\GVue')
    expect(keys).toContain('HKCU\\Software\\Classes\\Directory\\Background\\shell\\GVue')
    expect(keys).toContain('HKCU\\Software\\Classes\\Drive\\shell\\GVue')
  })

  it('chaque clé reçoit libellé, icône et commande', () => {
    const forDir = ops.filter((o) => o[1].includes('Directory\\shell\\GVue'))
    expect(forDir[0]).toContain('Ouvrir dans GVue')
    expect(forDir[1]).toContain('Icon')
    expect(forDir[2][1].endsWith('\\command')).toBe(true)
    expect(forDir[2]).toContain('"C:\\Apps\\GVue.exe" "%V"')
  })

  it('tout est en HKCU (aucun droit administrateur requis)', () => {
    expect(ops.every((o) => o[1].startsWith('HKCU\\'))).toBe(true)
  })
})

describe('candidateArgs', () => {
  it('packagé : saute l’exe, garde le dossier, ignore les options', () => {
    expect(
      candidateArgs(['C:\\Apps\\GVue.exe', '--allow-file-access', 'C:\\Dev\\projet'], true)
    ).toEqual(['C:\\Dev\\projet'])
  })

  it("dev : saute aussi le dossier de l'app", () => {
    expect(candidateArgs(['electron.exe', 'C:\\Dev\\gvue', 'C:\\Users\\x\\Docs'], false)).toEqual([
      'C:\\Users\\x\\Docs'
    ])
  })

  it('aucun argument → liste vide', () => {
    expect(candidateArgs(['C:\\Apps\\GVue.exe'], true)).toEqual([])
    expect(candidateArgs(['electron.exe', 'C:\\Dev\\gvue'], false)).toEqual([])
  })
})
