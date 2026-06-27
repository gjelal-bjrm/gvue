import { describe, it, expect } from 'vitest'
import { sanitizeConfig, DEFAULT_CONFIG } from '../src/main/services/config-schema'

describe('sanitizeConfig', () => {
  it('renvoie les défauts pour une entrée non-objet', () => {
    expect(sanitizeConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(sanitizeConfig(undefined)).toEqual(DEFAULT_CONFIG)
    expect(sanitizeConfig('corrompu')).toEqual(DEFAULT_CONFIG)
    expect(sanitizeConfig(42)).toEqual(DEFAULT_CONFIG)
  })

  it('complète les clés manquantes avec les défauts', () => {
    const out = sanitizeConfig({ favorites: ['C:/x'] })
    expect(out.favorites).toEqual(['C:/x'])
    expect(out.sidebarOrder).toEqual(DEFAULT_CONFIG.sidebarOrder)
    expect(out.appearance).toEqual(DEFAULT_CONFIG.appearance)
    expect(out.hideGitIgnored).toBe(true)
  })

  it('rejette les valeurs au mauvais type (retombe sur le défaut)', () => {
    const out = sanitizeConfig({
      favorites: 'pas-un-tableau',
      hideGitIgnored: 'oui',
      sidebarCollapsed: ['pas-un-objet'],
      defaultShell: 123
    })
    expect(out.favorites).toEqual([])
    expect(out.hideGitIgnored).toBe(true)
    expect(out.sidebarCollapsed).toEqual({})
    expect(out.defaultShell).toBe('')
  })

  it('conserve les valeurs valides', () => {
    const out = sanitizeConfig({
      defaultShell: 'cmd',
      hideGitIgnored: false,
      treeExpandToCurrent: false,
      favorites: ['A', 'B']
    })
    expect(out.defaultShell).toBe('cmd')
    expect(out.hideGitIgnored).toBe(false)
    expect(out.treeExpandToCurrent).toBe(false)
    expect(out.favorites).toEqual(['A', 'B'])
  })

  it('assainit l’apparence champ par champ sans perdre les presets', () => {
    const out = sanitizeConfig({
      appearance: {
        accent: '#000000',
        fontSize: 'gros', // mauvais type → défaut
        theme: 'dark',
        presets: { Nuit: { accent: '#111' } }
      }
    })
    expect(out.appearance.accent).toBe('#000000')
    expect(out.appearance.theme).toBe('dark')
    expect(out.appearance.fontSize).toBe(DEFAULT_CONFIG.appearance.fontSize) // 14
    expect(out.appearance.presets).toEqual({ Nuit: { accent: '#111' } })
  })

  it('apparence absente ou cassée → apparence par défaut', () => {
    expect(sanitizeConfig({ appearance: 'x' }).appearance).toEqual(DEFAULT_CONFIG.appearance)
    expect(sanitizeConfig({ appearance: null }).appearance).toEqual(DEFAULT_CONFIG.appearance)
  })

  it('ignore les clés inconnues', () => {
    const out = sanitizeConfig({ champBidon: 'x', favorites: ['ok'] })
    expect('champBidon' in out).toBe(false)
    expect(out.favorites).toEqual(['ok'])
  })

  it('preserve un conteneur objet valide (workspaces)', () => {
    const ws = { projetA: { panes: [] } }
    const out = sanitizeConfig({ workspaces: ws })
    expect(out.workspaces).toEqual(ws)
  })
})
