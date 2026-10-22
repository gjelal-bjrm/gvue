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
 * Ligne imprimée par le shell juste AVANT la commande. Tout ce qui la précède
 * est l'écho de ce qu'on a tapé — que le terminal coupe à sa largeur et que
 * readline redessine (caractères doublés) : on ne peut donc pas le reconnaître
 * ligne à ligne, seulement le couper en bloc.
 */
export function startMarker(tag: string): string {
  return `${tag}BEGIN`
}

/**
 * Commande à écrire dans le terminal : repère de début, l'originale, puis
 * l'écho balisé du code. Les repères sont ÉCRITS en morceaux (concaténation,
 * `^` de cmd) pour que leur forme imprimée n'apparaisse jamais d'un seul
 * tenant dans l'écho de la saisie. Les séparateurs rendent le code MÊME si la
 * commande échoue (`;` en POSIX/PowerShell, `&` en cmd — jamais `&&`).
 */
export function wrapCommand(command: string, tag: string, kind: ShellKind): string {
  switch (kind) {
    case 'cmd':
      // `call` + `%^errorlevel%` : la variable est lue APRÈS la commande ; un
      // simple %errorlevel% est développé à la saisie (code de la précédente).
      return `echo ${tag}^BEGIN & ${command} & call echo ${tag}%^errorlevel%${tag}`
    case 'powershell':
      // $LASTEXITCODE est vide pour une applet native : on retombe sur $? (lu
      // tout de suite, le `if` le remplacerait). `$(...)` obligatoire : collé
      // à la balise, `$LASTEXITCODE__GVUE…` serait UNE variable (inconnue).
      // Remis à vide d'abord : il garde sinon le code d'une commande ANCIENNE.
      return `$global:LASTEXITCODE = $null; Write-Output ('${tag}' + 'BEGIN'); ${command}; $__gvueOk = $?; if ($null -eq $LASTEXITCODE) { Write-Output "${tag}$(if ($__gvueOk) {0} else {1})${tag}" } else { Write-Output "${tag}$($LASTEXITCODE)${tag}" }`
    default:
      return `printf '%s%s\\n' '${tag}' 'BEGIN'; ${command}; printf '%s%s%s\\n' '${tag}' "$?" '${tag}'`
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
 * Cherche les repères dans ce que le terminal a produit.
 *
 * La sortie est ce qui sépare le repère de début (imprimé) de la balise de fin
 * portant le code : l'écho de la saisie qui précède et l'invite qui suit sont
 * écartés. Sans repère de début (sortie tronquée…), repli : on retire toute
 * ligne portant la balise.
 */
export function scanForExit(raw: string, tag: string): ExitScan {
  const lines = raw.split(/\r?\n/)
  const startIdx = lines.findIndex((l) => l.includes(startMarker(tag)))
  const endRe = new RegExp(`${escapeRe(tag)}(\\d{1,5})${escapeRe(tag)}`)
  let code: number | null = null
  const kept: string[] = []
  for (const line of startIdx >= 0 ? lines.slice(startIdx + 1) : lines) {
    const m = endRe.exec(line)
    if (m) {
      code = Number(m[1])
      // Une sortie sans saut de ligne final colle à la balise : on la garde.
      if (startIdx >= 0) {
        kept.push(line.slice(0, m.index))
        break
      }
      continue
    }
    if (startIdx < 0 && line.includes(tag)) continue
    kept.push(line)
  }
  return { done: code !== null, code, output: kept.join('\n').replace(/^\n+|\s+$/g, '') }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
