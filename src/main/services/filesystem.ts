import { promises as fs, constants as fsConstants } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { DirEntry, ListResult, DriveInfo, PathKind, TreeEntry } from '@shared/types'

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

// Fichiers système masqués par défaut par l'explorateur Windows. Node n'expose
// pas l'attribut « caché/système » ; on couvre au moins les noms connus.
const HIDDEN_NAMES = new Set([
  'desktop.ini',
  'thumbs.db',
  'ehthumbs.db',
  'thumbs.db:encryptable',
  '$recycle.bin',
  'system volume information',
  'pagefile.sys',
  'hiberfil.sys',
  'swapfile.sys'
])

function isHidden(name: string): boolean {
  const lower = name.toLowerCase()
  return name.startsWith('.') || HIDDEN_NAMES.has(lower) || lower.startsWith('ntuser.')
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
    hidden: isHidden(name),
    symlink
  }
}

/**
 * Construit une DirEntry pour un chemin unique (stat). Renvoie null si le
 * chemin est invalide ou inaccessible — utilisé par l'accès rapide pour filtrer
 * les entrées disparues.
 */
export async function entryFor(input: string): Promise<DirEntry | null> {
  let full: string
  try {
    full = assertAbsolute(input)
  } catch {
    return null
  }
  try {
    const st = await fs.stat(full)
    return {
      name: path.basename(full) || full,
      path: full,
      kind: st.isDirectory() ? 'directory' : 'file',
      size: st.isDirectory() ? 0 : st.size,
      modifiedMs: st.mtimeMs,
      hidden: false,
      symlink: false
    }
  } catch {
    return null
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

/** Noms des scripts du package.json d'un dossier (pour le lanceur). */
export async function packageScripts(input: string): Promise<string[]> {
  try {
    const dir = assertAbsolute(input)
    const raw = await fs.readFile(path.join(dir, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
    return pkg.scripts && typeof pkg.scripts === 'object' ? Object.keys(pkg.scripts) : []
  } catch {
    return []
  }
}

/** Extensions de fichiers directement « lançables » (pour le lanceur). */
const RUNNABLE_EXT = new Set(['.bat', '.cmd', '.ps1', '.sh', '.exe', '.py', '.js'])

/**
 * Noms des fichiers exécutables (run.bat, script.ps1, app.exe…) présents
 * directement dans un dossier, triés. Sert à proposer un fichier à lancer.
 */
export async function runnableFiles(input: string): Promise<string[]> {
  try {
    const dir = assertAbsolute(input)
    const items = await fs.readdir(dir, { withFileTypes: true })
    return items
      .filter((d) => d.isFile() && RUNNABLE_EXT.has(path.extname(d.name).toLowerCase()))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/** Dossiers ignorés lors du parcours récursif (recherche de fichiers par nom). */
const TREE_SKIP = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '.next', '.nuxt', '.cache', '.turbo',
  'coverage', '.venv', 'venv', '__pycache__', '.idea', '.vscode', 'vendor', 'target', 'bin', 'obj'
])

/**
 * Parcours récursif borné d'un dossier → liste plate (fichiers + dossiers), pour
 * la recherche de fichiers par nom. Saute les dossiers lourds/cachés et plafonne
 * à `max` entrées pour rester rapide même sur de gros dépôts.
 */
export async function listTree(input: string, max = 20000): Promise<TreeEntry[]> {
  let root: string
  try {
    root = assertAbsolute(input)
  } catch {
    return []
  }
  const out: TreeEntry[] = []
  const stack: string[] = [root]
  while (stack.length > 0 && out.length < max) {
    const dir = stack.pop() as string
    let items: import('node:fs').Dirent[]
    try {
      items = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const it of items) {
      if (out.length >= max) break
      const full = path.join(dir, it.name)
      const isDir = it.isDirectory()
      out.push({ name: it.name, path: full.replace(/\\/g, '/'), dir: isDir })
      if (isDir && !TREE_SKIP.has(it.name) && !it.name.startsWith('.')) stack.push(full)
    }
  }
  return out
}

/**
 * Complète un jeton de chemin (pour l'autocomplétion du terminal). `token` est
 * le mot en cours (peut contenir un préfixe de dossier, ex. « src/comp ») ;
 * `sep` est le séparateur à utiliser pour les dossiers (« / » ou « \\ »).
 * Renvoie les remplacements possibles du jeton (dossiers d'abord), bornés.
 */
export async function complete(input: string, token: string, sep: string): Promise<string[]> {
  try {
    const cwd = assertAbsolute(input)
    const idx = Math.max(token.lastIndexOf('/'), token.lastIndexOf('\\'))
    const dirPart = idx >= 0 ? token.slice(0, idx + 1) : ''
    const base = idx >= 0 ? token.slice(idx + 1) : token
    const baseDir = path.resolve(cwd, dirPart || '.')
    const items = await fs.readdir(baseDir, { withFileTypes: true })
    const low = base.toLowerCase()
    const matched = items.filter(
      (d) => d.name.toLowerCase().startsWith(low) && (base !== '' || !d.name.startsWith('.'))
    )
    matched.sort((a, b) => {
      const ad = a.isDirectory() ? 0 : 1
      const bd = b.isDirectory() ? 0 : 1
      return ad - bd || a.name.localeCompare(b.name)
    })
    return matched
      .slice(0, 50)
      .map((d) => dirPart + d.name + (d.isDirectory() ? sep : ''))
  } catch {
    return []
  }
}

/**
 * Sonde un chemin saisi à la main : renvoie « directory », « file » ou
 * « missing ». Sert à valider la barre d'adresse avant de naviguer.
 */
export async function probe(input: string): Promise<PathKind> {
  let target: string
  try {
    target = assertAbsolute(input)
  } catch {
    return 'missing'
  }
  try {
    const st = await fs.stat(target)
    return st.isDirectory() ? 'directory' : 'file'
  } catch {
    return 'missing'
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

/**
 * Socle des emplacements de navigation (home + lecteurs). Les dossiers connus
 * (Bureau, Téléchargements…) sont ajoutés par le handler IPC, qui seul a accès
 * à `app.getPath` d'Electron — ce service reste pur.
 */
export async function getLocations(): Promise<{ home: string; drives: DriveInfo[] }> {
  return {
    home: os.homedir(),
    drives: await getDrives()
  }
}
