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

/**
 * Boîte de dialogue Windows « Ouvrir avec » : propose toutes les applications
 * enregistrées dans le registre pour ce type de fichier (comme l'explorateur).
 */
export function openAsDialog(input: string): void {
  if (process.platform !== 'win32') return
  const safe = assertAbsolute(input)
  spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', safe], {
    detached: true,
    stdio: 'ignore'
  }).unref()
}

/**
 * Boîte « Propriétés » de l'explorateur Windows (taille, sécurité, versions…),
 * via le verbe shell COM. Contrainte Windows : la boîte appartient au processus
 * qui l'invoque → un PowerShell caché reste vivant en arrière-plan (30 min max)
 * le temps que l'utilisateur la consulte, puis s'éteint seul.
 */
export function showProperties(input: string): void {
  if (process.platform !== 'win32') return
  const safe = assertAbsolute(input)
  const esc = safe.replace(/'/g, "''")
  const script =
    `$p='${esc}'; $sh=New-Object -ComObject Shell.Application; ` +
    `$parent=Split-Path $p; $leaf=Split-Path $p -Leaf; ` +
    `$item = if ($parent) { $sh.NameSpace($parent).ParseName($leaf) } else { $sh.NameSpace($p).Self }; ` +
    `if ($item) { $item.InvokeVerb('Properties'); Start-Sleep -Seconds 1800 }`
  spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref()
}

/** Exécutable 7-Zip à utiliser : interface graphique si dispo, sinon CLI. */
function sevenZip(): string | null {
  const apps = detect()
  if (!apps.sevenzip) return null
  const gui = join(dirname(apps.sevenzip), '7zG.exe')
  return existsSync(gui) ? gui : apps.sevenzip
}

/** Compresse une sélection en .zip dans son dossier (ou un dossier cible). */
export async function archive(
  paths: string[],
  destDir?: string
): Promise<{ ok: boolean; error?: string }> {
  const exe = sevenZip()
  if (!exe) return { ok: false, error: '7-Zip introuvable.' }
  if (paths.length === 0) return { ok: false, error: 'Aucun élément.' }
  const safe = paths.map((p) => assertAbsolute(p))
  const parent = dirname(safe[0])
  const outParent = destDir ? assertAbsolute(destDir) : parent
  const label = safe.length === 1 ? basename(safe[0]) : basename(parent)
  const archivePath = await freeName(outParent, `${label}.zip`)
  const names = safe.map((p) => basename(p))
  spawn(exe, ['a', archivePath, ...names], { cwd: parent, detached: true, stdio: 'ignore' }).unref()
  return { ok: true }
}

/** Extrait une archive dans un sous-dossier (nom libre) du dossier d'origine ou cible. */
export async function extract(
  archiveInput: string,
  destDir?: string
): Promise<{ ok: boolean; error?: string }> {
  const exe = sevenZip()
  if (!exe) return { ok: false, error: '7-Zip introuvable.' }
  const archivePath = assertAbsolute(archiveInput)
  const parent = dirname(archivePath)
  const outParent = destDir ? assertAbsolute(destDir) : parent
  const stem = basename(archivePath, extname(archivePath))
  const outDir = await freeName(outParent, stem)
  spawn(exe, ['x', basename(archivePath), `-o${outDir}`, '-y'], {
    cwd: parent,
    detached: true,
    stdio: 'ignore'
  }).unref()
  return { ok: true }
}
