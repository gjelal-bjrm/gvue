import { create } from 'zustand'
import type { DetectedApps } from '@shared/types'

/**
 * Applications externes détectées (VS Code, Notepad++, 7-Zip). Chargées une fois
 * au démarrage ; le menu contextuel n'affiche une intégration que si l'app existe.
 */
interface AppsState {
  apps: DetectedApps
  init: () => Promise<void>
}

export const useAppsStore = create<AppsState>((set) => ({
  apps: {},
  init: async () => {
    try {
      set({ apps: await window.api.apps.list() })
    } catch {
      set({ apps: {} })
    }
  }
}))
