/**
 * Lancements d'un projet : le bouton ▶ de la sidebar en accepte désormais
 * plusieurs (dév, build, déploiement…), chacun avec son icône.
 *
 * Pur et partagé : le renderer édite, la sidebar et la barre du terminal
 * affichent, et tout le monde lit l'ancien format de la même façon.
 */

/** Icônes proposées (clés stables : le rendu vit côté renderer). */
export const LAUNCH_ICONS = [
  'play',
  'build',
  'test',
  'deploy',
  'terminal',
  'database',
  'refresh',
  'bug'
] as const
export type LaunchIcon = (typeof LAUNCH_ICONS)[number]

/**
 * Plafond volontaire : au-delà, la ligne d'un projet dans la sidebar n'a plus
 * la place d'afficher les icônes sans écraser le nom du dossier.
 */
export const MAX_LAUNCHES = 4

export interface ProjectLaunch {
  id: string
  /** Libellé court, montré en infobulle et dans la barre du terminal. */
  name: string
  command: string
  icon: LaunchIcon
}

/** Valeur persistée : ancien format (une commande) ou liste de lancements. */
export type StoredLaunch = string | ProjectLaunch[] | undefined

/**
 * Lit la config d'un projet quel que soit son format. Une chaîne (config
 * d'avant les lancements multiples) devient un lancement unique — les
 * projets déjà configurés continuent de marcher sans migration.
 */
export function normalizeLaunches(stored: StoredLaunch): ProjectLaunch[] {
  if (!stored) return []
  if (typeof stored === 'string') {
    const command = stored.trim()
    return command ? [{ id: 'principal', name: 'Lancer', command, icon: 'play' }] : []
  }
  return stored.filter((l) => l && typeof l.command === 'string' && l.command.trim())
}

/** Normalise un chemin Windows : sans séparateur final, en minuscules. */
function normPath(p: string): string {
  return p
    .replace(/[\\/]+$/, '')
    .replace(/\//g, '\\')
    .toLowerCase()
}

/**
 * Projet auquel appartient un dossier : la racine configurée la PLUS LONGUE
 * qui le contient (un sous-dossier hérite des lancements de son projet).
 */
export function projectOf(dir: string, roots: string[]): string | null {
  const target = normPath(dir)
  let best: string | null = null
  for (const root of roots) {
    const r = normPath(root)
    if (target === r || target.startsWith(r + '\\')) {
      if (!best || r.length > normPath(best).length) best = root
    }
  }
  return best
}

/** Deux chemins désignent-ils le même dossier ? (Windows : casse et / \ libres) */
export function sameDir(a: string, b: string): boolean {
  return normPath(a) === normPath(b)
}
