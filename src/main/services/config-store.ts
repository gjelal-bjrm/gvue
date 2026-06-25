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
    accent: '#7F77DD',
    theme: 'auto',
    density: 'comfortable',
    corners: 'rounded',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
    windowOpacity: 1,
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

/** Ajoute un chemin en tête des récents (FIFO borné). */
export function pushRecent(p: string, max = 20): void {
  const recents = store.get('recents').filter((r) => r !== p)
  recents.unshift(p)
  store.set('recents', recents.slice(0, max))
}

/** Emplacement par défaut au lancement : le home de l'utilisateur. */
export function defaultStartPath(): string {
  return os.homedir()
}
