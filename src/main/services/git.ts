import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, join } from 'node:path'
import { promises as fsp } from 'node:fs'
import { assertAbsolute } from './filesystem'
import type {
  GitStatus,
  GitFileChange,
  GitCategory,
  GitActionResult,
  GitProject,
  GitBranches,
  GitCommit
} from '@shared/types'

/**
 * Service Git — pilote le binaire `git` du système (présent sur la machine de
 * développement) plutôt qu'une dépendance npm : zéro module natif, zéro
 * téléchargement. Tolérant : hors dépôt ou si `git` est absent, on renvoie un
 * statut « pas un dépôt » sans jamais faire échouer la navigation.
 */

const exec = promisify(execFile)

const EMPTY: GitStatus = {
  isRepo: false,
  root: '',
  branch: '',
  ahead: 0,
  behind: 0,
  files: []
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  })
  return stdout
}

/** Catégorise un code de statut porcelain (X = index, Y = copie de travail). */
export function categorize(x: string, y: string): GitCategory {
  const code = x + y
  if (code === '??') return 'untracked'
  if (code === '!!') return 'ignored'
  if (x === 'U' || y === 'U' || code === 'AA' || code === 'DD') return 'conflict'
  if (x === 'R' || y === 'R') return 'renamed'
  if (x === 'A' || y === 'A') return 'added'
  if (x === 'D' || y === 'D') return 'deleted'
  return 'modified'
}

/** Parse l'en-tête « ## branch...upstream [ahead N, behind M] ». */
export function parseBranch(info: string): { branch: string; ahead: number; behind: number } {
  let branch: string
  if (info.startsWith('No commits yet on ')) {
    branch = info.slice('No commits yet on '.length).split('...')[0].trim()
  } else if (info.startsWith('HEAD ')) {
    branch = 'HEAD (détaché)'
  } else {
    branch = info.split('...')[0].trim()
  }
  const a = info.match(/ahead (\d+)/)
  const b = info.match(/behind (\d+)/)
  return { branch, ahead: a ? Number(a[1]) : 0, behind: b ? Number(b[1]) : 0 }
}

export function parse(raw: string, root: string): GitStatus {
  const parts = raw.split('\0')
  const files: GitFileChange[] = []
  let branch = ''
  let ahead = 0
  let behind = 0

  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i]
    if (!rec) continue
    if (rec.startsWith('## ')) {
      const parsed = parseBranch(rec.slice(3))
      branch = parsed.branch
      ahead = parsed.ahead
      behind = parsed.behind
      continue
    }
    const x = rec[0]
    const y = rec[1]
    const rel = rec.slice(3)
    // Les renommages/copies émettent un second champ (chemin d'origine) : on le saute.
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') i++
    files.push({
      path: `${root}/${rel}`,
      category: categorize(x, y),
      staged: x !== ' ' && x !== '?' && x !== '!'
    })
  }

  return { isRepo: true, root, branch, ahead, behind, files }
}

/** Renvoie le statut Git du dépôt contenant `dir`, ou EMPTY hors dépôt. */
export async function status(dir: string): Promise<GitStatus> {
  let cwd: string
  try {
    cwd = assertAbsolute(dir)
  } catch {
    return EMPTY
  }

  let root: string
  try {
    root = (await git(['rev-parse', '--show-toplevel'], cwd)).trim()
  } catch {
    // Pas un dépôt, ou `git` indisponible.
    return EMPTY
  }
  if (!root) return EMPTY

  try {
    // --ignored (mode traditionnel) ajoute les entrées ignorées, dossiers
    // regroupés (node_modules/ en une ligne, sans descendre dedans).
    const raw = await git(['status', '--porcelain=v1', '--branch', '--ignored', '-z'], cwd)
    return parse(raw, root)
  } catch {
    return { ...EMPTY, isRepo: true, root }
  }
}

/**
 * Exécute une commande git et renvoie un résultat structuré (jamais d'exception
 * traversant l'IPC) : la sortie combinée stdout+stderr sert d'affichage, y
 * compris pour les erreurs (push rejeté, conflit de merge, etc.).
 */
async function run(args: string[], cwd: string): Promise<GitActionResult> {
  try {
    const { stdout, stderr } = await exec('git', args, {
      cwd,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024
    })
    return { ok: true, output: `${stdout}${stderr}`.trim() || 'OK' }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, output: (err.stderr || err.stdout || err.message || 'Échec').trim() }
  }
}

/** Indexe tout (git add -A) puis commite avec le message fourni. */
export async function commitAll(dir: string, message: string): Promise<GitActionResult> {
  let cwd: string
  try {
    cwd = assertAbsolute(dir)
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
  if (!message.trim()) return { ok: false, output: 'Message de commit vide.' }

  const staged = await run(['add', '-A'], cwd)
  if (!staged.ok) return staged
  return run(['commit', '-m', message], cwd)
}

export async function pull(dir: string): Promise<GitActionResult> {
  try {
    return run(['pull'], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

export async function push(dir: string): Promise<GitActionResult> {
  try {
    return run(['push'], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Infos légères d'un dépôt (branche + présence de modifications suivies). */
async function projectInfo(root: string): Promise<GitProject | null> {
  let cwd: string
  try {
    cwd = assertAbsolute(root)
  } catch {
    return null
  }
  let branch: string
  try {
    // Échoue si le dossier a disparu ou n'est plus un dépôt → entrée filtrée.
    branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim()
  } catch {
    return null
  }
  let dirty = false
  try {
    dirty = (await git(['status', '--porcelain', '--untracked-files=no'], cwd)).trim().length > 0
  } catch {
    /* dirty reste false */
  }
  return { root, name: basename(root) || root, branch, dirty }
}

/** Résout les infos des dépôts connus, en parallèle, en filtrant les disparus. */
export async function projects(roots: string[]): Promise<GitProject[]> {
  const infos = await Promise.all(roots.map(projectInfo))
  return infos.filter((p): p is GitProject => p !== null)
}

/** Indexe un fichier (git add). */
export async function stage(dir: string, file: string): Promise<GitActionResult> {
  try {
    return run(['add', '--', file], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Désindexe un fichier (git restore --staged). */
export async function unstage(dir: string, file: string): Promise<GitActionResult> {
  try {
    return run(['restore', '--staged', '--', file], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Annule les modifications d'un fichier suivi (revient à HEAD — destructif). */
export async function discard(dir: string, file: string): Promise<GitActionResult> {
  try {
    return run(['restore', '--source=HEAD', '--staged', '--worktree', '--', file], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Capture la sortie d'une commande git même si elle renvoie un code non nul. */
async function capture(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await exec('git', args, { cwd, windowsHide: true, maxBuffer: 32 * 1024 * 1024 })
    return stdout
  } catch (e) {
    // `git diff` (et --no-index) sortent en code 1 quand il y a des différences.
    return (e as { stdout?: string }).stdout ?? ''
  }
}

/** Diff unifié d'un fichier : indexé (--cached), suivi, ou nouveau (--no-index). */
export async function diff(
  dir: string,
  file: string,
  opts: { staged?: boolean; untracked?: boolean }
): Promise<string> {
  let cwd: string
  try {
    cwd = assertAbsolute(dir)
  } catch {
    return ''
  }
  if (opts.untracked) return capture(['diff', '--no-index', '--', '/dev/null', file], cwd)
  if (opts.staged) return capture(['diff', '--cached', '--', file], cwd)
  return capture(['diff', '--', file], cwd)
}

/** Liste des branches locales + branche courante. */
export async function branches(dir: string): Promise<GitBranches> {
  try {
    const cwd = assertAbsolute(dir)
    const current = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim()
    const out = await git(['branch', '--list', '--format=%(refname:short)'], cwd)
    const all = out.split('\n').map((s) => s.trim()).filter(Boolean)
    return { current, all }
  } catch {
    return { current: '', all: [] }
  }
}

/** Bascule sur une branche existante. */
export async function checkout(dir: string, branch: string): Promise<GitActionResult> {
  try {
    return run(['checkout', branch], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Crée une branche et bascule dessus. */
export async function createBranch(dir: string, name: string): Promise<GitActionResult> {
  if (!name.trim()) return { ok: false, output: 'Nom de branche vide.' }
  try {
    return run(['checkout', '-b', name.trim()], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Récupère les changements distants (sans fusionner). */
export async function fetch(dir: string): Promise<GitActionResult> {
  try {
    return run(['fetch', '--prune'], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Indexe tout (git add -A). */
export async function stageAll(dir: string): Promise<GitActionResult> {
  try {
    return run(['add', '-A'], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Désindexe tout (git reset). */
export async function unstageAll(dir: string): Promise<GitActionResult> {
  try {
    return run(['reset'], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Ajoute des motifs au .gitignore du dépôt (sans doublons). */
export async function ignore(dir: string, patterns: string[]): Promise<GitActionResult> {
  try {
    const root = assertAbsolute(dir)
    const file = join(root, '.gitignore')
    let existing = ''
    try {
      existing = await fsp.readFile(file, 'utf8')
    } catch {
      /* pas encore de .gitignore */
    }
    const present = new Set(
      existing.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    )
    const toAdd = patterns.map((p) => p.trim()).filter((p) => p && !present.has(p))
    if (toAdd.length === 0) return { ok: true, output: 'Déjà dans .gitignore.' }
    const lead = existing && !existing.endsWith('\n') ? '\n' : ''
    await fsp.appendFile(file, lead + toAdd.join('\n') + '\n', 'utf8')
    return { ok: true, output: `Ajouté à .gitignore : ${toAdd.join(', ')}` }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}

/** Mappe une lettre de statut « name-status » en catégorie. */
function mapNameStatus(letter: string): GitCategory {
  switch (letter) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
    case 'C':
      return 'renamed'
    case 'U':
      return 'conflict'
    default:
      return 'modified' // M, T…
  }
}

/** Historique des commits (du plus récent au plus ancien), limité à `limit`. */
export async function log(dir: string, limit = 100): Promise<GitCommit[]> {
  let cwd: string
  try {
    cwd = assertAbsolute(dir)
  } catch {
    return []
  }
  const SEP = '\x1f' // séparateur de champ
  const REC = '\x1e' // séparateur d'enregistrement
  const fmt = ['%H', '%h', '%an', '%ad', '%s'].join(SEP) + REC
  try {
    const raw = await git(
      ['log', '-n', String(limit), '--date=format:%Y-%m-%d %H:%M', `--pretty=format:${fmt}`],
      cwd
    )
    return raw
      .split(REC)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((rec) => {
        const [hash, shortHash, author, date, subject] = rec.split(SEP)
        return { hash, shortHash, author, date, subject: subject ?? '' }
      })
  } catch {
    return []
  }
}

/** Fichiers modifiés par un commit (statut + chemin absolu). */
export async function commitFiles(dir: string, hash: string): Promise<GitFileChange[]> {
  let cwd: string
  try {
    cwd = assertAbsolute(dir)
  } catch {
    return []
  }
  let root: string
  try {
    root = (await git(['rev-parse', '--show-toplevel'], cwd)).trim()
  } catch {
    return []
  }
  try {
    // --root : l'initial commit est comparé à l'arbre vide (tous les fichiers ajoutés).
    const raw = await git(
      ['diff-tree', '--no-commit-id', '--name-status', '-r', '--root', '-z', hash],
      cwd
    )
    return parseNameStatusZ(raw, root)
  } catch {
    return []
  }
}

/**
 * Parse une sortie `--name-status -z` (statut\0chemin\0…, renommage = statut\0
 * ancien\0nouveau\0) en fichiers, chemins rendus absolus sous `root`.
 */
export function parseNameStatusZ(raw: string, root: string): GitFileChange[] {
  const toks = raw.split('\0')
  const files: GitFileChange[] = []
  let i = 0
  while (i < toks.length) {
    const status = toks[i]
    if (!status) {
      i++
      continue
    }
    const letter = status[0]
    if (letter === 'R' || letter === 'C') {
      const newp = toks[i + 2] // [status, ancien, nouveau]
      i += 3
      if (newp) files.push({ path: `${root}/${newp}`, category: 'renamed', staged: false })
    } else {
      const p = toks[i + 1]
      i += 2
      if (p) files.push({ path: `${root}/${p}`, category: mapNameStatus(letter), staged: false })
    }
  }
  return files
}

/** Diff d'un fichier dans un commit donné (commit vs son parent). */
export async function commitDiff(dir: string, hash: string, file: string): Promise<string> {
  let cwd: string
  try {
    cwd = assertAbsolute(dir)
  } catch {
    return ''
  }
  let root: string
  try {
    root = (await git(['rev-parse', '--show-toplevel'], cwd)).trim()
  } catch {
    return ''
  }
  const rel = file.startsWith(root + '/') ? file.slice(root.length + 1) : file
  // --format= retire l'en-tête du commit ; reste le patch du fichier.
  return capture(['show', '--format=', hash, '--', rel], cwd)
}

/** Commite uniquement les fichiers déjà indexés. */
export async function commitStaged(dir: string, message: string): Promise<GitActionResult> {
  if (!message.trim()) return { ok: false, output: 'Message de commit vide.' }
  try {
    return run(['commit', '-m', message], assertAbsolute(dir))
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) }
  }
}
