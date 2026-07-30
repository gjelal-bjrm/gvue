import type { IPty } from 'node-pty'
import type { TerminalCreateOptions } from '@shared/types'
import { loadPassword } from './secrets'
import { logInfo } from './logger'

/**
 * Gestionnaire de pseudo-terminaux (node-pty).
 *
 * node-pty est un module natif : si la recompilation pour l'ABI d'Electron
 * n'a pas été faite (outils de build manquants), son chargement échoue. On le
 * charge donc paresseusement et on remonte une erreur claire plutôt que de
 * faire planter tout le processus principal — l'explorateur reste utilisable.
 */

type DataCb = (ptyId: string, data: string) => void
type ExitCb = (ptyId: string, exitCode: number) => void

let ptyModule: typeof import('node-pty') | null = null
let loadError: string | null = null

function loadPty(): typeof import('node-pty') {
  if (ptyModule) return ptyModule
  if (loadError) throw new Error(loadError)
  try {
    ptyModule = require('node-pty') as typeof import('node-pty')
    return ptyModule
  } catch {
    loadError =
      "Le module natif « node-pty » n'a pas pu être chargé. " +
      'Exécutez « npm run rebuild » (les outils de build C++ Windows sont requis).'
    throw new Error(loadError)
  }
}

const sessions = new Map<string, IPty>()
let counter = 0

// Tampon de sortie par terminal (côté main), plafonné : sert au serveur MCP
// (« get_terminal_output ») pour donner les logs aux agents IA sans dépendre
// du renderer. Conservé après la fin du process (logs consultables), purgé au
// kill explicite.
const MAX_BUFFER_CHARS = 200_000
const buffers = new Map<string, { chunks: string[]; size: number }>()

/**
 * Détecte une invite de mot de passe SSH dans un fragment de sortie (pure).
 * Couvre les formulations d'OpenSSH, y compris localisées et les phrases de
 * passe de clé. Ancré en fin de fragment : c'est là que se trouve l'invite,
 * et cela évite de réagir à un mot croisé dans des logs.
 */
export function looksLikePasswordPrompt(s: string): boolean {
  const tail = s.slice(-200).toLowerCase()
  return /(password|mot de passe|passphrase)\s*(for [^:]*)?:\s*$/.test(tail)
}

/** Ajoute un fragment au tampon en respectant le plafond (logique pure). */
export function appendCapped(
  buf: { chunks: string[]; size: number },
  data: string,
  max = MAX_BUFFER_CHARS
): void {
  buf.chunks.push(data)
  buf.size += data.length
  while (buf.size > max && buf.chunks.length > 1) {
    buf.size -= buf.chunks[0].length
    buf.chunks.shift()
  }
}

/** Sortie accumulée d'un terminal (brute, séquences ANSI incluses). */
export function getPtyBuffer(id: string): string {
  return buffers.get(id)?.chunks.join('') ?? ''
}

/** Crée un pseudo-terminal et streame sa sortie via les callbacks fournis. */
export function createPty(opts: TerminalCreateOptions, onData: DataCb, onExit: ExitCb): string {
  const pty = loadPty()
  const id = `pty-${++counter}`
  const proc = pty.spawn(opts.shellPath, opts.args, {
    name: 'xterm-256color',
    cols: opts.cols || 80,
    rows: opts.rows || 24,
    cwd: opts.cwd,
    env: process.env as Record<string, string>
  })
  const buf = { chunks: [] as string[], size: 0 }
  buffers.set(id, buf)

  /*
   * Réponse automatique à l'invite de mot de passe SSH.
   *
   * Le terminal lance le binaire `ssh` du système : il ignore évidemment le
   * coffre de GVue et redemande le mot de passe. Quand l'onglet est ouvert
   * pour un serveur dont le mot de passe est enregistré, le processus
   * PRINCIPAL répond à l'invite — le secret ne transite jamais par
   * l'interface. Garde-fous : une seule réponse, et uniquement dans les
   * premières secondes (au-delà, c'est une invite d'autre chose : sudo, etc.).
   */
  const autoPassword = opts.sshHostKey ? loadPassword(opts.sshHostKey) : null
  let answered = !autoPassword
  const answerDeadline = Date.now() + 20_000

  proc.onData((d) => {
    appendCapped(buf, d)
    if (!answered && Date.now() < answerDeadline && looksLikePasswordPrompt(d)) {
      answered = true
      try {
        proc.write(`${autoPassword}\r`)
        logInfo('terminal', `Mot de passe enregistré fourni à l'invite SSH (${id}).`)
      } catch {
        /* terminal déjà fermé */
      }
    }
    onData(id, d)
  })
  proc.onExit(({ exitCode }) => {
    sessions.delete(id)
    onExit(id, exitCode)
  })
  sessions.set(id, proc)
  return id
}

export function writePty(id: string, data: string): void {
  sessions.get(id)?.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  const session = sessions.get(id)
  if (!session) return
  try {
    session.resize(Math.max(1, cols), Math.max(1, rows))
  } catch {
    /* le terminal a pu se fermer entre-temps */
  }
}

export function killPty(id: string): void {
  const session = sessions.get(id)
  buffers.delete(id)
  if (!session) return
  try {
    session.kill()
  } catch {
    /* déjà mort */
  }
  sessions.delete(id)
}

/** Tue tous les terminaux (appelé à la fermeture de l'application). */
export function killAll(): void {
  for (const id of [...sessions.keys()]) killPty(id)
}
