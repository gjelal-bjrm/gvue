import { existsSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { spawn } from 'node:child_process'
import { assertAbsolute } from './filesystem'
import { freeName } from './fileops'
import type { DetectedApps, ExternalAppId } from '@shared/types'

/**
 * Intégrations d'applications externes (Windows) : VS Code, Notepad++, 7-Zip.
 * Détection par chemins d'installation usuels (mémoïsée). Les opérations 7-Zip
 * utilisent l'interface graphique (7zG.exe) → barre de progression native ;
 * elles sont détachées, et la vue se rafraîchit via la surveillance disque.
 */

const PF = process.env.ProgramFiles ?? 'C:\\Program Files'
const PFx = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
const LA = process.env.LOCALAPPDATA ?? ''

let cached: DetectedApps | null = null

function firstExisting(cands: string[]): string | undefined {
  for (const c of cands) if (c && existsSync(c)) return c
  return undefined
}

export function detect(): DetectedApps {
  if (cached) return cached
  cached = {
    vscode: firstExisting([
      join(LA, 'Programs', 'Microsoft VS Code', 'Code.exe'),
      join(PF, 'Microsoft VS Code', 'Code.exe'),
      join(PFx, 'Microsoft VS Code', 'Code.exe')
    ]),
    notepadpp: firstExisting([
      join(PF, 'Notepad++', 'notepad++.exe'),
      join(PFx, 'Notepad++', 'notepad++.exe')
    ]),
    sevenzip: firstExisting([join(PF, '7-Zip', '7z.exe'), join(PFx, '7-Zip', '7z.exe')])
  }
  return cached
}

/** Lance VS Code / Notepad++ sur les chemins donnés (processus détaché). */
export function openWith(appId: ExternalAppId, paths: string[]): void {
  const apps = detect()
  const exe = appId === 'vscode' ? apps.vscode : apps.notepadpp
  if (!exe || paths.length === 0) return
  const safe = paths.map((p) => assertAbsolute(p))
  spawn(exe, safe, { detached: true, stdio: 'ignore' }).unref()
}

/** Ouvre des chemins avec un exécutable arbitraire (« Ouvrir avec… »). */
export function openPathWith(exe: string, paths: string[]): void {
  if (!exe || paths.length === 0) return
  const safeExe = assertAbsolute(exe)
  const safe = paths.map((p) => assertAbsolute(p))
  spawn(safeExe, safe, { detached: true, stdio: 'ignore' }).unref()
}

/** Exécutable 7-Zip à utiliser : interface graphique si dispo, sinon CLI. */
function sevenZip(): string | null {
  const apps = detect()
  if (!apps.sevenzip) return null
  const gui = join(dirname(apps.sevenzip), '7zG.exe')
  return existsSync(gui) ? gui : apps.sevenzip
}

/** Compresse une sélection en .zip dans son dossier (nom libre). */
export async function archive(paths: string[]): Promise<{ ok: boolean; error?: string }> {
  const exe = sevenZip()
  if (!exe) return { ok: false, error: '7-Zip introuvable.' }
  if (paths.length === 0) return { ok: false, error: 'Aucun élément.' }
  const safe = paths.map((p) => assertAbsolute(p))
  const parent = dirname(safe[0])
  const label = safe.length === 1 ? basename(safe[0]) : basename(parent)
  const archivePath = await freeName(parent, `${label}.zip`)
  const names = safe.map((p) => basename(p))
  spawn(exe, ['a', archivePath, ...names], { cwd: parent, detached: true, stdio: 'ignore' }).unref()
  return { ok: true }
}

/** Extrait une archive dans un sous-dossier (nom libre) du dossier courant. */
export async function extract(archiveInput: string): Promise<{ ok: boolean; error?: string }> {
  const exe = sevenZip()
  if (!exe) return { ok: false, error: '7-Zip introuvable.' }
  const archivePath = assertAbsolute(archiveInput)
  const parent = dirname(archivePath)
  const stem = basename(archivePath, extname(archivePath))
  const outDir = await freeName(parent, stem)
  spawn(exe, ['x', basename(archivePath), `-o${outDir}`, '-y'], {
    cwd: parent,
    detached: true,
    stdio: 'ignore'
  }).unref()
  return { ok: true }
}
