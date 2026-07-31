import { promises as fsp } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { SshHost } from '@shared/types'

/**
 * Lecture du `~/.ssh/config` STANDARD — le contraire de PuTTY/WinSCP qui
 * inventent chacun leur magasin de sessions : un hôte configuré ici marche
 * dans GVue, VS Code, git et le `ssh` du terminal. GVue n'écrit jamais dans
 * ce fichier (ses ajouts manuels vivent dans sa propre config).
 */

const exec = promisify(execFile)

/**
 * Extrait les hôtes d'un ssh_config (pur, testable).
 * - `Host alias1 alias2` ouvre un bloc ; chaque alias devient une entrée.
 * - Les motifs génériques (`*`, `?`, négations `!`) sont ignorés : ce sont des
 *   règles de correspondance, pas des serveurs cliquables.
 * - `HostName`, `User`, `Port` du bloc renseignent l'affichage (mots-clés
 *   insensibles à la casse, séparateur espace ou `=`).
 */
/**
 * Découpe une valeur ssh_config en jetons, en respectant les guillemets :
 * « "CQFD tools" simple » → [« CQFD tools », « simple »]. Sans cela, les alias
 * multi-mots éclatent en fragments invalides (« "CQFD », « tools" »…).
 */
export function splitSshTokens(value: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    const token = (m[1] ?? m[2]).trim()
    if (token) out.push(token)
  }
  return out
}

/** Retire les guillemets englobants d'une valeur (« "mon hôte" » → « mon hôte »). */
function unquote(v: string): string {
  const m = /^"(.*)"$/.exec(v.trim())
  return m ? m[1] : v.trim()
}

export function parseSshConfig(text: string): SshHost[] {
  const out: SshHost[] = []
  let current: SshHost[] = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    // « Clé valeur » ou « Clé=valeur » (la clé est insensible à la casse).
    const m = /^(\w+)\s*(?:=|\s)\s*(.+)$/.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = unquote(m[2])

    if (key === 'host') {
      current = []
      for (const alias of splitSshTokens(m[2])) {
        if (!alias || /[*?]/.test(alias) || alias.startsWith('!')) continue
        const host: SshHost = { name: alias, source: 'config' }
        current.push(host)
        out.push(host)
      }
      continue
    }
    if (key === 'match') {
      current = [] // bloc conditionnel : pas un serveur cliquable
      continue
    }
    for (const host of current) {
      if (key === 'hostname') host.hostName = value
      else if (key === 'user') host.user = value
      else if (key === 'port') {
        const p = Number(value)
        if (Number.isInteger(p) && p > 0 && p < 65536) host.port = p
      }
    }
  }
  return out
}

/** Hôtes du ~/.ssh/config de l'utilisateur (liste vide si absent/illisible). */
export async function readSshConfigHosts(): Promise<SshHost[]> {
  try {
    const text = await fsp.readFile(join(homedir(), '.ssh', 'config'), 'utf8')
    return parseSshConfig(text)
  } catch {
    return []
  }
}

/** OpenSSH est-il disponible ? (intégré à Windows 10+, mais désactivable). */
let sshChecked: boolean | null = null
export async function sshAvailable(): Promise<boolean> {
  if (sshChecked !== null) return sshChecked
  try {
    await exec(process.platform === 'win32' ? 'where' : 'which', ['ssh'], { windowsHide: true })
    sshChecked = true
  } catch {
    sshChecked = false
  }
  return sshChecked
}

