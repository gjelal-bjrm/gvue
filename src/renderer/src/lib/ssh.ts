import type { SshHost } from '@shared/types'

/**
 * Commande de connexion d'un hôte SSH (pur, testable).
 * - Entrée du ~/.ssh/config : `ssh <alias>` — l'alias porte déjà tout
 *   (HostName, User, Port, clés…), on ne le double surtout pas.
 * - Hôte manuel (config GVue) : `ssh [-p port] [user@]hôte`.
 */
export function sshCommandFor(host: SshHost): string {
  if (host.source === 'config') return `ssh ${host.name}`
  const target = host.user
    ? `${host.user}@${host.hostName ?? host.name}`
    : host.hostName ?? host.name
  return host.port ? `ssh -p ${host.port} ${target}` : `ssh ${target}`
}

/** Sous-titre d'affichage : « user@hôte:port » (ce que la connexion fera). */
export function sshSubtitle(host: SshHost): string {
  const target = host.hostName ?? (host.source === 'config' ? '' : host.name)
  if (!target) return ''
  const base = host.user ? `${host.user}@${target}` : target
  return host.port && host.port !== 22 ? `${base}:${host.port}` : base
}
