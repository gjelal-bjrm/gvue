import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  cleanRel,
  isSafeRel,
  makeDirs,
  dedupeNestedPaths,
  uncHost
} from '../src/main/services/filesystem'

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

  it('renvoie la racine réellement créée (ancêtre le plus haut)', async () => {
    const res = await makeDirs(base, ['a/b/c'])
    const norm = res.paths.map((p) => p.replace(/\\/g, '/'))
    expect(norm).toEqual([path.join(base, 'a').replace(/\\/g, '/')])
  })

  it('ne signale pas comme créée une racine préexistante', async () => {
    await fs.mkdir(path.join(base, 'pre'))
    const res = await makeDirs(base, ['pre/sub'])
    const norm = res.paths.map((p) => p.replace(/\\/g, '/'))
    // « pre » existait : la racine créée est « pre/sub », pas « pre ».
    expect(norm).toEqual([path.join(base, 'pre', 'sub').replace(/\\/g, '/')])
  })
})

describe('uncHost', () => {
  it('détecte une racine d’hôte UNC (back/forward slashes, avec/sans fin)', () => {
    expect(uncHost('\\\\santorin')).toBe('santorin')
    expect(uncHost('\\\\santorin\\')).toBe('santorin')
    expect(uncHost('//santorin')).toBe('santorin')
    expect(uncHost('  \\\\santorin  ')).toBe('santorin')
  })
  it('renvoie null dès qu’un partage est présent ou que ce n’est pas de l’UNC', () => {
    expect(uncHost('\\\\santorin\\share')).toBeNull()
    expect(uncHost('C:\\Users')).toBeNull()
    expect(uncHost('/home/user')).toBeNull()
    expect(uncHost('santorin')).toBeNull()
  })
})

describe('dedupeNestedPaths', () => {
  it('retire les descendants', () => {
    expect(dedupeNestedPaths(['/a', '/a/b', '/a/b/c'])).toEqual(['/a'])
  })
  it('retire les doublons exacts (garde le premier)', () => {
    expect(dedupeNestedPaths(['/a', '/a'])).toEqual(['/a'])
  })
  it('conserve les chemins frères', () => {
    expect(dedupeNestedPaths(['/a', '/b'])).toEqual(['/a', '/b'])
  })
  it('gère les séparateurs Windows', () => {
    expect(dedupeNestedPaths(['C:\\x', 'C:\\x\\y'])).toEqual(['C:\\x'])
  })
  it('ne confond pas les préfixes partiels', () => {
    // « /ab » n'est pas sous « /a ».
    expect(dedupeNestedPaths(['/a', '/ab'])).toEqual(['/a', '/ab'])
  })
})
