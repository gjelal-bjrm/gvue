import type { SshHost, SshForward } from '@shared/types'
import { forwardArgs } from '@shared/ssh-forward'
import { t } from '../i18n'

// Syntaxe des tunnels : partagée avec le processus principal (outils MCP).
export { forwardArgs, parseForwards, forwardsToText } from '@shared/ssh-forward'

/** Toutes les options de tunnel d'un hôte, prêtes à insérer dans la commande. */
function forwardsOf(host: SshHost): string {
  const list = (host.forwards ?? []).map(forwardArgs).join(' ')
  return list ? `${list} ` : ''
}

/**
 * Options SSH avancées d'un hôte (pur, testable) : clé privée, relais (-J),
 * keep-alive, X11, compression — les panneaux importants de PuTTY, en options
 * OpenSSH. Se termine par une espace si non vide (insertion directe).
 */
export function sshOptions(host: SshHost): string {
  const parts: string[] = []
  if (host.keyFile) parts.push(`-i "${host.keyFile}"`)
  if (host.proxyJump) parts.push(`-J ${host.proxyJump}`)
  if (host.keepAlive) parts.push('-o ServerAliveInterval=30')
  if (host.x11) parts.push('-X')
  if (host.compression) parts.push('-C')
  return parts.length ? `${parts.join(' ')} ` : ''
}

/**
 * Exporte des hôtes au format ssh_config STANDARD (pur, testable) — le format
 * qu'utilisent OpenSSH, VS Code Remote-SSH, git… Les noms contenant des
 * espaces sont quotés ; les tunnels deviennent LocalForward/RemoteForward/
 * DynamicForward ; un alias du ~/.ssh/config sans cible connue est émis en
 * commentaire (sa définition complète vit déjà dans le fichier).
 */
export function toSshConfigText(hosts: SshHost[]): string {
  const quote = (s: string): string => (/\s/.test(s) ? `"${s}"` : s)
  const genComment = t('Généré par GVue — collez dans ~/.ssh/config (ou incluez ce fichier).')
  const blocks: string[] = [`# ${genComment}`, '# Compatible OpenSSH, VS Code Remote-SSH, git.']
  for (const h of hosts) {
    if (!h.hostName) {
      const aliasComment = t('{name} : déjà défini dans votre ~/.ssh/config (alias).', { name: h.name })
      blocks.push(`\n# ${aliasComment}`)
      continue
    }
    const lines = [`\nHost ${quote(h.name)}`, `  HostName ${h.hostName}`]
    if (h.user) lines.push(`  User ${h.user}`)
    if (h.port && h.port !== 22) lines.push(`  Port ${h.port}`)
    for (const f of h.forwards ?? []) {
      const bind = f.listenHost ? `${f.listenHost}:` : ''
      if (f.type === 'dynamic') lines.push(`  DynamicForward ${bind}${f.listenPort}`)
      else if (f.type === 'local')
        lines.push(`  LocalForward ${bind}${f.listenPort} ${f.destHost}:${f.destPort}`)
      else lines.push(`  RemoteForward ${bind}${f.listenPort} ${f.destHost}:${f.destPort}`)
    }
    blocks.push(lines.join('\n'))
  }
  return blocks.join('\n') + '\n'
}

/** Résumé lisible d'un tunnel (infobulles, formulaire). */
export function describeForward(f: SshForward): string {
  const bind = f.listenHost ? `${f.listenHost}:` : 'localhost:'
  if (f.type === 'dynamic') return `SOCKS ${bind}${f.listenPort}`
  return f.type === 'local'
    ? `${bind}${f.listenPort} → ${f.destHost}:${f.destPort}`
    : t('serveur:{port} → {host}:{destPort} (distant)', {
        port: f.listenPort,
        host: f.destHost ?? '',
        destPort: f.destPort ?? ''
      })
}

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
  const opts = `${sshOptions(host)}${forwardsOf(host)}`
  if (host.source === 'config') return `ssh ${opts}${host.name}`
  const target = host.user
    ? `${host.user}@${host.hostName ?? host.name}`
    : host.hostName ?? host.name
  const port = host.port ? `-p ${host.port} ` : ''
  return `ssh ${opts}${port}${target}`
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
  const opts = `${sshOptions(host)}${forwardsOf(host)}`
  if (host.source === 'config') return `ssh -t ${opts}${host.name} "${remote}"`
  const target = host.user
    ? `${host.user}@${host.hostName ?? host.name}`
    : host.hostName ?? host.name
  const port = host.port ? `-p ${host.port} ` : ''
  return `ssh -t ${opts}${port}${target} "${remote}"`
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
    if (dup && sameTarget(dup, host)) {
      // Même serveur ré-importé : on rafraîchit ses tunnels (un import
      // antérieur au support des forwards les avait laissés de côté).
      if (host.forwards?.length) dup.forwards = host.forwards
      continue
    }
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
