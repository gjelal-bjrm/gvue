import { create } from 'zustand'

/**
 * Favoris (dossiers épinglés) — source de vérité côté renderer, synchronisée
 * dans electron-store (`favorites`). Ajout/retrait depuis le menu contextuel
 * et la sidebar.
 */
interface FavoritesState {
  favorites: string[]
  init: () => Promise<void>
  add: (path: string) => void
  remove: (path: string) => void
  toggle: (path: string) => void
  has: (path: string) => boolean
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],

  init: async () => {
    try {
      const favorites = await window.api.config.get('favorites')
      set({ favorites: favorites ?? [] })
    } catch {
      set({ favorites: [] })
    }
  },

  add: (path) => {
    if (!path || get().favorites.includes(path)) return
    const favorites = [...get().favorites, path]
    set({ favorites })
    void window.api.config.set('favorites', favorites)
  },

  remove: (path) => {
    const favorites = get().favorites.filter((f) => f !== path)
    set({ favorites })
    void window.api.config.set('favorites', favorites)
  },

  toggle: (path) => {
    if (get().has(path)) get().remove(path)
    else get().add(path)
  },

  has: (path) => get().favorites.includes(path)
}))
