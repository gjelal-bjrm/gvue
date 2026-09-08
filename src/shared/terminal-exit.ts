/**
 * Savoir QUAND une commande lancée dans un terminal se termine, et avec quel
 * code (pur, testé).
 *
 * Un terminal ne rend pas de code de sortie : il produit du texte. Sans repère,
 * on ne peut qu'attendre un délai fixe et espérer — un agent lit alors une
 * sortie tronquée et ne distingue pas la réussite de l'échec. On fait donc
 * suivre la commande d'un écho balisé qui porte le code de sortie du shell.
 *
 * La syntaxe dépend du shell : POSIX (bash/sh, donc toute session SSH), cmd,
 * ou PowerShell.
 */

export type ShellKind = 'posix' | 'cmd' | 'powershell'

/**
 * Shell auquel la commande sera réellement soumise. Une session SSH est
 * décidée par le serveur, pas par le shell local qui a lancé `ssh` : le
 * terminal peut tourner sous cmd.exe et parler à un Linux.
 */
export function shellKindOf(shellId: string | undefined, isSsh: boolean): ShellKind {
  if (isSsh) return 'posix'
  switch (shellId) {
    case 'cmd':
    case 'fallback':
      return 'cmd'
    case 'powershell':
    case 'pwsh':
      return 'powershell'
    default:
      // git-bash, wsl, zsh, sh… et repli raisonnable pour l'inconnu.
      return 'posix'
  }
}

/** Balise unique d'une exécution (évite de confondre deux commandes). */
export function makeTag(seq: number): string {
  return `__GVUE${seq}_${Date.now().toString(36)}__`
}

/**
 * Commande à écrire dans le terminal : l'originale, puis l'écho balisé.
 * Les séparateurs sont choisis pour que le code soit rendu MÊME si la
 * commande échoue (`;` en POSIX/PowerShell, `&` en cmd — jamais `&&`).
 */
export function wrapCommand(command: string, tag: string, kind: ShellKind): string {
  switch (kind) {
    case 'cmd':
      return `${command} & echo ${tag}%errorlevel%${tag}`
    case 'powershell':
      // $LASTEXITCODE est vide pour une applet native : on retombe sur $?.
      return `${command}; if ($null -eq $LASTEXITCODE) { Write-Output "${tag}$(if ($?) {0} else {1})${tag}" } else { Write-Output "${tag}$LASTEXITCODE${tag}" }`
    default:
      return `${command}; printf '${tag}%s${tag}\\n' "$?"`
  }
}

export interface ExitScan {
  /** La commande est terminée (balise vue dans la sortie). */
  done: boolean
  /** Code de sortie, null tant que la commande tourne (ou si illisible). */
  code: number | null
  /** Sortie sans l'écho de la commande ni la ligne de balise. */
  output: string
}

/**
 * Cherche la balise dans ce que le terminal a produit.
 *
 * Le terminal renvoie aussi l'écho de ce qu'on a tapé : cette ligne contient
 * la balise sans être le résultat. On ne retient donc une valeur que si elle
 * est entièrement numérique, et on retire de la sortie TOUTE ligne portant la
 * balise — écho compris.
 */
export function scanForExit(raw: string, tag: string): ExitScan {
  let code: number | null = null
  const kept: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes(tag)) {
      kept.push(line)
      continue
    }
    const m = new RegExp(`${escapeRe(tag)}(\\d{1,5})${escapeRe(tag)}`).exec(line)
    if (m) code = Number(m[1])
  }
  return { done: code !== null, code, output: kept.join('\n').replace(/^\n+|\s+$/g, '') }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
