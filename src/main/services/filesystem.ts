import { promises as fs, constants as fsConstants } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { DirEntry, ListResult, DriveInfo, NavLocations } from '@shared/types'

/**
 * Service système de fichiers — logique pure, sans Electron.
 * Toutes les opérations lourdes restent ici (processus principal) et ne
 * bloquent jamais le renderer : on streame via IPC, on liste en async.
 */

/** Normalise un chemin en absolu, sans le résoudre symboliquement. */
export function normalize(input: string): string {
  return path.normalize(path.resolve(input))
}

/** Vérifie qu'un chemin est absolu — garde-fou contre la traversée arbitraire. */
export function assertAbsolute(input: string): string {
  const normalized = normalize(input)
  if (!path.isAbsolute(normalized)) {
    throw new Error(`Chemin non absolu refusé : ${input}`)
  }
  return normalized
}

function isHidden(name: string, winHidden: boolean): boolean {
  return name.startsWith('.') || winHidden
}

/**
 * Construit une DirEntry à partir d'un Dirent et d'un lstat.
 * Tolérant aux erreurs de stat (permissions, lien cassé) : renvoie des
 * valeurs neutres plutôt que de faire échouer tout le listing.
 */
async function toEntry(dirPath: string, name: string, symlink: boolean): Promise<DirEntry> {
  const full = path.join(dirPath, name)
  let size = 0
  let modifiedMs = 0
  let kind: DirEntry['kind'] = 'file'
  try {
    // stat() suit les liens : on connaît le type de la cible.
    const st = await fs.stat(full)
    kind = st.isDirectory() ? 'directory' : 'file'
    size = st.isDirectory() ? 0 : st.size
    modifiedMs = st.mtimeMs
  } catch {
    // Lien cassé ou accès refusé : on retombe sur lstat pour le type.
    try {
      const lst = await fs.lstat(full)
      kind = lst.isDirectory() ? 'directory' : 'file'
      modifiedMs = lst.mtimeMs
    } catch {
      /* on garde les valeurs neutres */
    }
  }
  return {
    name,
    path: full,
    kind,
    size,
    modifiedMs,
    hidden: isHidden(name, false),
    symlink
  }
}

/** Liste le contenu d'un dossier. Lecture paresseuse, jamais bloquante. */
export async function list(input: string): Promise<ListResult> {
  const dir = assertAbsolute(input)
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const entries = await Promise.all(
    dirents.map((d) => toEntry(dir, d.name, d.isSymbolicLink()))
  )
  const parent = path.dirname(dir)
  return {
    path: dir,
    parent: parent === dir ? null : parent,
    entries
  }
}

/** Détecte les volumes disponibles (lettres de lecteur sous Windows, « / » ailleurs). */
export async function getDrives(): Promise<DriveInfo[]> {
  if (process.platform !== 'win32') {
    return [{ path: path.sep, label: 'Racine' }]
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const checks = await Promise.all(
    letters.map(async (letter) => {
      const root = `${letter}:\\`
      try {
        await fs.access(root, fsConstants.R_OK)
        return { path: root, label: `Disque (${letter}:)` } satisfies DriveInfo
      } catch {
        return null
      }
    })
  )
  return checks.filter((d): d is DriveInfo => d !== null)
}

/** Emplacements de navigation initiaux pour la sidebar. */
export async function getLocations(): Promise<NavLocations> {
  return {
    home: os.homedir(),
    drives: await getDrives()
  }
}
