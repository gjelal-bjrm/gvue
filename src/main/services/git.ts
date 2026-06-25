import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename } from 'node:path'
import { assertAbsolute } from './filesystem'
import type {
  GitStatus,
  GitFileChange,
  GitCategory,
  GitActionResult,
  GitProject
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
function categorize(x: string, y: string): GitCategory {
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
function parseBranch(info: string): { branch: string; ahead: number; behind: number } {
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

function parse(raw: string, root: string): GitStatus {
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
