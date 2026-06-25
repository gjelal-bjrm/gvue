import { create } from 'zustand'
import type { Appearance } from '@shared/types'
import { applyAppearance } from '../theme/applyTheme'
import { applyThemeAll } from '../lib/terminalRegistry'

const FALLBACK: Appearance = {
  accent: '#7F77DD',
  theme: 'dark',
  density: 'comfortable',
  corners: 'rounded',
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontSize: 13,
  windowOpacity: 1,
  presets: {}
}

interface AppearanceState {
  appearance: Appearance
  loaded: boolean
  init: () => Promise<void>
  /** Met à jour une ou plusieurs clés, applique les variables CSS et persiste. */
  update: (patch: Partial<Appearance>) => void
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  appearance: FALLBACK,
  loaded: false,

  init: async () => {
    try {
      const appearance = await window.api.config.get('appearance')
      const merged = { ...FALLBACK, ...appearance }
      applyAppearance(merged)
      set({ appearance: merged, loaded: true })
    } catch {
      applyAppearance(FALLBACK)
      set({ loaded: true })
    }
  },

  update: (patch) => {
    const next = { ...get().appearance, ...patch }
    applyAppearance(next)
    applyThemeAll() // répercute le thème sur les terminaux xterm vivants
    set({ appearance: next })
    // Persistance asynchrone, sans bloquer l'UI.
    void window.api.config.set('appearance', next)
  }
}))
