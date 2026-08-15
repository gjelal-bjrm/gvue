import { existsSync, promises as fsp } from 'node:fs'
import * as path from 'node:path'
import { spawn } from 'node:child_process'
import { app, ipcMain, shell, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { detectShells, findOnPath } from './shell-detect'
import { logInfo, logError } from './logger'
import { t } from '../i18n'

/**
 * Dossier « Mes scripts » (Documents\GVue\Scripts) : les scripts que
 * l'action de rangement « Exécuter un script » peut lancer sur un fichier
 * fraîchement rangé. Le script reçoit le chemin complet du fichier en
 * premier argument.
 *
 * Sécurité : JAMAIS de découverte automatique — un script ne s'exécute que
 * si l'utilisateur l'a explicitement assigné à une règle via une action.
 */

/** Extensions acceptées → l'utilisateur voit un choix clair dans le dialogue. */
export const SCRIPT_EXTS = ['.ps1', '.bat', '.cmd', '.sh', '.js', '.py']

export function scriptsDir(): string {
  return path.join(app.getPath('documents'), 'GVue', 'Scripts')
}

// Exemples semés À LA CRÉATION du dossier seulement : ensuite c'est le
// territoire de l'utilisateur (supprimer un exemple ne le fait pas revenir).
const EXAMPLE_PS1 = `# Exemple GVue — le script reçoit le chemin du fichier rangé en 1er argument.
# Celui-ci ajoute une ligne dans journal.txt (à côté de ce script) : inoffensif,
# il montre simplement ce que vous recevez. Dupliquez-le et faites le vôtre !
param([string]$fichier)
$ligne = "$(Get-Date -Format 'yyyy-MM-dd HH:mm') — $fichier"
Add-Content -Path (Join-Path $PSScriptRoot 'journal.txt') -Value $ligne
`

const EXAMPLE_BAT = `@echo off
rem Exemple GVue — %1 contient le chemin du fichier rangé.
rem Celui-ci l'ajoute dans journal.txt, à côté de ce script.
echo %date% %time% — %~1>> "%~dp0journal.txt"
`

async function ensureDir(): Promise<string> {
  const dir = scriptsDir()
  if (!existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true })
    await fsp.writeFile(path.join(dir, 'exemple - journal.ps1'), EXAMPLE_PS1, 'utf8')
    await fsp.writeFile(path.join(dir, 'exemple - journal.bat'), EXAMPLE_BAT, 'utf8')
  }
  return dir
}

/** Scripts présents (noms de fichiers), triés, extensions reconnues seulement. */
export async function listScripts(): Promise<{ dir: string; scripts: string[] }> {
  const dir = await ensureDir()
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  const scripts = entries
    .filter((e) => e.isFile() && SCRIPT_EXTS.includes(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return { dir, scripts }
}

/**
 * Interpréteur d'un script selon son extension. null = introuvable sur cette
 * machine (message clair à l'utilisateur, pas d'échec silencieux).
 */
function interpreterFor(scriptPath: string): { exe: string; args: string[] } | null {
  const ext = path.extname(scriptPath).toLowerCase()
  const shells = detectShells()
  const by = (id: string): string | undefined => shells.find((s) => s.id === id)?.path

  switch (ext) {
    case '.ps1': {
      const ps = by('pwsh') ?? by('powershell')
      // Bypass : la stratégie d'exécution Windows bloque par défaut les .ps1
      // locaux — l'utilisateur a déjà consenti en assignant le script.
      return ps ? { exe: ps, args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath] } : null
    }
    case '.bat':
    case '.cmd': {
      const cmd = by('cmd') ?? process.env.ComSpec ?? null
      return cmd ? { exe: cmd, args: ['/c', scriptPath] } : null
    }
    case '.sh': {
      const bash = by('git-bash') ?? findOnPath(['bash.exe', 'bash'])
      return bash ? { exe: bash, args: [scriptPath] } : null
    }
    case '.js': {
      const node = findOnPath(['node.exe', 'node'])
      return node ? { exe: node, args: [scriptPath] } : null
    }
    case '.py': {
      const py = by('python') ?? findOnPath(['py.exe', 'python.exe', 'python3.exe', 'python3', 'python'])
      return py ? { exe: py, args: [scriptPath] } : null
    }
    default:
      return null
  }
}

function toastAll(message: string): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(IPC.tidyScriptError, message)
  }
}

/**
 * Lance un script sur un fichier rangé. Ne bloque jamais le rangement :
 * échec → toast explicite, détails dans le journal. Tué après 2 minutes
 * (un script d'automatisation qui traîne est un script planté).
 */
export function runTidyScript(scriptName: string, filePath: string): void {
  const script = path.join(scriptsDir(), path.basename(scriptName))
  if (!existsSync(script)) {
    toastAll(t('Script introuvable : « {name} » (dossier Mes scripts).', { name: scriptName }))
    return
  }
  const run = interpreterFor(script)
  if (!run) {
    toastAll(
      t('Aucun interpréteur trouvé pour « {name} » — installez-le ou choisissez un autre format.', {
        name: scriptName
      })
    )
    return
  }
  try {
    const child = spawn(run.exe, [...run.args, filePath], {
      cwd: path.dirname(filePath),
      windowsHide: true,
      stdio: 'ignore'
    })
    const timer = setTimeout(() => child.kill(), 2 * 60 * 1000)
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        toastAll(t('Le script « {name} » a échoué (code {code}).', { name: scriptName, code: String(code ?? '?') }))
      }
      logInfo('tidy-scripts', `${scriptName} → ${filePath} (code ${code})`)
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      logError('tidy-scripts', e)
      toastAll(t('Le script « {name} » n’a pas pu être lancé.', { name: scriptName }))
    })
  } catch (e) {
    logError('tidy-scripts', e)
    toastAll(t('Le script « {name} » n’a pas pu être lancé.', { name: scriptName }))
  }
}

export function registerTidyScriptHandlers(): void {
  ipcMain.handle(IPC.tidyScriptsList, () => listScripts())
  ipcMain.handle(IPC.tidyScriptsOpen, async () => {
    await shell.openPath(await ensureDir())
  })
}
