import type { SshHost, SshForward } from '@shared/types'

/**
 * Options OpenSSH d'une redirection de port (pur, testable).
 * -L / -R : « [bind:]écoute:dest:portDest » · -D : « [bind:]écoute ».
 */
export function forwardArgs(f: SshForward): string {
  const bind = f.listenHost ? `${f.listenHost}:` : ''
  if (f.type === 'dynamic') return `-D ${bind}${f.listenPort}`
  const flag = f.type === 'local' ? '-L' : '-R'
  return `${flag} ${bind}${f.listenPort}:${f.destHost}:${f.destPort}`
}

/** Toutes les options de tunnel d'un hôte, prêtes à insérer dans la commande. */
function forwardsOf(host: SshHost): string {
  const list = (host.forwards ?? []).map(forwardArgs).join(' ')
  return list ? `${list} ` : ''
}

/**
 * Lit des tunnels saisis à la main (pur, testable). Une par ligne (ou séparées
 * par des virgules), syntaxe volontairement proche de PuTTY et d'OpenSSH :
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

/** Sérialise des tunnels vers la syntaxe de saisie (une par ligne). */
export function forwardsToText(forwards: SshForward[] | undefined): string {
  return (forwards ?? [])
    .map((f) => {
      const bind = f.listenHost ? `${f.listenHost}:` : ''
      if (f.type === 'dynamic') return `D ${bind}${f.listenPort}`
      const prefix = f.type === 'local' ? '' : 'R '
      return `${prefix}${bind}${f.listenPort}:${f.destHost}:${f.destPort}`
    })
    .join('\n')
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
  const blocks: string[] = [
    '# Généré par GVue — collez dans ~/.ssh/config (ou incluez ce fichier).',
    '# Compatible OpenSSH, VS Code Remote-SSH, git.'
  ]
  for (const h of hosts) {
    if (!h.hostName) {
      blocks.push(`\n# ${h.name} : déjà défini dans votre ~/.ssh/config (alias).`)
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
    : `serveur:${f.listenPort} → ${f.destHost}:${f.destPort} (distant)`
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
  const fwd = forwardsOf(host)
  if (host.source === 'config') return `ssh ${fwd}${host.name}`
  const target = host.user
    ? `${host.user}@${host.hostName ?? host.name}`
    : host.hostName ?? host.name
  const port = host.port ? `-p ${host.port} ` : ''
  return `ssh ${fwd}${port}${target}`
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
  const fwd = forwardsOf(host)
  if (host.source === 'config') return `ssh -t ${fwd}${host.name} "${remote}"`
  const target = host.user
    ? `${host.user}@${host.hostName ?? host.name}`
    : host.hostName ?? host.name
  const port = host.port ? `-p ${host.port} ` : ''
  return `ssh -t ${fwd}${port}${target} "${remote}"`
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
