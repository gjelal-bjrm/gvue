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
  /** Enregistre l'apparence courante comme preset nommé. */
  savePreset: (name: string) => void
  /** Applique un preset enregistré. */
  applyPreset: (name: string) => void
  /** Supprime un preset enregistré. */
  deletePreset: (name: string) => void
}

/** Réglages visuels seuls (sans la table des presets), pour sauver un preset. */
function visualOnly(a: Appearance): Partial<Appearance> {
  return {
    accent: a.accent,
    theme: a.theme,
    density: a.density,
    corners: a.corners,
    fontFamily: a.fontFamily,
    fontSize: a.fontSize,
    windowOpacity: a.windowOpacity
  }
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  appearance: FALLBACK,
  loaded: false,

  init: async () => {
    try {
      const appearance = await window.api.config.get('appearance')
      const merged = { ...FALLBACK, ...appearance }
      applyAppearance(merged)
      void window.api.window.setOpacity(merged.windowOpacity)
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
    if (patch.windowOpacity !== undefined) void window.api.window.setOpacity(next.windowOpacity)
    set({ appearance: next })
    // Persistance asynchrone, sans bloquer l'UI.
    void window.api.config.set('appearance', next)
  },

  savePreset: (name) => {
    const key = name.trim()
    if (!key) return
    const presets = { ...get().appearance.presets, [key]: visualOnly(get().appearance) }
    get().update({ presets })
  },

  applyPreset: (name) => {
    const preset = get().appearance.presets[name]
    if (preset) get().update(preset)
  },

  deletePreset: (name) => {
    const presets = { ...get().appearance.presets }
    delete presets[name]
    get().update({ presets })
  }
}))
