import { promises as fsp } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join, basename, dirname } from 'node:path'
import type { RecycleItem } from '@shared/types'

/**
 * Corbeille Windows — lecture, restauration et suppression définitive.
 *
 * Windows stocke chaque élément supprimé dans `<lecteur>:\$Recycle.Bin\<SID>\`
 * sous deux fichiers : `$R<id>` (le contenu réel) et `$I<id>` (métadonnées
 * binaires : taille, date de suppression, chemin d'origine).
 *
 * On lit ce format directement plutôt que de passer par les « verbes » du shell
 * (`InvokeVerb('Restore')`) : ces verbes sont LOCALISÉS (« Restaurer » sur un
 * Windows français) et échouent silencieusement — piège déjà rencontré avec la
 * boîte « Propriétés ». Ici tout est déterministe et indépendant de la langue.
 */

const exec = promisify(execFile)

/** En-tête $I : version(8) + taille(8) + FILETIME(8) = 24 octets. */
const HEADER = 24
/** Écart entre l'époque FILETIME (1601) et l'époque Unix, en millisecondes. */
const FILETIME_EPOCH_DIFF_MS = 11644473600000n

/**
 * Décode un fichier de métadonnées `$I` (pur, testable).
 * Version 1 (Vista/7) : chemin sur 260 caractères fixes.
 * Version 2 (Win10+)  : longueur du chemin (uint32) puis chemin UTF-16LE.
 * Renvoie null si le tampon est trop court ou incohérent.
 */
export function parseInfoFile(buf: Buffer): { originalPath: string; size: number; deletedAtMs: number } | null {
  if (buf.length < HEADER + 4) return null
  const version = buf.readBigUInt64LE(0)
  const size = Number(buf.readBigUInt64LE(8))
  const filetime = buf.readBigUInt64LE(16)
  // FILETIME = intervalles de 100 ns depuis 1601 → millisecondes Unix.
  const deletedAtMs = Number(filetime / 10000n - FILETIME_EPOCH_DIFF_MS)

  let originalPath: string
  if (version === 2n) {
    const chars = buf.readUInt32LE(HEADER)
    const bytes = chars * 2
    if (bytes <= 0 || HEADER + 4 + bytes > buf.length) return null
    originalPath = buf.toString('utf16le', HEADER + 4, HEADER + 4 + bytes)
  } else {
    // Version 1 : 260 caractères UTF-16 fixes juste après l'en-tête.
    originalPath = buf.toString('utf16le', HEADER, Math.min(HEADER + 520, buf.length))
  }
  originalPath = originalPath.replace(/\0.*$/s, '').trim()
  if (!originalPath) return null
  return { originalPath, size, deletedAtMs }
}

/** SID de l'utilisateur courant (mémoïsé) — nomme son dossier de corbeille. */
let cachedSid: string | null = null
async function currentSid(): Promise<string | null> {
  if (cachedSid) return cachedSid
  try {
    const { stdout } = await exec('whoami', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true })
    // Format CSV : "DOMAINE\utilisateur","S-1-5-21-…"
    const m = /"(S-1-[\d-]+)"/.exec(stdout)
    cachedSid = m ? m[1] : null
    return cachedSid
  } catch {
    return null
  }
}

/** Dossiers de corbeille de l'utilisateur, tous lecteurs confondus. */
async function binDirs(): Promise<string[]> {
  const sid = await currentSid()
  if (!sid) return []
  const dirs: string[] = []
  for (let i = 0; i < 26; i++) {
    const drive = `${String.fromCharCode(65 + i)}:`
    const dir = join(`${drive}\\`, '$Recycle.Bin', sid)
    try {
      const st = await fsp.stat(dir)
      if (st.isDirectory()) dirs.push(dir)
    } catch {
      /* lecteur absent ou corbeille inaccessible */
    }
  }
  return dirs
}

/**
 * Contenu de la corbeille (tous lecteurs), du plus récemment supprimé au plus
 * ancien. Les entrées illisibles sont ignorées : jamais d'échec global.
 */
export async function listRecycleBin(): Promise<RecycleItem[]> {
  if (process.platform !== 'win32') return []
  const items: RecycleItem[] = []

  for (const dir of await binDirs()) {
    let names: string[]
    try {
      names = await fsp.readdir(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.startsWith('$I')) continue
      const infoPath = join(dir, name)
      // Le fichier de données porte le même identifiant, avec « $R ».
      const dataPath = join(dir, '$R' + name.slice(2))
      try {
        const meta = parseInfoFile(await fsp.readFile(infoPath))
        if (!meta) continue
        const st = await fsp.stat(dataPath)
        items.push({
          id: dataPath,
          name: basename(meta.originalPath),
          originalPath: meta.originalPath,
          size: meta.size,
          deletedAtMs: meta.deletedAtMs,
          isDir: st.isDirectory()
        })
      } catch {
        /* $R disparu ou $I corrompu : entrée ignorée */
      }
    }
  }

  return items.sort((a, b) => b.deletedAtMs - a.deletedAtMs)
}

/** Chemin de métadonnées ($I) correspondant à un chemin de données ($R). */
function infoPathOf(dataPath: string): string {
  const base = basename(dataPath)
  return join(dirname(dataPath), '$I' + base.slice(2))
}

/** Vrai si le chemin est bien une entrée de corbeille (garde-fou anti-abus). */
function isBinEntry(p: string): boolean {
  return /\\\$Recycle\.Bin\\S-1-[\d-]+\\\$R/i.test(p)
}

/** Rend un chemin libre en ajoutant « (2) », « (3) »… si la cible existe. */
async function freePath(target: string): Promise<string> {
  const dot = basename(target).lastIndexOf('.')
  const dir = dirname(target)
  const base = basename(target)
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let candidate = target
  for (let n = 2; n < 1000; n++) {
    try {
      await fsp.access(candidate)
    } catch {
      return candidate // libre
    }
    candidate = join(dir, `${stem} (${n})${ext}`)
  }
  return candidate
}

export interface RecycleActionResult {
  ok: number
  errors: string[]
}

/** Restaure des éléments à leur emplacement d'origine (dossiers parents recréés). */
export async function restoreItems(ids: string[]): Promise<RecycleActionResult> {
  const res: RecycleActionResult = { ok: 0, errors: [] }
  for (const id of ids) {
    if (!isBinEntry(id)) {
      res.errors.push(`Entrée invalide : ${id}`)
      continue
    }
    const infoPath = infoPathOf(id)
    try {
      const meta = parseInfoFile(await fsp.readFile(infoPath))
      if (!meta) throw new Error('métadonnées illisibles')
      await fsp.mkdir(dirname(meta.originalPath), { recursive: true })
      const target = await freePath(meta.originalPath)
      await fsp.rename(id, target)
      await fsp.unlink(infoPath).catch(() => undefined)
      res.ok++
    } catch (e) {
      res.errors.push(`${basename(id)} : ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return res
}

/** Supprime définitivement des éléments de la corbeille (irréversible). */
export async function deleteItems(ids: string[]): Promise<RecycleActionResult> {
  const res: RecycleActionResult = { ok: 0, errors: [] }
  for (const id of ids) {
    if (!isBinEntry(id)) {
      res.errors.push(`Entrée invalide : ${id}`)
      continue
    }
    try {
      await fsp.rm(id, { recursive: true, force: true })
      await fsp.rm(infoPathOf(id), { force: true })
      res.ok++
    } catch (e) {
      res.errors.push(`${basename(id)} : ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return res
}

/** Vide entièrement la corbeille (Clear-RecycleBin : API canonique, non localisée). */
export async function emptyRecycleBin(): Promise<RecycleActionResult> {
  if (process.platform !== 'win32') return { ok: 0, errors: ['Windows uniquement.'] }
  try {
    await exec(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Clear-RecycleBin -Force -ErrorAction Stop'],
      { windowsHide: true, timeout: 60_000 }
    )
    return { ok: 1, errors: [] }
  } catch (e) {
    const err = e as { stderr?: string; message?: string }
    // Corbeille déjà vide : Clear-RecycleBin sort en erreur, ce n'est pas un échec.
    const text = (err.stderr || err.message || '').toLowerCase()
    if (text.includes('empty') || text.includes('vide')) return { ok: 1, errors: [] }
    return { ok: 0, errors: [err.stderr || err.message || 'Échec'] }
  }
}
