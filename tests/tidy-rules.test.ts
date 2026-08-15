import { describe, expect, it } from 'vitest'
import {
  extOf,
  isTempDownload,
  pickRule,
  parseExtensions,
  renderSubfolder,
  freeName,
  compileNamePattern,
  matchesName
} from '../src/main/services/tidy-rules'
import type { TidyRule } from '../src/shared/types'

const rule = (over: Partial<TidyRule>): TidyRule => ({
  id: 'r',
  enabled: true,
  extensions: [],
  destDir: 'D:\\Rangement',
  ...over
})

describe('tidy-rules', () => {
  it('ignore les téléchargements en cours et les fichiers cachés/temporaires', () => {
    for (const n of ['a.crdownload', 'b.part', 'c.partial', 'd.download', 'e.tmp', 'f.opdownload', '.hidden', '~lock']) {
      expect(isTempDownload(n), n).toBe(true)
    }
    expect(isTempDownload('rapport.pdf')).toBe(false)
    expect(isTempDownload('sans-extension')).toBe(false)
  })

  it("extOf : extension minuscule, '' sans extension, fichiers pointés gérés", () => {
    expect(extOf('A.PDF')).toBe('pdf')
    expect(extOf('archive.tar.gz')).toBe('gz')
    expect(extOf('sans')).toBe('')
    expect(extOf('.gitignore')).toBe('')
  })

  it('pickRule : première règle active qui correspond ; vide = toutes', () => {
    const rules = [
      rule({ id: 'off', enabled: false }),
      rule({ id: 'pdf', extensions: ['pdf'] }),
      rule({ id: 'all' })
    ]
    expect(pickRule(rules, 'doc.pdf')?.id).toBe('pdf')
    expect(pickRule(rules, 'image.png')?.id).toBe('all')
    expect(pickRule([rule({ extensions: ['zip'] })], 'doc.pdf')).toBeNull()
  })

  it('pickRule : une règle sans destination ne matche jamais', () => {
    expect(pickRule([rule({ destDir: '  ' })], 'doc.pdf')).toBeNull()
  })

  it('compileNamePattern : sans joker = contient, insensible à la casse', () => {
    const re = compileNamePattern('facture', false)!
    expect(re.test('Facture-2026.pdf')).toBe(true)
    expect(re.test('ma-FACTURE.pdf')).toBe(true)
    expect(re.test('devis.pdf')).toBe(false)
  })

  it('compileNamePattern : jokers * et ? = correspondance du nom entier', () => {
    const re = compileNamePattern('mn_*', false)!
    expect(re.test('mn_rapport.pdf')).toBe(true)
    expect(re.test('rapport_mn_2.pdf')).toBe(false) // ne COMMENCE pas par mn_
    const q = compileNamePattern('img_?.png', false)!
    expect(q.test('img_1.png')).toBe(true)
    expect(q.test('img_12.png')).toBe(false)
    // Les caractères spéciaux de regex sont neutralisés en mode joker.
    expect(compileNamePattern('v1.2*', false)!.test('v1x2-notes.txt')).toBe(false)
    expect(compileNamePattern('v1.2*', false)!.test('v1.2-notes.txt')).toBe(true)
  })

  it('compileNamePattern : mode regex, et null si motif invalide', () => {
    expect(compileNamePattern('^mn_\\d+', true)!.test('mn_42.csv')).toBe(true)
    expect(compileNamePattern('([', true)).toBeNull()
    expect(compileNamePattern('   ', false)).toBeNull()
  })

  it('matchesName + pickRule : le filtre de nom restreint la règle', () => {
    const named = rule({ id: 'mn', namePattern: 'mn_*' })
    expect(matchesName(named, 'mn_data.csv')).toBe(true)
    expect(matchesName(named, 'other.csv')).toBe(false)
    // Motif invalide : la règle n'attrape RIEN (plutôt que tout).
    expect(matchesName(rule({ namePattern: '([', nameIsRegex: true }), 'x.pdf')).toBe(false)

    const rules = [
      rule({ id: 'factures', extensions: ['pdf'], namePattern: 'facture' }),
      rule({ id: 'pdf', extensions: ['pdf'] })
    ]
    expect(pickRule(rules, 'facture-aout.pdf')?.id).toBe('factures')
    expect(pickRule(rules, 'notice.pdf')?.id).toBe('pdf')
    // Nom seul, sans extensions : règle valable pour tous les types.
    expect(pickRule([rule({ id: 'n', namePattern: 'mn_*' })], 'mn_x.zip')?.id).toBe('n')
  })

  it('parseExtensions : séparateurs libres, points retirés, dédoublonné', () => {
    expect(parseExtensions('pdf, ZIP ; .rar  pdf')).toEqual(['pdf', 'zip', 'rar'])
    expect(parseExtensions('')).toEqual([])
  })

  it('renderSubfolder : gabarits {date} et {ext}, caractères interdits neutralisés', () => {
    const d = new Date(2026, 7, 12) // août 2026
    expect(renderSubfolder('{date}', 'x.pdf', d)).toBe('2026-08')
    expect(renderSubfolder('Docs/{ext}', 'x.PDF', d)).toBe('Docs/pdf')
    expect(renderSubfolder('{ext}', 'sans', d)).toBe('autres')
    expect(renderSubfolder('a<b>:c', 'x.pdf', d)).toBe('a-b--c')
    expect(renderSubfolder('/{date}/', 'x.pdf', d)).toBe('2026-08')
  })

  it('freeName : suffixe (n) en cas de collision, insensible à la casse', () => {
    const existing = new Set(['Rapport.pdf', 'rapport (2).pdf'])
    expect(freeName(existing, 'autre.pdf')).toBe('autre.pdf')
    expect(freeName(existing, 'rapport.pdf')).toBe('rapport (3).pdf')
    expect(freeName(new Set(['sans']), 'sans')).toBe('sans (2)')
  })
})
