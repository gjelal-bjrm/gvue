import { describe, it, expect } from 'vitest'
import {
  THEMES,
  resolveThemeId,
  toMinutes,
  themeById,
  withAlpha,
  baseFromBg,
  hueShift,
  buildCustomVars,
  findTheme,
  PALETTE_KEYS
} from '@renderer/theme/themes'
import type { Appearance, CustomTheme } from '@shared/types'

function appearance(patch: Partial<Appearance>): Appearance {
  return {
    accent: '#D85A30',
    theme: 'dark',
    themeId: '',
    customThemes: [],
    themeSchedule: {
      enabled: false,
      dayFrom: '08:00',
      nightFrom: '20:00',
      day: 'light',
      night: 'tokyo'
    },
    density: 'comfortable',
    corners: 'rounded',
    fontFamily: 'x',
    fontSize: 13,
    windowOpacity: 1,
    titleCursor: true,
    presets: {},
    ...patch
  }
}

const at = (h: number, m = 0): Date => new Date(2026, 6, 30, h, m)

describe('THEMES', () => {
  it('ids uniques et variables de base présentes', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of THEMES) {
      expect(t.vars.bg, t.id).toBeTruthy()
      expect(t.vars['bg-secondary'], t.id).toBeTruthy()
      expect(t.vars.fg, t.id).toBeTruthy()
      expect(['dark', 'light']).toContain(t.base)
    }
  })

  it('themeById retrouve une palette et rejette un id inconnu', () => {
    expect(themeById('matrix')?.label).toBe('Matrix')
    expect(themeById('inexistant')).toBeNull()
  })
})

describe('resolveThemeId', () => {
  it("suit themeId quand il est posé, sinon le mode historique", () => {
    expect(resolveThemeId(appearance({ themeId: 'nord' }), at(12))).toBe('nord')
    expect(resolveThemeId(appearance({ themeId: '' }), at(12))).toBe('dark')
    expect(resolveThemeId(appearance({ themeId: '', theme: 'auto' }), at(12))).toBe('auto')
  })

  it('applique la planification quand elle est active', () => {
    const a = appearance({
      themeId: 'oled',
      themeSchedule: {
        enabled: true,
        dayFrom: '08:00',
        nightFrom: '20:00',
        day: 'paper',
        night: 'tokyo'
      }
    })
    expect(resolveThemeId(a, at(12))).toBe('paper') // midi → jour
    expect(resolveThemeId(a, at(22))).toBe('tokyo') // 22 h → nuit
    expect(resolveThemeId(a, at(7, 59))).toBe('tokyo') // avant 8 h → encore la nuit
    expect(resolveThemeId(a, at(8, 0))).toBe('paper') // borne incluse côté jour
  })

  it('gère une fenêtre de jour à cheval sur minuit', () => {
    const a = appearance({
      themeSchedule: {
        enabled: true,
        dayFrom: '22:00',
        nightFrom: '06:00',
        day: 'crt',
        night: 'nord'
      }
    })
    expect(resolveThemeId(a, at(23))).toBe('crt')
    expect(resolveThemeId(a, at(2))).toBe('crt')
    expect(resolveThemeId(a, at(12))).toBe('nord')
  })
})

describe('thèmes personnalisés', () => {
  const colors = {
    bg: '#101418',
    bgSecondary: '#161b21',
    bgTertiary: '#1d232b',
    fg: '#dce6f0',
    fgSecondary: '#a8b4c2',
    fgMuted: '#6e7a88',
    success: '#39c47f',
    danger: '#e05545',
    warning: '#d9a53a',
    info: '#4d9fe8'
  }

  it('withAlpha convertit le #rrggbb et tolère le reste', () => {
    expect(withAlpha('#336699', 0.5)).toBe('rgba(51, 102, 153, 0.5)')
    expect(withAlpha('rgb(1,2,3)', 0.5)).toBe('rgb(1,2,3)')
  })

  it('baseFromBg décide selon la luminance', () => {
    expect(baseFromBg('#101418')).toBe('dark')
    expect(baseFromBg('#faf9f4')).toBe('light')
    expect(baseFromBg('pas-une-couleur')).toBe('dark')
  })

  it('buildCustomVars couvre toute la palette et dérive les fonds de statut', () => {
    const vars = buildCustomVars(colors)
    for (const k of PALETTE_KEYS) expect(vars[k], k).toBeTruthy()
    expect(vars['success-bg']).toBe(withAlpha(colors.success, 0.14))
    expect(vars['bg-hover']).toContain('rgba(220, 230, 240') // dérivé du texte
  })

  it('findTheme cherche dans les statiques puis les personnalisés', () => {
    const custom: CustomTheme[] = [
      { id: 'custom-1', label: 'Perso', base: 'dark', vars: buildCustomVars(colors) }
    ]
    expect(findTheme('nord', custom)?.base).toBe('dark')
    expect(findTheme('custom-1', custom)?.vars.bg).toBe('#101418')
    expect(findTheme('inconnu', custom)).toBeNull()
    expect(findTheme('custom-1', undefined)).toBeNull()
  })
})

describe('hueShift', () => {
  it('fait tourner la teinte (rouge → +120° = vert, +240° = bleu)', () => {
    expect(hueShift('#ff0000', 120)).toBe('#00ff00')
    expect(hueShift('#ff0000', 240)).toBe('#0000ff')
    expect(hueShift('#ff0000', -120)).toBe('#0000ff')
  })

  it('360° revient à la couleur de départ, gris insensible à la teinte', () => {
    expect(hueShift('#d85a30', 360)).toBe('#d85a30')
    expect(hueShift('#808080', 90)).toBe('#808080')
  })

  it("laisse passer ce qui n'est pas un hex", () => {
    expect(hueShift('var(--accent)', 60)).toBe('var(--accent)')
  })
})

describe('toMinutes', () => {
  it('convertit HH:MM et tolère les entrées invalides', () => {
    expect(toMinutes('08:30')).toBe(510)
    expect(toMinutes('0:05')).toBe(5)
    expect(toMinutes('n’importe quoi')).toBe(0)
    expect(toMinutes('')).toBe(0)
  })
})
