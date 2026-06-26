import { existsSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { ShellInfo } from '@shared/types'

/**
 * Détection dynamique des shells disponibles (cf. section 2 de la spec).
 * Pur et testable : ne dépend que de l'existence de fichiers connus.
 */

function firstExisting(paths: string[]): string | null {
  return paths.find((p) => existsSync(p)) ?? null
}

/** Cherche le premier exécutable trouvé dans le PATH (ordre des noms = priorité). */
function findOnPath(names: string[]): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const name of names) {
    for (const dir of dirs) {
      const full = path.join(dir, name)
      if (existsSync(full)) return full
    }
  }
  return null
}

function detectWindows(): ShellInfo[] {
  const shells: ShellInfo[] = []
  const sysRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  const localAppData = process.env.LOCALAPPDATA ?? ''

  // Windows PowerShell (toujours présent)
  const powershell = `${sysRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  if (existsSync(powershell)) {
    shells.push({ id: 'powershell', label: 'PowerShell', path: powershell, args: ['-NoLogo'] })
  }

  // PowerShell 7+ (pwsh) si installé
  const pwsh = firstExisting([
    `${programFiles}\\PowerShell\\7\\pwsh.exe`,
    `${programFiles}\\PowerShell\\7-preview\\pwsh.exe`
  ])
  if (pwsh) shells.push({ id: 'pwsh', label: 'PowerShell 7', path: pwsh, args: ['-NoLogo'] })

  // cmd.exe
  const cmd = process.env.ComSpec ?? `${sysRoot}\\System32\\cmd.exe`
  if (existsSync(cmd)) shells.push({ id: 'cmd', label: 'Invite de commandes', path: cmd, args: [] })

  // Git Bash
  const gitBash = firstExisting([
    `${programFiles}\\Git\\bin\\bash.exe`,
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    `${localAppData}\\Programs\\Git\\bin\\bash.exe`
  ])
  if (gitBash) shells.push({ id: 'git-bash', label: 'Git Bash', path: gitBash, args: ['--login', '-i'] })

  // WSL
  const wsl = `${sysRoot}\\System32\\wsl.exe`
  if (existsSync(wsl)) shells.push({ id: 'wsl', label: 'WSL', path: wsl, args: [] })

  // Python (REPL) — via le lanceur « py » (fiable) ou « python » dans le PATH.
  // « py » d'abord pour éviter le stub Windows Store de python.exe.
  const python = findOnPath(['py.exe', 'python.exe', 'python3.exe'])
  if (python) shells.push({ id: 'python', label: 'Python', path: python, args: [] })

  return shells
}

function detectUnix(): ShellInfo[] {
  const shells: ShellInfo[] = []
  const candidates: { id: string; label: string; path: string }[] = [
    { id: 'zsh', label: 'zsh', path: '/bin/zsh' },
    { id: 'bash', label: 'bash', path: '/bin/bash' },
    { id: 'sh', label: 'sh', path: '/bin/sh' }
  ]
  // Shell par défaut de l'utilisateur en tête s'il est connu.
  const userShell = process.env.SHELL
  if (userShell && existsSync(userShell)) {
    shells.push({ id: 'default', label: userShell.split('/').pop() ?? 'shell', path: userShell, args: [] })
  }
  for (const c of candidates) {
    if (existsSync(c.path) && c.path !== userShell) {
      shells.push({ ...c, args: [] })
    }
  }
  // Python (REPL) si présent dans le PATH.
  const python = findOnPath(['python3', 'python'])
  if (python) shells.push({ id: 'python', label: 'Python', path: python, args: [] })
  return shells
}

/** Liste les shells disponibles, le shell par défaut en premier. */
export function detectShells(): ShellInfo[] {
  const list = process.platform === 'win32' ? detectWindows() : detectUnix()
  if (list.length === 0) {
    // Filet de sécurité : au pire, on renvoie un shell générique.
    const fallback = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    list.push({ id: 'fallback', label: 'Shell', path: fallback, args: [] })
  }
  return list
}

/** Répertoire de départ par défaut d'un terminal. */
export function defaultCwd(): string {
  return os.homedir()
}
