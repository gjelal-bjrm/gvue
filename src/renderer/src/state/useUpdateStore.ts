import { create } from 'zustand'
import type { UpdateStatus } from '@shared/types'

/**
 * État du système de mise à jour (relayé depuis le main / electron-updater).
 * `manualHint` : afficher les messages transitoires (« à jour », « indisponible »)
 * uniquement après une vérification déclenchée par l'utilisateur.
 */
interface UpdateState {
  status: UpdateStatus
  version: string
  manualHint: boolean
  dismissed: boolean
  init: () => () => void
  check: () => void
  install: () => void
  dismiss: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: { state: 'idle' },
  version: '',
  manualHint: false,
  dismissed: false,

  init: () => {
    void window.api.update.get().then(({ status, version }) => set({ status, version }))
    // Un nouveau statut réaffiche le bandeau (annule un masquage précédent).
    return window.api.update.onStatus((status) => set({ status, dismissed: false }))
  },

  check: () => {
    set({ manualHint: true, dismissed: false })
    void window.api.update.check()
  },

  install: () => void window.api.update.install(),

  dismiss: () => set({ dismissed: true, manualHint: false })
}))
