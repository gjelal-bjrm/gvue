import type { SshForward } from './types'

/**
 * Tunnels SSH (redirections de port) : syntaxe de saisie et options OpenSSH
 * (pur, testé). Partagé entre l'interface (formulaire, commande ssh) et le
 * processus principal (outils MCP des tunnels).
 */

/**
 * Options OpenSSH d'une redirection de port.
 * -L / -R : « [bind:]écoute:dest:portDest » · -D : « [bind:]écoute ».
 */
export function forwardArgs(f: SshForward): string {
  const bind = f.listenHost ? `${f.listenHost}:` : ''
  if (f.type === 'dynamic') return `-D ${bind}${f.listenPort}`
  const flag = f.type === 'local' ? '-L' : '-R'
  return `${flag} ${bind}${f.listenPort}:${f.destHost}:${f.destPort}`
}

/**
 * Lit des tunnels saisis à la main. Une par ligne (ou séparées par des
 * virgules), syntaxe volontairement proche d'OpenSSH :
 *   3001:localhost:3001      → local (le cas courant : accéder au site distant)
 *   L 8080:srv:80            → local, explicite
 *   R 9000:localhost:9000    → distant
 *   D 1080                   → proxy SOCKS
 */
export function parseForwards(text: string): SshForward[] {
  const out: SshForward[] = []
  for (const raw of (text ?? '').split(/[\n,]/)) {
    const line = raw.trim()
    if (!line) continue
    const m = /^(?:([LRD])\s*)?(.+)$/i.exec(line)
    if (!m) continue
    const letter = (m[1] ?? 'L').toUpperCase()
    const parts = m[2].split(':').map((p) => p.trim())
    const type = letter === 'L' ? 'local' : letter === 'R' ? 'remote' : 'dynamic'

    if (type === 'dynamic') {
      const port = Number(parts[parts.length - 1])
      if (Number.isInteger(port) && port > 0 && port < 65536) {
        out.push({
          type,
          listenPort: port,
          listenHost: parts.length > 1 ? parts[0] : undefined
        })
      }
      continue
    }
    // « écoute:dest:port » ou « bind:écoute:dest:port »
    const seq = parts.length === 4 ? parts.slice(1) : parts
    const listenHost = parts.length === 4 ? parts[0] : undefined
    if (seq.length !== 3) continue
    const listenPort = Number(seq[0])
    const destPort = Number(seq[2])
    if (!Number.isInteger(listenPort) || listenPort <= 0 || listenPort > 65535) continue
    if (!Number.isInteger(destPort) || destPort <= 0 || destPort > 65535) continue
    if (!seq[1]) continue
    out.push({ type, listenPort, listenHost, destHost: seq[1], destPort })
  }
  return out
}

/** Un tunnel dans la syntaxe de saisie (« R 9000:localhost:9000 »…). */
export function forwardToText(f: SshForward): string {
  const bind = f.listenHost ? `${f.listenHost}:` : ''
  if (f.type === 'dynamic') return `D ${bind}${f.listenPort}`
  const prefix = f.type === 'local' ? '' : 'R '
  return `${prefix}${bind}${f.listenPort}:${f.destHost}:${f.destPort}`
}

/** Sérialise des tunnels vers la syntaxe de saisie (une par ligne). */
export function forwardsToText(forwards: SshForward[] | undefined): string {
  return (forwards ?? []).map(forwardToText).join('\n')
}

/**
 * Tunnels déclarés dans un bloc ssh_config (LocalForward / RemoteForward /
 * DynamicForward), indexés par alias. Leur syntaxe sépare l'écoute de la
 * destination par une ESPACE : « LocalForward 8080 srv:80 ».
 */
export function forwardFromSshConfig(keyword: string, value: string): SshForward | null {
  const [listen, dest] = value.trim().split(/\s+/)
  if (!listen) return null
  const k = keyword.toLowerCase()
  const letter = k === 'localforward' ? 'L' : k === 'remoteforward' ? 'R' : k === 'dynamicforward' ? 'D' : ''
  if (!letter) return null
  if (letter !== 'D' && !dest) return null
  return parseForwards(`${letter} ${letter === 'D' ? listen : `${listen}:${dest}`}`)[0] ?? null
}
