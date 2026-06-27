import { describe, it, expect } from 'vitest'
import { parse, categorize, parseBranch } from '../src/main/services/git'

describe('categorize', () => {
  it('classe les codes porcelain', () => {
    expect(categorize('?', '?')).toBe('untracked')
    expect(categorize('!', '!')).toBe('ignored')
    expect(categorize('U', 'U')).toBe('conflict')
    expect(categorize('A', 'A')).toBe('conflict') // AA = conflit
    expect(categorize('R', ' ')).toBe('renamed')
    expect(categorize('A', ' ')).toBe('added')
    expect(categorize('D', ' ')).toBe('deleted')
    expect(categorize('M', ' ')).toBe('modified')
    expect(categorize(' ', 'M')).toBe('modified')
  })
})

describe('parseBranch', () => {
  it('extrait branche + ahead/behind', () => {
    expect(parseBranch('main...origin/main [ahead 2, behind 1]')).toEqual({
      branch: 'main',
      ahead: 2,
      behind: 1
    })
  })

  it('sans upstream', () => {
    expect(parseBranch('feature/x')).toEqual({ branch: 'feature/x', ahead: 0, behind: 0 })
  })

  it('dépôt sans commit', () => {
    expect(parseBranch('No commits yet on master')).toEqual({
      branch: 'master',
      ahead: 0,
      behind: 0
    })
  })

  it('HEAD détaché', () => {
    const r = parseBranch('HEAD (no branch)')
    expect(r.branch).toBe('HEAD (détaché)')
  })
})

describe('parse (git status --porcelain -z)', () => {
  it('parse branche, ahead/behind et fichiers', () => {
    const raw = [
      '## main...origin/main [ahead 1, behind 2]',
      'A  src/new.ts',
      ' M src/edit.ts',
      '?? notes.txt',
      'D  gone.ts'
    ].join('\0')
    const st = parse(raw, '/repo')

    expect(st.isRepo).toBe(true)
    expect(st.root).toBe('/repo')
    expect(st.branch).toBe('main')
    expect(st.ahead).toBe(1)
    expect(st.behind).toBe(2)
    expect(st.files).toEqual([
      { path: '/repo/src/new.ts', category: 'added', staged: true },
      { path: '/repo/src/edit.ts', category: 'modified', staged: false },
      { path: '/repo/notes.txt', category: 'untracked', staged: false },
      { path: '/repo/gone.ts', category: 'deleted', staged: true }
    ])
  })

  it('saute le second champ d’un renommage', () => {
    const raw = ['## main', 'R  newname.ts', 'oldname.ts', ' M after.ts'].join('\0')
    const st = parse(raw, '/r')
    expect(st.files).toEqual([
      { path: '/r/newname.ts', category: 'renamed', staged: true },
      { path: '/r/after.ts', category: 'modified', staged: false }
    ])
  })

  it('ignore les enregistrements vides', () => {
    const raw = ['## main', '', ' M a.ts', ''].join('\0')
    const st = parse(raw, '/r')
    expect(st.files).toHaveLength(1)
  })
})
