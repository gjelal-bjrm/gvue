import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fsp } from 'node:fs'
import { join } from 'node:path'
import type { SshHost, SshForward } from '@shared/types'

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
 * Décode la valeur `PortForwardings` de PuTTY (pur, testable) — c'est là que
 * vivent les tunnels d'une session, et c'est ce qui manquait à l'import :
 * sans eux, la connexion s'établit mais aucun port n'est redirigé.
 *
 * Format : entrées séparées par des virgules, « <sens><écoute>=<dest> » où
 * le sens est L (local), R (distant) ou D (dynamique/SOCKS), éventuellement
 * précédé de 4/6 (famille d'adresses), et l'écoute peut porter une adresse
 * de bind. Exemples : « L3001=localhost:3001 », « 4L127.0.0.1:8080=srv:80 »,
 * « D1080= ».
 */
export function parsePortForwardings(raw: string): SshForward[] {
  const out: SshForward[] = []
  for (const part of (raw ?? '').split(',')) {
    const entry = part.trim()
    if (!entry) continue
    const m = /^[46]?([LRD])([^=]*)=(.*)$/i.exec(entry)
    if (!m) continue
    const type = m[1].toUpperCase() === 'L' ? 'local' : m[1].toUpperCase() === 'R' ? 'remote' : 'dynamic'

    // Écoute : « port » ou « adresse:port ».
    const listen = m[2].trim()
    const lastColon = listen.lastIndexOf(':')
    const listenHost = lastColon > 0 ? listen.slice(0, lastColon) : undefined
    const listenPort = Number(lastColon > 0 ? listen.slice(lastColon + 1) : listen)
    if (!Number.isInteger(listenPort) || listenPort <= 0 || listenPort > 65535) continue

    if (type === 'dynamic') {
      out.push({ type, listenPort, listenHost })
      continue
    }
    const dest = m[3].trim()
    const dc = dest.lastIndexOf(':')
    if (dc <= 0) continue
    const destPort = Number(dest.slice(dc + 1))
    if (!Number.isInteger(destPort) || destPort <= 0 || destPort > 65535) continue
    out.push({ type, listenPort, listenHost, destHost: dest.slice(0, dc), destPort })
  }
  return out
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
    } else if (key === 'portforwardings' && value) {
      const forwards = parsePortForwardings(value)
      if (forwards.length) current.forwards = forwards
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
    } else if (key === 'portforwardings' && value) {
      const forwards = parsePortForwardings(value)
      if (forwards.length) current.forwards = forwards
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
