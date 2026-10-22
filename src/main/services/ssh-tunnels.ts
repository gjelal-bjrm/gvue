import { connect } from 'node:net'
import type { SshForward, SshHost } from '@shared/types'
import { forwardToText, parseForwards } from '@shared/ssh-forward'

/**
 * Tunnels SSH vus par les outils MCP : description, état réel (le port local
 * écoute-t-il ?) et modification de la configuration des serveurs manuels.
 * Les fonctions de modification sont pures : la confirmation de l'utilisateur
 * et l'écriture de la configuration restent à l'appelant.
 */

export type TunnelState = 'active' | 'inactive' | 'port-used-elsewhere' | 'unknown'

/**
 * État d'un tunnel (pur).
 * - local / SOCKS : le port local écoute ET une session GVue vers ce serveur
 *   est connectée → actif. Un port qui écoute sans session est tenu par un
 *   autre programme.
 * - distant : il écoute sur le SERVEUR, invérifiable d'ici ; au mieux
 *   « inconnu » tant qu'une session est connectée.
 */
export function tunnelState(
  f: SshForward,
  s: { listening: boolean | null; sessionConnected: boolean }
): TunnelState {
  if (f.type === 'remote' || s.listening === null) return s.sessionConnected ? 'unknown' : 'inactive'
  if (s.listening) return s.sessionConnected ? 'active' : 'port-used-elsewhere'
  return 'inactive'
}

/** Description lisible d'un tunnel (pur). */
export function describeTunnel(f: SshForward): {
  flag: '-L' | '-R' | '-D'
  spec: string
  listen: string
  destination: string | null
} {
  const flag = f.type === 'local' ? '-L' : f.type === 'remote' ? '-R' : '-D'
  const side = f.type === 'remote' ? 'serveur' : (f.listenHost ?? 'localhost')
  return {
    flag,
    spec: forwardToText(f).replace(/^[RD] /, ''),
    listen: `${side}:${f.listenPort}`,
    destination: f.type === 'dynamic' ? null : `${f.destHost}:${f.destPort}`
  }
}

/** Adresse à sonder pour un port d'écoute local (pur). */
export function probeHost(listenHost: string | undefined): string {
  if (!listenHost || listenHost === '*' || listenHost === '0.0.0.0') return '127.0.0.1'
  return listenHost
}

/** Le port local écoute-t-il ? (connexion TCP de test, aussitôt refermée) */
export function isListening(f: SshForward, timeoutMs = 600): Promise<boolean | null> {
  if (f.type === 'remote') return Promise.resolve(null)
  return new Promise((resolve) => {
    const sock = connect({ host: probeHost(f.listenHost), port: f.listenPort })
    const done = (v: boolean): void => {
      sock.destroy()
      resolve(v)
    }
    sock.setTimeout(timeoutMs, () => done(false))
    sock.once('connect', () => done(true))
    sock.once('error', () => done(false))
  })
}

function sameListener(a: SshForward, b: SshForward): boolean {
  // -L et -D écoutent tous deux sur ce poste : même port = conflit.
  const side = (f: SshForward): string => (f.type === 'remote' ? 'remote' : 'local')
  return side(a) === side(b) && a.listenPort === b.listenPort
}

function findManual(hosts: SshHost[], name: string): number {
  const i = hosts.findIndex((h) => h.name.toLowerCase() === name.toLowerCase())
  if (i < 0) throw new Error(`Serveur introuvable parmi les serveurs gérés par GVue : ${name}.`)
  return i
}

/** Ajoute un tunnel (syntaxe « 14330:app.lan:1433 », « R … », « D … ») (pur). */
export function addForward(
  hosts: SshHost[],
  name: string,
  spec: string
): { hosts: SshHost[]; forward: SshForward } {
  const parsed = parseForwards(spec)
  if (parsed.length !== 1) {
    throw new Error(
      `Tunnel illisible : « ${spec} ». Syntaxe : « portLocal:hôte:portDistant » (-L), ` +
        '« R portServeur:hôte:port » (-R) ou « D port » (SOCKS).'
    )
  }
  const forward = parsed[0]
  const i = findManual(hosts, name)
  const current = hosts[i].forwards ?? []
  const clash = current.find((f) => sameListener(f, forward))
  if (clash) {
    throw new Error(`Le port ${forward.listenPort} est déjà pris par le tunnel « ${forwardToText(clash)} ».`)
  }
  const next = hosts.slice()
  next[i] = { ...hosts[i], forwards: [...current, forward] }
  return { hosts: next, forward }
}

/** Retire le tunnel qui écoute sur `listenPort` (et du sens donné) (pur). */
export function removeForward(
  hosts: SshHost[],
  name: string,
  listenPort: number,
  type?: SshForward['type']
): { hosts: SshHost[]; removed: SshForward } {
  const i = findManual(hosts, name)
  const current = hosts[i].forwards ?? []
  const idx = current.findIndex((f) => f.listenPort === listenPort && (!type || f.type === type))
  if (idx < 0) throw new Error(`Aucun tunnel sur le port ${listenPort} pour ${hosts[i].name}.`)
  const next = hosts.slice()
  next[i] = { ...hosts[i], forwards: current.filter((_, k) => k !== idx) }
  return { hosts: next, removed: current[idx] }
}
