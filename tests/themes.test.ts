import { describe, it, expect } from 'vitest'
import { THEMES, resolveThemeId, toMinutes, themeById } from '@renderer/theme/themes'
import type { Appearance } from '@shared/types'

function appearance(patch: Partial<Appearance>): Appearance {
  return {
    accent: '#D85A30',
    theme: 'dark',
    themeId: '',
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

describe('toMinutes', () => {
  it('convertit HH:MM et tolère les entrées invalides', () => {
    expect(toMinutes('08:30')).toBe(510)
    expect(toMinutes('0:05')).toBe(5)
    expect(toMinutes('n’importe quoi')).toBe(0)
    expect(toMinutes('')).toBe(0)
  })
})
