import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { freeName, rename, copy, move } from '../src/main/services/fileops'

let dir = ''

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gvue-test-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const touch = (p: string): Promise<void> => fs.writeFile(p, '')
const exists = async (p: string): Promise<boolean> => {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

describe('freeName', () => {
  it('renvoie le nom direct s’il est libre', async () => {
    const got = await freeName(dir, 'a.txt')
    expect(path.basename(got)).toBe('a.txt')
  })

  it('incrémente « (2) » en cas de collision, en préservant l’extension', async () => {
    await touch(path.join(dir, 'a.txt'))
    const got = await freeName(dir, 'a.txt')
    expect(path.basename(got)).toBe('a (2).txt')
  })

  it('continue à incrémenter', async () => {
    await touch(path.join(dir, 'a.txt'))
    await touch(path.join(dir, 'a (2).txt'))
    const got = await freeName(dir, 'a.txt')
    expect(path.basename(got)).toBe('a (3).txt')
  })
})

describe('rename', () => {
  it('refuse un nom invalide (caractère interdit)', async () => {
    const f = path.join(dir, 'a.txt')
    await touch(f)
    const res = await rename(f, 'a:b.txt')
    expect(res.ok).toBe(false)
    expect(await exists(f)).toBe(true)
  })

  it('refuse si la cible existe déjà', async () => {
    await touch(path.join(dir, 'a.txt'))
    await touch(path.join(dir, 'b.txt'))
    const res = await rename(path.join(dir, 'a.txt'), 'b.txt')
    expect(res.ok).toBe(false)
  })

  it('renomme un fichier existant', async () => {
    const f = path.join(dir, 'a.txt')
    await touch(f)
    const res = await rename(f, 'b.txt')
    expect(res.ok).toBe(true)
    expect(await exists(path.join(dir, 'b.txt'))).toBe(true)
    expect(await exists(f)).toBe(false)
  })

  it('renommer vers le même nom est un no-op réussi', async () => {
    const f = path.join(dir, 'a.txt')
    await touch(f)
    const res = await rename(f, 'a.txt')
    expect(res.ok).toBe(true)
  })
})

describe('copy', () => {
  it('ne jamais écraser : génère « (copie) »', async () => {
    const src = path.join(dir, 'sub')
    const dest = path.join(dir, 'dest')
    await fs.mkdir(src)
    await fs.mkdir(dest)
    await touch(path.join(src, 'f.txt'))
    // Pré-place une collision dans dest.
    await fs.mkdir(path.join(dest, 'sub'))

    const res = await copy([src], dest)
    expect(res.ok).toBe(1)
    expect(res.errors).toEqual([])
    expect(await exists(path.join(dest, 'sub (copie)', 'f.txt'))).toBe(true)
  })
})

describe('move', () => {
  it('déplacer dans le même dossier est un no-op compté comme réussi', async () => {
    const f = path.join(dir, 'a.txt')
    await touch(f)
    const res = await move([f], dir)
    expect(res.ok).toBe(1)
    expect(await exists(f)).toBe(true)
  })

  it('refuse de déplacer un dossier dans lui-même', async () => {
    const sub = path.join(dir, 'sub')
    await fs.mkdir(sub)
    const res = await move([sub], sub)
    expect(res.ok).toBe(0)
    expect(res.errors.length).toBe(1)
  })

  it('déplace réellement vers un autre dossier', async () => {
    const src = path.join(dir, 'a.txt')
    const dest = path.join(dir, 'dest')
    await touch(src)
    await fs.mkdir(dest)
    const res = await move([src], dest)
    expect(res.ok).toBe(1)
    expect(await exists(path.join(dest, 'a.txt'))).toBe(true)
    expect(await exists(src)).toBe(false)
  })
})
