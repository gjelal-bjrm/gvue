import { create } from 'zustand'

/**
 * Étagère (panier de fichiers) : on y dépose des fichiers au fil de la
 * navigation (depuis plusieurs dossiers), puis on colle/déplace tout d'un coup
 * à destination. Contrairement au presse-papiers (écrasé à chaque copie),
 * l'étagère ACCUMULE. Contenu et activation persistés dans la config.
 */

interface ShelfState {
  /** Fonctionnalité activée (Paramètres → Général) ? */
  enabled: boolean
  /** Chemins posés sur l'étagère (uniques, ordre d'ajout). */
  items: string[]
  init: () => Promise<void>
  setEnabled: (v: boolean) => void
  add: (paths: string[]) => void
  remove: (path: string) => void
  clear: () => void
}

function persist(items: string[]): void {
  void window.api.config.set('shelfItems', items)
}

export const useShelfStore = create<ShelfState>((set, get) => ({
  enabled: true,
  items: [],

  init: async () => {
    const enabled = await window.api.config.get('shelfEnabled').catch(() => true)
    const items = await window.api.config.get('shelfItems').catch(() => [] as string[])
    set({ enabled, items })
  },

  setEnabled: (v) => {
    set({ enabled: v })
    void window.api.config.set('shelfEnabled', v)
  },

  add: (paths) => {
    const items = [...get().items]
    for (const p of paths) if (!items.includes(p)) items.push(p)
    set({ items })
    persist(items)
  },

  remove: (path) => {
    const items = get().items.filter((p) => p !== path)
    set({ items })
    persist(items)
  },

  clear: () => {
    set({ items: [] })
    persist([])
  }
}))
