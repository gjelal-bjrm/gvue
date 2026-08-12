import { create } from 'zustand'
import type { TidyConfig } from '@shared/types'
import { readTidy } from '../lib/tidyConfig'

/**
 * Source de vérité UNIQUE du rangement auto côté renderer. Fini les copies
 * locales par composant (item sidebar, bandeau, dialogue, Paramètres) qui se
 * désynchronisaient : basculer depuis la sidebar laissait le bandeau afficher
 * « désactivé ». Toutes les surfaces s'abonnent ici ; le main notifie chaque
 * changement (IPC tidyChanged, émis par syncTidy — donc aussi pour le tray).
 */
interface TidyState {
  tidy: TidyConfig | null
  load: () => Promise<void>
  /** Écrit la config complète (éditeur de règles) et met l'état à jour. */
  save: (next: TidyConfig) => void
  /** Bascule le drapeau sur la base de l'état FRAIS du disque. */
  setEnabled: (v: boolean) => void
}

export const useTidyStore = create<TidyState>((set) => ({
  tidy: null,

  load: async () => {
    set({ tidy: await readTidy() })
  },

  save: (next) => {
    set({ tidy: next })
    void window.api.config.set('tidy', next)
  },

  setEnabled: (v) => {
    void readTidy().then((cur) => {
      const next = { ...cur, enabled: v }
      set({ tidy: next })
      void window.api.config.set('tidy', next)
    })
  }
}))
