import type { SshHost } from '@shared/types'

/**
 * Clé de session d'un hôte — DOIT rester identique à `hostKeyOf` du
 * sftp-manager (côté main) : c'est elle qui indexe sessions, dossiers
 * mémorisés, derniers déploiements et mots de passe enregistrés.
 */
export function hostKeyOf(host: SshHost): string {
  return `${host.hostName ?? host.name}:${host.port ?? 22}:${host.user ?? ''}`
}

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

/**
 * Commande « terminal SSH ouvert DANS un dossier distant » (pur, testable).
 * `-t` force un TTY pour garder un shell interactif après le cd ; `bash -l`
 * couvre l'immense majorité des serveurs (repli sh si bash absent). Le chemin
 * est simple-quoté (espaces) avec l'échappement POSIX des apostrophes ; on
 * n'utilise AUCUN `$` pour que PowerShell/Git Bash locaux n'interpolent rien.
 */
export function sshCdCommandFor(host: SshHost, remoteDir: string): string {
  const quoted = `'${remoteDir.replace(/'/g, `'\\''`)}'`
  const remote = `cd ${quoted} && exec bash -l || exec sh -l`
  if (host.source === 'config') return `ssh -t ${host.name} "${remote}"`
  const target = host.user
    ? `${host.user}@${host.hostName ?? host.name}`
    : host.hostName ?? host.name
  const port = host.port ? `-p ${host.port} ` : ''
  return `ssh -t ${port}${target} "${remote}"`
}

/**
 * Fusionne des hôtes importés dans la liste existante (pur, testable).
 * Même nom + même cible → ignoré (déjà là) ; même nom mais cible différente →
 * suffixe « (2) », « (3) »… pour ne rien écraser.
 */
export function mergeHosts(existing: SshHost[], incoming: SshHost[]): SshHost[] {
  const out = [...existing]
  const sameTarget = (a: SshHost, b: SshHost): boolean =>
    (a.hostName ?? '') === (b.hostName ?? '') &&
    (a.user ?? '') === (b.user ?? '') &&
    (a.port ?? 22) === (b.port ?? 22)

  for (const host of incoming) {
    const dup = out.find((h) => h.name === host.name)
    if (dup && sameTarget(dup, host)) continue
    let name = host.name
    for (let n = 2; out.some((h) => h.name === name); n++) name = `${host.name} (${n})`
    out.push({ ...host, name })
  }
  return out
}

/** Sous-titre d'affichage : « user@hôte:port » (ce que la connexion fera). */
export function sshSubtitle(host: SshHost): string {
  const target = host.hostName ?? (host.source === 'config' ? '' : host.name)
  if (!target) return ''
  const base = host.user ? `${host.user}@${target}` : target
  return host.port && host.port !== 22 ? `${base}:${host.port}` : base
}
