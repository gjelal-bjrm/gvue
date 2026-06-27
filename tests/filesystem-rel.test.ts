import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { cleanRel, isSafeRel, makeDirs } from '../src/main/services/filesystem'

describe('cleanRel', () => {
  it('unifie les séparateurs et nettoie les bords', () => {
    expect(cleanRel('a\\b\\c')).toBe('a/b/c')
    expect(cleanRel('/a/b/')).toBe('a/b')
    expect(cleanRel('  a/b  ')).toBe('a/b')
  })
})

describe('isSafeRel', () => {
  it('accepte les chemins relatifs normaux', () => {
    expect(isSafeRel('a/b/c')).toBe(true)
    expect(isSafeRel('dossier')).toBe(true)
  })

  it('rejette la traversée de répertoire et les segments vides', () => {
    expect(isSafeRel('a/../b')).toBe(false)
    expect(isSafeRel('..')).toBe(false)
    expect(isSafeRel('a/./b')).toBe(false)
    expect(isSafeRel('a//b')).toBe(false)
    expect(isSafeRel('')).toBe(false)
  })
})

describe('makeDirs', () => {
  let base = ''
  beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), 'gvue-mkd-'))
  })
  afterEach(async () => {
    await fs.rm(base, { recursive: true, force: true })
  })

  const isDir = async (p: string): Promise<boolean> => {
    try {
      return (await fs.stat(p)).isDirectory()
    } catch {
      return false
    }
  }

  it('crée des arborescences imbriquées', async () => {
    const res = await makeDirs(base, ['x', 'y/z', 'a/b/c'])
    expect(res.created).toBe(3)
    expect(res.errors).toEqual([])
    expect(await isDir(path.join(base, 'x'))).toBe(true)
    expect(await isDir(path.join(base, 'y', 'z'))).toBe(true)
    expect(await isDir(path.join(base, 'a', 'b', 'c'))).toBe(true)
  })

  it('rejette les chemins qui tentent de remonter, sans rien créer hors base', async () => {
    const res = await makeDirs(base, ['../evil', 'ok'])
    expect(res.errors.length).toBe(1)
    expect(res.created).toBe(1)
    expect(await isDir(path.join(base, 'ok'))).toBe(true)
    expect(await isDir(path.join(path.dirname(base), 'evil'))).toBe(false)
  })

  it('ignore silencieusement les entrées vides', async () => {
    const res = await makeDirs(base, ['', '   ', 'real'])
    expect(res.created).toBe(1)
    expect(res.errors).toEqual([])
  })

  it('refuse une base non absolue', async () => {
    const res = await makeDirs('relative/path', ['x'])
    expect(res.created).toBe(0)
    expect(res.errors.length).toBe(1)
  })
})
