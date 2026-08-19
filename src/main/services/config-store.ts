import Store from 'electron-store'
import * as os from 'node:os'
import type { AppConfig } from '@shared/types'
import { DEFAULT_CONFIG, sanitizeConfig } from './config-schema'
import { sameDir } from '@shared/launches'

/**
 * Store de configuration persistée (electron-store → JSON local).
 * Les valeurs par défaut définissent l'objet `appearance` appliqué au
 * démarrage. Le thème lui-même est appliqué côté renderer via variables CSS.
 * Le schéma et l'assainissement vivent dans `config-schema.ts` (pur, testé).
 */

export { DEFAULT_CONFIG }

const store = new Store<AppConfig>({
  name: 'gvue-config',
  defaults: DEFAULT_CONFIG,
  // JSON illisible/corrompu → réinitialise au lieu de planter au démarrage.
  clearInvalidConfig: true
})

// Auto-réparation au démarrage : normalise la config chargée (clés présentes,
// types corrects) pour qu'une config partielle ou abîmée ne provoque jamais une
// fenêtre blanche. On ne réécrit le disque que si quelque chose a changé.
try {
  const current = store.store
  const healed = sanitizeConfig(current)
  if (JSON.stringify(current) !== JSON.stringify(healed)) {
    store.store = healed
  }
} catch {
  store.store = DEFAULT_CONFIG
}

export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return store.get(key)
}

export function setConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  store.set(key, value)
}

export function getAllConfig(): AppConfig {
  return store.store
}

/** Ajoute un dossier en tête des récents et incrémente sa fréquence de visite. */
export function pushRecent(p: string, max = 20): void {
  const recents = store.get('recents').filter((r) => r !== p)
  recents.unshift(p)
  store.set('recents', recents.slice(0, max))

  const freq = { ...store.get('folderFreq') }
  freq[p] = (freq[p] ?? 0) + 1
  // Borne la table : au-delà, on ne garde que les 200 plus fréquents.
  const entries = Object.entries(freq)
  if (entries.length > 200) {
    const kept = entries.sort((a, b) => b[1] - a[1]).slice(0, 200)
    store.set('folderFreq', Object.fromEntries(kept))
  } else {
    store.set('folderFreq', freq)
  }
}

/** Ajoute un fichier en tête des fichiers récents (FIFO borné). */
export function pushRecentFile(p: string, max = 30): void {
  const files = store.get('recentFiles').filter((r) => r !== p)
  files.unshift(p)
  store.set('recentFiles', files.slice(0, max))
}

/**
 * Mémorise la racine d'un dépôt vue lors d'un statut Git (en tête, FIFO borné).
 *
 * Ne démasque JAMAIS : cet appel a lieu à chaque rafraîchissement de statut,
 * y compris pour des dépôts qu'on ne fait que côtoyer. C'est ce qui empêchait
 * de retirer un projet de la liste — il revenait au rafraîchissement suivant.
 * Le retour d'un projet mis de côté se décide en OUVRANT son dossier
 * (voir unhideOnVisit).
 */
export function pushProject(root: string, max = 40): void {
  // Un projet mis de côté ne remonte pas dans la liste au passage.
  if (store.get('hiddenProjects').includes(root)) return
  const roots = store.get('projectRoots').filter((r) => r !== root)
  roots.unshift(root)
  store.set('projectRoots', roots.slice(0, max))
}

/**
 * Navigation DÉLIBÉRÉE vers un dossier : si c'est la racine d'un projet mis
 * de côté, il réapparaît — « revient en rouvrant le dossier », comme annoncé
 * sur le bouton. Ouvrir un sous-dossier ne suffit pas : seul le dossier
 * racine compte, pour qu'un projet reste caché quand on ne fait que passer.
 */
export function unhideOnVisit(dir: string): void {
  const hidden = store.get('hiddenProjects')
  const match = hidden.find((r) => sameDir(r, dir))
  if (!match) return
  store.set(
    'hiddenProjects',
    hidden.filter((r) => r !== match)
  )
  const roots = store.get('projectRoots').filter((r) => !sameDir(r, match))
  store.set('projectRoots', [match, ...roots].slice(0, 40))
}


/** Retire un projet de la liste (masqué jusqu'à sa prochaine visite). */
export function hideProject(root: string): void {
  const hidden = store.get('hiddenProjects')
  if (!hidden.includes(root)) store.set('hiddenProjects', [...hidden, root])
  store.set(
    'projectRoots',
    store.get('projectRoots').filter((r) => r !== root)
  )
}

/** Réaffiche tous les projets mis de côté. */
export function unhideAllProjects(): void {
  const hidden = store.get('hiddenProjects')
  if (hidden.length === 0) return
  const roots = store.get('projectRoots')
  store.set('projectRoots', [...roots, ...hidden.filter((r) => !roots.includes(r))])
  store.set('hiddenProjects', [])
}

/** Racines masquées (exclues de la section Projets). */
export function hiddenProjects(): string[] {
  return store.get('hiddenProjects')
}

/** Emplacement par défaut au lancement : le home de l'utilisateur. */
export function defaultStartPath(): string {
  return os.homedir()
}
