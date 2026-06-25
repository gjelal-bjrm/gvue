import { create } from 'zustand'

/**
 * Associations « Ouvrir avec » mémorisées par extension de fichier (ext → exes),
 * persistées dans electron-store. Permet de reproposer les programmes choisis
 * pour tous les fichiers du même type.
 */
const MAX_PER_EXT = 6

interface OpenWithState {
  map: Record<string, string[]>
  init: () => Promise<void>
  get: (ext: string) => string[]
  add: (ext: string, exe: string) => void
  remove: (ext: string, exe: string) => void
}

export const useOpenWithStore = create<OpenWithState>((set, get) => ({
  map: {},

  init: async () => {
    try {
      const map = await window.api.config.get('openWith')
      set({ map: map ?? {} })
    } catch {
      set({ map: {} })
    }
  },

  get: (ext) => get().map[ext] ?? [],

  add: (ext, exe) => {
    if (!exe) return
    const current = get().map[ext] ?? []
    if (current.includes(exe)) return
    const map = { ...get().map, [ext]: [exe, ...current].slice(0, MAX_PER_EXT) }
    set({ map })
    void window.api.config.set('openWith', map)
  },

  remove: (ext, exe) => {
    const current = get().map[ext] ?? []
    const map = { ...get().map, [ext]: current.filter((e) => e !== exe) }
    set({ map })
    void window.api.config.set('openWith', map)
  }
}))
