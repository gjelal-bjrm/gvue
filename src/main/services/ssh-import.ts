import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fsp } from 'node:fs'
import { join } from 'node:path'
import type { SshHost } from '@shared/types'

/**
 * Import des sessions PuTTY et WinSCP existantes — l'utilisateur qui a déjà
 * son parc de serveurs configuré ailleurs le retrouve dans GVue en un clic.
 *
 * Sources :
 * - PuTTY  : registre HKCU\Software\SimonTatham\PuTTY\Sessions ;
 * - WinSCP : registre HKCU\Software\Martin Prikryl\WinSCP 2\Sessions,
 *            ou WinSCP.ini (mode portable).
 *
 * On n'importe QUE nom / hôte / utilisateur / port. Jamais les mots de passe
 * (WinSCP les chiffre, PuTTY n'en stocke pas) : GVue utilise les clés SSH ou
 * demande le mot de passe à la connexion — c'est un choix, pas une limite.
 */

const exec = promisify(execFile)

/** Décode les noms de session PuTTY/WinSCP (« CQFD%20-%20Lifou » → « CQFD - Lifou »). */
export function decodeSessionName(s: string): string {
  try {
    return decodeURIComponent(s) // gère aussi les séquences UTF-8 (%C3%A9 → é)
  } catch {
    // Séquences invalides : décodage octet par octet, au mieux.
    return s.replace(/%([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
  }
}

/**
 * Parse la sortie de `reg query <base> /s` (pur, testable — format observé sur
 * machine réelle : en-têtes « HKEY_… », valeurs indentées « Nom  REG_TYPE  val »,
 * ports en hexadécimal « 0x16 »). Ne garde que les sessions avec un HostName,
 * et ignore « Default Settings ».
 */
export function parseRegSessions(raw: string): SshHost[] {
  const out: SshHost[] = []
  let current: SshHost | null = null

  const push = (): void => {
    if (current && current.hostName && current.name.toLowerCase() !== 'default settings') {
      out.push(current)
    }
    current = null
  }

  for (const line of raw.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      push()
      const segment = line.trim().split('\\').pop() ?? ''
      // La ligne de la clé de base elle-même (« …\Sessions ») n'est pas une session.
      current =
        segment && segment.toLowerCase() !== 'sessions'
          ? { name: decodeSessionName(segment), source: 'manual' }
          : null
      continue
    }
    if (!current) continue
    const m = /^\s+(\w+)\s+REG_(?:SZ|DWORD|EXPAND_SZ)\s*(.*)$/.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'hostname' && value) current.hostName = value
    else if (key === 'username' && value) current.user = value
    else if (key === 'portnumber' && value) {
      const p = value.startsWith('0x') ? parseInt(value, 16) : Number(value)
      if (Number.isInteger(p) && p > 0 && p < 65536 && p !== 22) current.port = p
    }
  }
  push()
  return out
}

/**
 * Parse un WinSCP.ini (pur, testable) : sections « [Sessions\Nom%20Encodé] »,
 * clés HostName= / UserName= / PortNumber=.
 */
export function parseWinScpIni(text: string): SshHost[] {
  const out: SshHost[] = []
  let current: SshHost | null = null

  const push = (): void => {
    if (current && current.hostName && current.name.toLowerCase() !== 'default settings') {
      out.push(current)
    }
    current = null
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const section = /^\[(.+)\]$/.exec(line)
    if (section) {
      push()
      const m = /^Sessions\\(.+)$/i.exec(section[1])
      current = m ? { name: decodeSessionName(m[1]), source: 'manual' } : null
      continue
    }
    if (!current) continue
    const kv = /^(\w+)=(.*)$/.exec(line)
    if (!kv) continue
    const key = kv[1].toLowerCase()
    const value = kv[2].trim()
    if (key === 'hostname' && value) current.hostName = value
    else if (key === 'username' && value) current.user = value
    else if (key === 'portnumber' && value) {
      const p = Number(value)
      if (Number.isInteger(p) && p > 0 && p < 65536 && p !== 22) current.port = p
    }
  }
  push()
  return out
}

/** `reg query <base> /s`, ou « » si la clé n'existe pas. */
async function regQuery(base: string): Promise<string> {
  try {
    const { stdout } = await exec('reg', ['query', base, '/s'], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024
    })
    return stdout
  } catch {
    return ''
  }
}

/** Emplacements habituels de WinSCP.ini (mode portable / configuré). */
function winScpIniCandidates(): string[] {
  const home = process.env.USERPROFILE ?? ''
  return [
    join(process.env.APPDATA ?? '', 'WinSCP.ini'),
    join(home, 'Documents', 'WinSCP.ini'),
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'WinSCP', 'WinSCP.ini'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'WinSCP', 'WinSCP.ini'),
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'WinSCP', 'WinSCP.ini')
  ].filter((p) => p.length > 'WinSCP.ini'.length)
}

/** Sessions importables trouvées sur la machine, par source. */
export async function importSources(): Promise<{ putty: SshHost[]; winscp: SshHost[] }> {
  if (process.platform !== 'win32') return { putty: [], winscp: [] }

  const putty = parseRegSessions(
    await regQuery('HKCU\\Software\\SimonTatham\\PuTTY\\Sessions')
  )

  const winscp = parseRegSessions(
    await regQuery('HKCU\\Software\\Martin Prikryl\\WinSCP 2\\Sessions')
  )
  const seen = new Set(winscp.map((h) => h.name))
  for (const ini of winScpIniCandidates()) {
    try {
      const text = await fsp.readFile(ini, 'utf8')
      for (const host of parseWinScpIni(text)) {
        if (!seen.has(host.name)) {
          seen.add(host.name)
          winscp.push(host)
        }
      }
    } catch {
      /* fichier absent : normal */
    }
  }

  return { putty, winscp }
}
