import { describe, expect, it } from 'vitest'
import {
  extOf,
  isTempDownload,
  pickRule,
  parseExtensions,
  renderSubfolder,
  freeName
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
