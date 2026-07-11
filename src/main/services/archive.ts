import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, basename, extname } from 'node:path'
import { assertAbsolute } from './filesystem'
import { freeName } from './fileops'
import { detect, extract as sevenZipExtract } from './apps'
import type { ArchiveEntry } from '@shared/types'

/**
 * Lecture d'archives sans extraction : 7-Zip (`7z l -slt`) couvre tous les
 * formats s'il est installé ; sinon, repli .NET (PowerShell) pour les .zip.
 * L'extraction complète réutilise 7-Zip, avec repli `Expand-Archive` (zip).
 */

const pexec = promisify(execFile)

/** Parse la sortie `7z l -slt -ba` (blocs séparés par des lignes vides). */
export function parse7zList(raw: string): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  for (const block of raw.split(/\r?\n\r?\n/)) {
    let p = ''
    let size = 0
    let dir = false
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('Path = ')) p = line.slice(7).trim()
      else if (line.startsWith('Size = ')) size = parseInt(line.slice(7), 10) || 0
      else if (line.startsWith('Folder = ')) dir = dir || line.slice(9).trim() === '+'
      else if (line.startsWith('Attributes = ')) dir = dir || line.slice(13).includes('D')
    }
    if (p) entries.push({ path: p.replace(/\\/g, '/'), size, dir })
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

/** Parse la sortie du repli PowerShell (« taille|chemin » par ligne). */
export function parseZipLines(raw: string): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf('|')
    if (i <= 0) continue
    const size = parseInt(line.slice(0, i), 10) || 0
    const full = line.slice(i + 1).trim().replace(/\\/g, '/')
    if (!full) continue
    const dir = full.endsWith('/')
    entries.push({ path: dir ? full.slice(0, -1) : full, size, dir })
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

export async function listArchive(
  input: string
): Promise<{ ok: boolean; entries: ArchiveEntry[]; error?: string }> {
  let file: string
  try {
    file = assertAbsolute(input)
  } catch (e) {
    return { ok: false, entries: [], error: e instanceof Error ? e.message : String(e) }
  }

  const sevenzip = detect().sevenzip
  if (sevenzip) {
    try {
      const { stdout } = await pexec(sevenzip, ['l', '-slt', '-ba', '-sccUTF-8', file], {
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024
      })
      return { ok: true, entries: parse7zList(stdout) }
    } catch (e) {
      return { ok: false, entries: [], error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (extname(file).toLowerCase() === '.zip' && process.platform === 'win32') {
    const esc = file.replace(/'/g, "''")
    const script =
      `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ` +
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `$z=[IO.Compression.ZipFile]::OpenRead('${esc}'); ` +
      `foreach($e in $z.Entries){ '{0}|{1}' -f $e.Length, $e.FullName }; $z.Dispose()`
    try {
      const { stdout } = await pexec(
        'powershell.exe',
        ['-NoProfile', '-Command', script],
        { windowsHide: true, maxBuffer: 64 * 1024 * 1024 }
      )
      return { ok: true, entries: parseZipLines(stdout) }
    } catch (e) {
      return { ok: false, entries: [], error: e instanceof Error ? e.message : String(e) }
    }
  }

  return { ok: false, entries: [], error: "7-Zip est requis pour lire ce format d'archive." }
}

/** Extraction complète : 7-Zip si présent, sinon Expand-Archive (zip). */
export async function extractArchive(
  input: string,
  destDir?: string
): Promise<{ ok: boolean; error?: string }> {
  if (detect().sevenzip) return sevenZipExtract(input, destDir)

  let file: string
  try {
    file = assertAbsolute(input)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  if (extname(file).toLowerCase() !== '.zip' || process.platform !== 'win32') {
    return { ok: false, error: "7-Zip est requis pour extraire ce format d'archive." }
  }
  const parent = destDir ? assertAbsolute(destDir) : dirname(file)
  const outDir = await freeName(parent, basename(file, extname(file)))
  const esc = (s: string): string => s.replace(/'/g, "''")
  const script = `Expand-Archive -LiteralPath '${esc(file)}' -DestinationPath '${esc(outDir)}'`
  // PAS de `detached: true` : PowerShell (app console) spawné détaché meurt
  // avant d'exécuter son script (même cause que showProperties, vérifié).
  spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
    stdio: 'ignore',
    windowsHide: true
  }).unref()
  return { ok: true }
}
