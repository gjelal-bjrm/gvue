import { create } from 'zustand'
import type { TidyConfig, TidyAction } from '@shared/types'
import { readTidy } from '../lib/tidyConfig'
import { t } from '../i18n'

/**
 * Actions par défaut, semées à la première lecture (actions === undefined) :
 * des exemples concrets, éditables et duplicables. Libellés traduits à la
 * création — ensuite ce sont des DONNÉES de l'utilisateur, il en fait ce
 * qu'il veut (les supprimer toutes laisse [] : on ne ressème jamais).
 */
function defaultActions(): TidyAction[] {
  return [
    {
      id: 'defaut-numeroter',
      label: t('Renommer en fichier_1, fichier_2…'),
      kind: 'rename',
      template: 'fichier_{n}',
      counter: 1
    },
    {
      id: 'defaut-dater',
      label: t('Mettre la date devant le nom'),
      kind: 'rename',
      template: '{date} - {nom}'
    }
  ]
}

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
    const cfg = await readTidy()
    if (cfg.actions === undefined) {
      const seeded = { ...cfg, actions: defaultActions() }
      set({ tidy: seeded })
      void window.api.config.set('tidy', seeded)
      return
    }
    set({ tidy: cfg })
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
