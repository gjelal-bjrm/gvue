import type { IPty } from 'node-pty'
import type { TerminalCreateOptions } from '@shared/types'

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
  proc.onData((d) => onData(id, d))
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
