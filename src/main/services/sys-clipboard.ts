import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SysClipboardFiles } from '@shared/types'

/**
 * Presse-papiers *système* de fichiers (Windows) : lit/écrit la FileDropList
 * (CF_HDROP) + le flux « Preferred DropEffect » (copier vs couper), ce
 * qu'Electron ne sait pas faire nativement. Piloté par PowerShell en STA
 * (obligatoire pour le presse-papiers OLE). Permet Ctrl+C dans l'Explorateur →
 * Ctrl+V dans GVue et inversement.
 */

const exec = promisify(execFile)

async function runPs(script: string): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const { stdout } = await exec(
    'powershell.exe',
    ['-NoProfile', '-STA', '-NonInteractive', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: 10_000, maxBuffer: 4 * 1024 * 1024 }
  )
  return stdout
}

/** Chemin → littéral PowerShell simple-quoté (séparateurs Windows). */
function psPath(p: string): string {
  return `'${p.replace(/\//g, '\\').replace(/'/g, "''")}'`
}

/**
 * Lit la liste de fichiers du presse-papiers système, avec l'intention
 * copier/couper de la source. Null si pas de fichiers (ou hors Windows).
 */
export async function readFileClipboard(): Promise<SysClipboardFiles | null> {
  if (process.platform !== 'win32') return null
  const script = [
    `Add-Type -AssemblyName System.Windows.Forms`,
    `$d = [System.Windows.Forms.Clipboard]::GetDataObject()`,
    `if ($d -and $d.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {`,
    `  $files = @($d.GetData([System.Windows.Forms.DataFormats]::FileDrop))`,
    `  $effect = 5`,
    `  $s = $d.GetData('Preferred DropEffect')`,
    `  if ($s -is [System.IO.Stream]) { $b = New-Object byte[] 4; [void]$s.Read($b, 0, 4); $effect = $b[0] }`,
    `  @{ files = $files; move = (($effect -band 2) -ne 0) } | ConvertTo-Json -Compress`,
    `}`
  ].join('\n')
  try {
    const out = (await runPs(script)).trim()
    if (!out) return null
    const parsed = JSON.parse(out) as { files: string | string[]; move: boolean }
    const files = (Array.isArray(parsed.files) ? parsed.files : [parsed.files]).filter(Boolean)
    return files.length ? { files, move: !!parsed.move } : null
  } catch {
    return null
  }
}

/**
 * Place des fichiers dans le presse-papiers système (FileDropList), avec
 * l'effet copier ou couper — l'Explorateur Windows saura les coller.
 */
export async function writeFileClipboard(files: string[], move: boolean): Promise<boolean> {
  if (process.platform !== 'win32' || files.length === 0) return false
  const adds = files.map((f) => `[void]$col.Add(${psPath(f)})`).join('\n')
  const effect = move ? 2 : 5 // DROPEFFECT_MOVE : DROPEFFECT_COPY|LINK
  const script = [
    `Add-Type -AssemblyName System.Windows.Forms`,
    `$col = New-Object System.Collections.Specialized.StringCollection`,
    adds,
    `$d = New-Object System.Windows.Forms.DataObject`,
    `$d.SetFileDropList($col)`,
    `$ms = New-Object System.IO.MemoryStream`,
    `$ms.Write([byte[]](${effect},0,0,0), 0, 4)`,
    `$ms.Position = 0`,
    `$d.SetData('Preferred DropEffect', $ms)`,
    `[System.Windows.Forms.Clipboard]::SetDataObject($d, $true)`,
    `'OK'`
  ].join('\n')
  try {
    return (await runPs(script)).includes('OK')
  } catch {
    return false
  }
}

/** Vide le presse-papiers système (après un couper-coller consommé). */
export async function clearFileClipboard(): Promise<void> {
  if (process.platform !== 'win32') return
  try {
    await runPs(
      `Add-Type -AssemblyName System.Windows.Forms\n[System.Windows.Forms.Clipboard]::Clear()`
    )
  } catch {
    /* sans gravité */
  }
}
