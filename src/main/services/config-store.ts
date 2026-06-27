import Store from 'electron-store'
import * as os from 'node:os'
import type { AppConfig } from '@shared/types'
import { DEFAULT_CONFIG, sanitizeConfig } from './config-schema'

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

/** Mémorise la racine d'un dépôt visité (en tête, FIFO borné). */
export function pushProject(root: string, max = 15): void {
  const roots = store.get('projectRoots').filter((r) => r !== root)
  roots.unshift(root)
  store.set('projectRoots', roots.slice(0, max))
}

/** Emplacement par défaut au lancement : le home de l'utilisateur. */
export function defaultStartPath(): string {
  return os.homedir()
}
