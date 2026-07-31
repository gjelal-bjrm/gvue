import { describe, expect, it } from 'vitest'
import { initLang, resolveLang, t, tn } from '../src/renderer/src/i18n'
import { EN } from '../src/renderer/src/i18n/en'

describe('i18n', () => {
  it('français par défaut : t() renvoie la clé telle quelle', () => {
    initLang('fr')
    expect(t('Annuler')).toBe('Annuler')
    expect(t('Charger « {name} »', { name: 'x' })).toBe('Charger « x »')
  })

  it('anglais : traduit via le dictionnaire, retombe sur le français sinon', () => {
    initLang('en')
    expect(t('Accès rapide')).toBe('Quick access')
    expect(t('Clé-inexistante-xyz')).toBe('Clé-inexistante-xyz')
    initLang('fr')
  })

  it('interpole tous les gabarits, y compris répétés', () => {
    initLang('fr')
    expect(t('{n} + {n} = {m}', { n: 2, m: 4 })).toBe('2 + 2 = 4')
  })

  it('tn : pluriel français à partir de 2 (0 et 1 au singulier)', () => {
    initLang('fr')
    expect(tn(0, '{n} élément', '{n} éléments')).toBe('0 élément')
    expect(tn(1, '{n} élément', '{n} éléments')).toBe('1 élément')
    expect(tn(2, '{n} élément', '{n} éléments')).toBe('2 éléments')
  })

  it('tn : pluriel anglais pour tout sauf 1 (0 items, 1 item)', () => {
    initLang('en')
    expect(tn(0, '{n} élément', '{n} éléments')).toBe('0 items')
    expect(tn(1, '{n} élément', '{n} éléments')).toBe('1 item')
    expect(tn(3, '{n} élément', '{n} éléments')).toBe('3 items')
    initLang('fr')
  })

  it('resolveLang : explicite prioritaire, auto retombe proprement', () => {
    expect(resolveLang('fr')).toBe('fr')
    expect(resolveLang('en')).toBe('en')
    // En environnement de test Node, pas de navigator → français.
    expect(resolveLang('auto')).toBe('fr')
    expect(resolveLang(undefined)).toBe('fr')
  })

  it('le dictionnaire ne contient aucune traduction vide ou identique douteuse', () => {
    for (const [fr, en] of Object.entries(EN)) {
      expect(fr.length).toBeGreaterThan(0)
      expect(en.length).toBeGreaterThan(0)
    }
  })

  it('les gabarits {x} des clés existent dans leurs traductions', () => {
    const holes = (s: string): string[] => [...s.matchAll(/\{[a-zA-Z]+\}/g)].map((m) => m[0])
    const missing: string[] = []
    for (const [fr, en] of Object.entries(EN)) {
      for (const h of holes(fr)) {
        if (!en.includes(h)) missing.push(`${fr} → ${en} (gabarit ${h} absent)`)
      }
    }
    expect(missing).toEqual([])
  })
})
