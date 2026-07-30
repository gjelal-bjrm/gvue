import { describe, it, expect } from 'vitest'
import { parseInfoFile } from '../src/main/services/recycle-bin'

/**
 * Construit un fichier de métadonnées `$I` synthétique.
 * Format : version(8) + taille(8) + FILETIME(8) [+ longueur(4) en v2] + chemin UTF-16LE.
 */
function buildInfo(opts: {
  version: 1 | 2
  size: number
  filetime: bigint
  path: string
}): Buffer {
  const pathBuf = Buffer.from(opts.path + '\0', 'utf16le')
  if (opts.version === 2) {
    const buf = Buffer.alloc(28 + pathBuf.length)
    buf.writeBigUInt64LE(2n, 0)
    buf.writeBigUInt64LE(BigInt(opts.size), 8)
    buf.writeBigUInt64LE(opts.filetime, 16)
    buf.writeUInt32LE(pathBuf.length / 2, 24)
    pathBuf.copy(buf, 28)
    return buf
  }
  // Version 1 : 260 caractères fixes (520 octets) après l'en-tête.
  const buf = Buffer.alloc(24 + 520)
  buf.writeBigUInt64LE(1n, 0)
  buf.writeBigUInt64LE(BigInt(opts.size), 8)
  buf.writeBigUInt64LE(opts.filetime, 16)
  pathBuf.copy(buf, 24)
  return buf
}

// Valeur relevée sur une vraie corbeille Windows (PowerShell affichait
// « 09/11/2024 15:10:04 » au format MM/JJ, soit le 11 septembre 2024 à 15 h 10
// locales = 13 h 10 UTC).
const REAL_FILETIME = 133705338049360000n

describe('parseInfoFile', () => {
  it('décode le format v2 (Windows 10+)', () => {
    const buf = buildInfo({
      version: 2,
      size: 799,
      filetime: REAL_FILETIME,
      path: 'C:\\Users\\Gjelal\\Desktop\\rap.txt'
    })
    const info = parseInfoFile(buf)
    expect(info).not.toBeNull()
    expect(info!.originalPath).toBe('C:\\Users\\Gjelal\\Desktop\\rap.txt')
    expect(info!.size).toBe(799)
    // Même instant que celui décodé par Windows sur la machine de référence.
    expect(new Date(info!.deletedAtMs).toISOString()).toBe('2024-09-11T13:10:04.936Z')
  })

  it('décode le format v1 (Vista/7, chemin sur 260 caractères)', () => {
    const buf = buildInfo({
      version: 1,
      size: 42,
      filetime: REAL_FILETIME,
      path: 'D:\\data\\vieux.txt'
    })
    const info = parseInfoFile(buf)
    expect(info?.originalPath).toBe('D:\\data\\vieux.txt')
    expect(info?.size).toBe(42)
  })

  it('gère les chemins accentués et les espaces', () => {
    const p = 'C:\\Users\\Gjelal\\Mes documents\\résumé été.pdf'
    const info = parseInfoFile(buildInfo({ version: 2, size: 1, filetime: REAL_FILETIME, path: p }))
    expect(info?.originalPath).toBe(p)
  })

  it('rejette un tampon tronqué ou incohérent', () => {
    expect(parseInfoFile(Buffer.alloc(10))).toBeNull()
    // Longueur de chemin annoncée bien au-delà du tampon.
    const bad = Buffer.alloc(40)
    bad.writeBigUInt64LE(2n, 0)
    bad.writeUInt32LE(9999, 24)
    expect(parseInfoFile(bad)).toBeNull()
  })

  it('rejette un chemin vide', () => {
    const buf = buildInfo({ version: 2, size: 0, filetime: REAL_FILETIME, path: '' })
    expect(parseInfoFile(buf)).toBeNull()
  })
})
