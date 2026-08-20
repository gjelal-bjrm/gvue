import { describe, it, expect } from 'vitest'
import {
  launchCommand,
  registryAdds,
  candidateArgs,
  pickOutFromArgv,
  gitFromArgv,
  workspaceFromArgv
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

describe('pickOutFromArgv', () => {
  it('extrait le fichier de sortie du mode sélecteur', () => {
    expect(pickOutFromArgv(['GVue.exe', '--pick', '--pick-out', 'C:\\Temp\\out.txt'])).toBe(
      'C:\\Temp\\out.txt'
    )
  })

  it('sans --pick ou sans --pick-out → null', () => {
    expect(pickOutFromArgv(['GVue.exe', '--pick'])).toBe(null)
    expect(pickOutFromArgv(['GVue.exe', '--pick-out', 'C:\\Temp\\out.txt'])).toBe(null)
    expect(pickOutFromArgv(['GVue.exe'])).toBe(null)
  })

  it('valeur manquante ou option à la place → null', () => {
    expect(pickOutFromArgv(['GVue.exe', '--pick', '--pick-out'])).toBe(null)
    expect(pickOutFromArgv(['GVue.exe', '--pick', '--pick-out', '--autre'])).toBe(null)
  })
})

describe('workspaceFromArgv', () => {
  it('extrait le nom de l’espace de travail', () => {
    expect(workspaceFromArgv(['GVue.exe', '--workspace', 'wasl'])).toBe('wasl')
  })

  it('sans option, valeur manquante ou option à la place → null', () => {
    expect(workspaceFromArgv(['GVue.exe'])).toBe(null)
    expect(workspaceFromArgv(['GVue.exe', '--workspace'])).toBe(null)
    expect(workspaceFromArgv(['GVue.exe', '--workspace', '--pick'])).toBe(null)
  })
})

describe('argv livré par Electron à une seconde instance', () => {
  // Cas RÉEL relevé dans le journal de Gjelal : Electron insère ses propres
  // options entre `--workspace` et sa valeur, rejetée à la fin.
  const reel = [
    'C:\Users\gjelal\AppData\Local\Programs\GVue\GVue.exe',
    '--workspace',
    '--allow-file-access-from-files',
    '--bypasscsp-schemes=gvue-file',
    '--fetch-schemes=gvue-file',
    '--streaming-schemes=gvue-file',
    'GestFit'
  ]

  it('enjambe les options insérées par Electron', () => {
    expect(workspaceFromArgv(reel)).toBe('GestFit')
  })

  it('lit encore la forme simple', () => {
    expect(workspaceFromArgv(['GVue.exe', '--workspace', 'SGPA'])).toBe('SGPA')
  })

  it('accepte la forme collée, que rien ne peut couper', () => {
    expect(workspaceFromArgv(['GVue.exe', '--workspace=Mon Espace'])).toBe('Mon Espace')
  })

  it('renvoie null sans option ni valeur', () => {
    expect(workspaceFromArgv(['GVue.exe'])).toBeNull()
    expect(workspaceFromArgv(['GVue.exe', '--workspace'])).toBeNull()
  })

  it('le mode sélecteur résiste au même piège', () => {
    expect(
      pickOutFromArgv(['GVue.exe', '--pick', '--pick-out', '--allow-file-access', 'C:\tmp\o.txt'])
    ).toBe('C:\tmp\o.txt')
  })
})

describe('gitFromArgv', () => {
  it('détecte --git même au milieu des options injectées par Electron', () => {
    const argv = ['GVue.exe', '--workspace', '--allow-file-access-from-files', 'GestFit', '--git']
    expect(gitFromArgv(argv)).toBe(true)
  })
  it('absent : pas de panneau Git', () => {
    expect(gitFromArgv(['GVue.exe', 'C:/dev'])).toBe(false)
  })
})
