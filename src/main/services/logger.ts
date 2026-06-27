import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Journal d'application minimal (fichier dans userData/logs/gvue.log).
 * Sert à diagnostiquer les pannes en production : erreurs non interceptées du
 * processus principal, crashs du renderer, et erreurs React remontées depuis
 * l'ErrorBoundary. Rotation simple : au-delà de ~1 Mo, l'ancien fichier est
 * conservé sous gvue.log.old. Tout est best-effort : un échec d'écriture du log
 * ne doit jamais faire planter l'app.
 */
const MAX_BYTES = 1_000_000
let logFile = ''

function ensureFile(): string {
  if (logFile) return logFile
  const dir = join(app.getPath('userData'), 'logs')
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* dossier indisponible : on tentera quand même l'écriture */
  }
  const file = join(dir, 'gvue.log')
  try {
    if (existsSync(file) && statSync(file).size > MAX_BYTES) {
      renameSync(file, join(dir, 'gvue.log.old'))
    }
  } catch {
    /* rotation best-effort */
  }
  logFile = file
  return logFile
}

function write(level: 'INFO' | 'ERROR', scope: string, message: string): void {
  const line = `${new Date().toISOString()} [${level}] [${scope}] ${message}\n`
  try {
    appendFileSync(ensureFile(), line)
  } catch {
    /* pas de disque/permission : on n'aggrave pas la situation */
  }
  // Miroir console (visible en dev / lancé depuis un terminal).
  if (level === 'ERROR') console.error(line.trimEnd())
  else console.log(line.trimEnd())
}

export function logInfo(scope: string, message: string): void {
  write('INFO', scope, message)
}

export function logError(scope: string, err: unknown): void {
  const message =
    err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  write('ERROR', scope, message)
}

export function getLogPath(): string {
  return ensureFile()
}
