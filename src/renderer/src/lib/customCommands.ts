/**
 * Commandes personnalisées : substitution des jetons — logique pure, testable.
 * Jetons disponibles (documentés dans le gestionnaire) :
 *   {path} chemin complet · {dir} dossier d'exécution (parent du fichier, ou le
 *   dossier lui-même) · {name} nom avec extension · {stem} nom sans extension ·
 *   {ext} extension sans point.
 * Les jetons sont substitués tels quels : mettre les guillemets dans le modèle
 * (ex. `code "{path}"`) pour les chemins avec espaces.
 */

function baseNameOf(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

function parentOf(p: string): string {
  const norm = p.replace(/[\\/]+$/, '')
  const i = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  return i > 0 ? norm.slice(0, i) : norm
}

export function substituteTokens(command: string, targetPath: string, isDir: boolean): string {
  const name = baseNameOf(targetPath)
  const dot = name.lastIndexOf('.')
  const stem = !isDir && dot > 0 ? name.slice(0, dot) : name
  const ext = !isDir && dot > 0 ? name.slice(dot + 1) : ''
  const dir = isDir ? targetPath.replace(/[\\/]+$/, '') : parentOf(targetPath)
  return command
    .replaceAll('{path}', targetPath)
    .replaceAll('{dir}', dir)
    .replaceAll('{name}', name)
    .replaceAll('{stem}', stem)
    .replaceAll('{ext}', ext)
}

/** Dossier d'exécution d'une commande pour un élément donné. */
export function cwdFor(targetPath: string, isDir: boolean): string {
  return isDir ? targetPath.replace(/[\\/]+$/, '') : parentOf(targetPath)
}
