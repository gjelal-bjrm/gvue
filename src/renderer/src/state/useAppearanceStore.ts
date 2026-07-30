import { create } from 'zustand'
import type { Appearance } from '@shared/types'
import { applyAppearance } from '../theme/applyTheme'
import { applyThemeAll } from '../lib/terminalBridge'

const FALLBACK: Appearance = {
  accent: '#D85A30',
  theme: 'dark',
  themeId: '',
  customThemes: [],
  themeSchedule: {
    enabled: false,
    dayFrom: '08:00',
    nightFrom: '20:00',
    day: 'light',
    night: 'dark'
  },
  density: 'comfortable',
  corners: 'rounded',
  radiusPx: 8,
  borderStyle: 'solid',
  frameStyle: 'none',
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontSize: 13,
  windowOpacity: 1,
  titleCursor: true,
  presets: {}
}

interface AppearanceState {
  appearance: Appearance
  loaded: boolean
  init: () => Promise<void>
  /** Met à jour une ou plusieurs clés, applique les variables CSS et persiste. */
  update: (patch: Partial<Appearance>) => void
  /** Ajoute ou remplace (même id) un thème personnalisé, et l'applique. */
  saveCustomTheme: (t: import('@shared/types').CustomTheme) => void
  /** Supprime un thème personnalisé (retombe sur le mode de base si actif). */
  deleteCustomTheme: (id: string) => void
  /** Enregistre l'apparence courante comme preset nommé. */
  savePreset: (name: string) => void
  /** Applique un preset enregistré. */
  applyPreset: (name: string) => void
  /** Supprime un preset enregistré. */
  deletePreset: (name: string) => void
}

/** Réglages visuels seuls (sans la table des presets), pour preset/export. */
export function visualOnly(a: Appearance): Partial<Appearance> {
  return {
    accent: a.accent,
    theme: a.theme,
    themeId: a.themeId,
    density: a.density,
    corners: a.corners,
    radiusPx: a.radiusPx,
    borderStyle: a.borderStyle,
    frameStyle: a.frameStyle,
    fontFamily: a.fontFamily,
    fontSize: a.fontSize,
    windowOpacity: a.windowOpacity
  }
}

// Planification jour/nuit : réévalue le thème chaque minute (bascule à
// l'heure configurée sans redémarrer). No-op si la planification est inactive.
let scheduleTimer: number | null = null
function armScheduleTimer(): void {
  if (scheduleTimer !== null) return
  scheduleTimer = window.setInterval(() => {
    const { appearance, loaded } = useAppearanceStore.getState()
    if (!loaded || !appearance.themeSchedule.enabled) return
    applyAppearance(appearance)
    applyThemeAll()
  }, 60_000)
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
    armScheduleTimer()
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

  saveCustomTheme: (t) => {
    const list = get().appearance.customThemes.filter((x) => x.id !== t.id)
    get().update({ customThemes: [...list, t], themeId: t.id })
  },

  deleteCustomTheme: (id) => {
    const a = get().appearance
    get().update({
      customThemes: a.customThemes.filter((x) => x.id !== id),
      ...(a.themeId === id ? { themeId: '' } : {})
    })
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
