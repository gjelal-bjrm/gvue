import Store from 'electron-store'
import * as os from 'node:os'
import type { AppConfig } from '@shared/types'

/**
 * Store de configuration persistée (electron-store → JSON local).
 * Les valeurs par défaut définissent l'objet `appearance` appliqué au
 * démarrage. Le thème lui-même est appliqué côté renderer via variables CSS.
 */

export const DEFAULT_CONFIG: AppConfig = {
  appearance: {
    accent: '#D85A30',
    theme: 'auto',
    density: 'comfortable',
    corners: 'rounded',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
    windowOpacity: 1,
    titleCursor: true,
    presets: {}
  },
  window: {
    width: 1200,
    height: 800,
    maximized: false
  },
  favorites: [],
  shortcuts: [],
  recents: [],
  recentFiles: [],
  folderFreq: {},
  projectRoots: [],
  openWith: {},
  workspaces: {},
  runnerTasks: [],
  runnerProfiles: [],
  projectLaunch: {},
  sidebarOrder: ['thispc', 'drives', 'favorites', 'projects'],
  sidebarCollapsed: {},
  treeExpandToCurrent: true,
  defaultShell: '',
  lastSeenVersion: '',
  hideGitIgnored: true
}

const store = new Store<AppConfig>({
  name: 'gvue-config',
  defaults: DEFAULT_CONFIG
})

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
