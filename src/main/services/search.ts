import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { assertAbsolute } from './filesystem'
import type { SearchOptions, SearchMatch, SearchDone } from '@shared/types'

/**
 * Service de recherche de contenu via ripgrep.
 *
 * ripgrep est fourni par `@vscode/ripgrep` (binaire par plateforme). Comme
 * node-pty, c'est une dépendance native externe : on résout son chemin
 * paresseusement et on dégrade proprement si le binaire est introuvable —
 * l'explorateur reste utilisable, seule la recherche affiche un message d'aide.
 *
 * La sortie `--json` de ripgrep est du NDJSON (un objet par ligne). On la parse
 * en flux et on streame les correspondances par lots vers le renderer.
 */

type ResultCb = (searchId: string, matches: SearchMatch[]) => void
type DoneCb = (searchId: string, done: SearchDone) => void

const BATCH_SIZE = 40
const MAX_LINE_LENGTH = 1000

let rgPath: string | null = null
let loadError: string | null = null

/** Résout le binaire ripgrep du package plateforme, en mémoïsant l'échec. */
function resolveRgPath(): string {
  if (rgPath) return rgPath
  if (loadError) throw new Error(loadError)
  const binaryName = process.platform === 'win32' ? 'rg.exe' : 'rg'
  // Nom calculé au runtime → non analysé par le bundler, require.resolve réel.
  const pkg = `@vscode/ripgrep-${process.platform}-${process.arch}`
  try {
    // En production le binaire est hors de l'asar (asarUnpack) : on remappe le
    // chemin résolu vers app.asar.unpacked pour pouvoir l'exécuter.
    rgPath = require.resolve(`${pkg}/bin/${binaryName}`).replace('app.asar', 'app.asar.unpacked')
    return rgPath
  } catch {
    loadError =
      "Le binaire « ripgrep » est introuvable. Installez la dépendance avec " +
      '« npm install @vscode/ripgrep » pour activer la recherche.'
    throw new Error(loadError)
  }
}

/** Construit les arguments ripgrep à partir des options de recherche. */
function buildArgs(opts: SearchOptions): string[] {
  const args = ['--json', '--line-number']
  args.push(opts.caseSensitive ? '--case-sensitive' : '--ignore-case')
  if (opts.wholeWord) args.push('--word-regexp')
  if (!opts.regex) args.push('--fixed-strings')
  if (opts.includeIgnored) args.push('--no-ignore', '--hidden')
  // Tout ce qui suit « -- » est un opérande, jamais une option : le motif
  // saisi ne peut pas être interprété comme un drapeau ripgrep.
  args.push('--', opts.query, opts.dir)
  return args
}

/**
 * Convertit les décalages d'octets UTF-8 (fournis par ripgrep) en indices de
 * caractères JS, pour un surlignage correct y compris sur du non-ASCII.
 */
function byteOffsetToCharIndex(buf: Buffer, byteOffset: number): number {
  return buf.subarray(0, byteOffset).toString('utf8').length
}

interface RgMatchData {
  path: { text?: string }
  lines: { text?: string }
  line_number: number
  submatches: { start: number; end: number }[]
}

/** Parse une ligne NDJSON de type « match » en SearchMatch, ou null. */
function parseMatchLine(json: string): SearchMatch | null {
  let obj: { type?: string; data?: RgMatchData }
  try {
    obj = JSON.parse(json)
  } catch {
    return null
  }
  if (obj.type !== 'match' || !obj.data) return null
  const data = obj.data
  const file = data.path.text
  const rawLine = data.lines.text
  if (!file || rawLine === undefined) return null // lignes binaires (base64) ignorées

  const line = rawLine.replace(/\r?\n$/, '')
  const buf = Buffer.from(line, 'utf8')
  const truncated = line.length > MAX_LINE_LENGTH
  const text = truncated ? line.slice(0, MAX_LINE_LENGTH) : line

  const submatches = data.submatches
    .map((sm) => ({
      start: byteOffsetToCharIndex(buf, sm.start),
      end: byteOffsetToCharIndex(buf, sm.end)
    }))
    .filter((sm) => sm.start < text.length)
    .map((sm) => ({ start: sm.start, end: Math.min(sm.end, text.length) }))

  return { file, line: data.line_number, text, submatches }
}

const running = new Map<string, ChildProcessWithoutNullStreams>()
/** Marque une recherche comme annulée (vs. coupée au plafond) avant son « close ». */
const cancelHandlers = new Map<string, () => void>()

/**
 * Lance une recherche. L'`searchId` est fourni par l'appelant (généré côté
 * renderer) pour éliminer toute course entre l'invoke et les événements
 * streamés. Renvoie immédiatement ; les correspondances arrivent via `onResult`.
 */
export function startSearch(
  searchId: string,
  opts: SearchOptions,
  onResult: ResultCb,
  onDone: DoneCb
): void {
  // Validation du dossier racine : chemin absolu contrôlé.
  let dir: string
  try {
    dir = assertAbsolute(opts.dir)
  } catch (e) {
    onDone(searchId, doneError(e instanceof Error ? e.message : String(e)))
    return
  }

  if (!opts.query) {
    onDone(searchId, doneError('Motif de recherche vide.'))
    return
  }

  let rg: string
  try {
    rg = resolveRgPath()
  } catch (e) {
    onDone(searchId, doneError(e instanceof Error ? e.message : String(e)))
    return
  }

  const proc = spawn(rg, buildArgs({ ...opts, dir }), { cwd: dir, windowsHide: true })
  running.set(searchId, proc)

  const files = new Set<string>()
  let matchCount = 0
  let hitLimit = false
  let canceled = false
  let stdoutTail = ''
  let stderr = ''
  let batch: SearchMatch[] = []

  const flush = (): void => {
    if (batch.length === 0) return
    onResult(searchId, batch)
    batch = []
  }

  const stop = (): void => {
    hitLimit = true
    canceled = false
    try {
      proc.kill()
    } catch {
      /* déjà terminé */
    }
  }

  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk: string) => {
    if (hitLimit) return
    const lines = (stdoutTail + chunk).split('\n')
    stdoutTail = lines.pop() ?? '' // fragment éventuel conservé
    for (const raw of lines) {
      if (!raw) continue
      const match = parseMatchLine(raw)
      if (!match) continue
      files.add(match.file)
      batch.push(match)
      matchCount++
      if (batch.length >= BATCH_SIZE) flush()
      if (matchCount >= opts.maxResults) {
        flush()
        stop()
        return
      }
    }
  })

  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', (chunk: string) => {
    if (stderr.length < 2000) stderr += chunk
  })

  proc.on('error', (err) => {
    running.delete(searchId)
    cancelHandlers.delete(searchId)
    onDone(searchId, doneError(err.message))
  })

  proc.on('close', () => {
    running.delete(searchId)
    cancelHandlers.delete(searchId)
    flush()
    // ripgrep sort en code 1 quand il n'y a aucune correspondance : ce n'est
    // pas une erreur. On ne remonte stderr que s'il a écrit quelque chose et
    // qu'aucune correspondance n'a été trouvée (ex. regex invalide).
    const error = !hitLimit && matchCount === 0 && stderr.trim() ? stderr.trim() : null
    onDone(searchId, {
      matchCount,
      fileCount: files.size,
      hitLimit,
      canceled,
      error
    })
  })

  // Annuler doit marquer `canceled` (vs. hitLimit) avant que « close » ne tire.
  cancelHandlers.set(searchId, () => {
    canceled = true
  })
}

/** Annule une recherche en cours. Sans effet si l'id est inconnu. */
export function cancelSearch(searchId: string): void {
  const proc = running.get(searchId)
  if (!proc) return
  cancelHandlers.get(searchId)?.()
  try {
    proc.kill()
  } catch {
    /* déjà terminé */
  }
}

/** Termine toutes les recherches encore vivantes (fermeture de l'application). */
export function killAllSearches(): void {
  for (const proc of running.values()) {
    try {
      proc.kill()
    } catch {
      /* déjà terminé */
    }
  }
  running.clear()
}

function doneError(message: string): SearchDone {
  return { matchCount: 0, fileCount: 0, hitLimit: false, canceled: false, error: message }
}
