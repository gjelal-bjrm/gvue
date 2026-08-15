import { describe, expect, it } from 'vitest'
import { splitName, renderNameTemplate, applyTidyAction } from '../src/shared/tidy-actions'
import type { TidyAction } from '../src/shared/types'

const NOW = new Date(2026, 7, 15) // 15 août 2026

const rename = (over: Partial<TidyAction> = {}): TidyAction => ({
  id: 'a',
  label: 'Renommer',
  kind: 'rename',
  template: 'fichier_{n}',
  counter: 1,
  ...over
})

describe('tidy-actions', () => {
  it('splitName : sépare nom et extension, cas limites compris', () => {
    expect(splitName('rapport.pdf')).toEqual({ stem: 'rapport', ext: '.pdf' })
    expect(splitName('archive.tar.gz')).toEqual({ stem: 'archive.tar', ext: '.gz' })
    expect(splitName('sans')).toEqual({ stem: 'sans', ext: '' })
    expect(splitName('.env')).toEqual({ stem: '.env', ext: '' })
  })

  it('renderNameTemplate : {n}, {date} (jour plein), {nom}, {ext}', () => {
    expect(renderNameTemplate('fichier_{n}', 'x.pdf', 3, NOW)).toBe('fichier_3')
    expect(renderNameTemplate('{date} - {nom}', 'rapport.pdf', 1, NOW)).toBe('2026-08-15 - rapport')
    expect(renderNameTemplate('{nom} ({ext})', 'a.PDF', 1, NOW)).toBe('a (PDF)')
    // Caractères interdits de Windows neutralisés.
    expect(renderNameTemplate('a<b>{n}', 'x.pdf', 2, NOW)).toBe('a-b-2')
  })

  it('rename : applique le gabarit, garde l’extension, avance le compteur', () => {
    const out = applyTidyAction(rename({ counter: 7 }), 'télécharg.pdf', NOW)
    expect(out.name).toBe('fichier_7.pdf')
    expect(out.updated?.counter).toBe(8)
    expect(out.exhausted).toBe(false)
  })

  it('rename : sans {n}, le compteur ne bouge pas (rien à persister)', () => {
    const out = applyTidyAction(rename({ template: '{date} - {nom}' }), 'notes.txt', NOW)
    expect(out.name).toBe('2026-08-15 - notes.txt')
    expect(out.updated).toBeNull()
  })

  it('rename : gabarit vide ou ne produisant rien → nom inchangé', () => {
    expect(applyTidyAction(rename({ template: '' }), 'x.pdf', NOW).name).toBeNull()
    expect(applyTidyAction(rename({ template: '  ' }), 'x.pdf', NOW).name).toBeNull()
  })

  it('nameList : consomme le premier nom, hérite de l’extension si absente', () => {
    const action = rename({ kind: 'nameList', names: ['chapitre 1', 'chapitre 2.txt'] })
    const first = applyTidyAction(action, 'scan.pdf', NOW)
    expect(first.name).toBe('chapitre 1.pdf')
    expect(first.updated?.names).toEqual(['chapitre 2.txt'])

    // Nom AVEC extension : pris tel quel.
    const second = applyTidyAction(first.updated!, 'scan2.pdf', NOW)
    expect(second.name).toBe('chapitre 2.txt')
    expect(second.updated?.names).toEqual([])
  })

  it('nameList : liste épuisée → nom inchangé + drapeau pour avertir', () => {
    const out = applyTidyAction(rename({ kind: 'nameList', names: [] }), 'x.pdf', NOW)
    expect(out.name).toBeNull()
    expect(out.exhausted).toBe(true)
    // Les lignes vides ne comptent pas comme des noms.
    expect(applyTidyAction(rename({ kind: 'nameList', names: ['  ', ''] }), 'x.pdf', NOW).exhausted).toBe(true)
  })

  it('script : aucun renommage (le moteur lance le script après le déplacement)', () => {
    const out = applyTidyAction(rename({ kind: 'script', script: 'exemple.ps1' }), 'x.pdf', NOW)
    expect(out).toEqual({ name: null, updated: null, exhausted: false })
  })
})
