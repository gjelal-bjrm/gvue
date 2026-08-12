import { create } from 'zustand'

/**
 * Mode démo (DÉVELOPPEMENT uniquement) : source unique pour toutes les
 * surfaces qui doivent masquer les données réelles — sidebar, manager SSH,
 * espaces de travail, lanceur… Chaque surface oubliée est une fuite : le
 * manager SSH et les espaces de travail l'ont prouvé pendant une session
 * de captures. Toute liste nominative doit consulter ce store.
 */
interface DemoState {
  demo: boolean
  load: () => Promise<void>
}

export const useDemoStore = create<DemoState>((set) => ({
  demo: false,
  load: async () => {
    try {
      set({ demo: Boolean(await window.api.config.get('demoMode')) })
    } catch {
      set({ demo: false })
    }
  }
}))

/** Espaces de travail fictifs affichés en mode démo. */
export const DEMO_WORKSPACES = ['boutique — dev', 'api + logs', 'revue de code']

/**
 * Références vides STABLES : les sélecteurs zustand comparent par identité,
 * un `[]` littéral recréerait un objet à chaque rendu (boucle infinie).
 */
export const EMPTY_TASKS: never[] = []
export const EMPTY_ITEMS: never[] = []
export const EMPTY_FAVORITES: never[] = []
