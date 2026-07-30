import type { Appearance, CustomTheme } from '@shared/types'

/**
 * Thèmes complets : chaque palette redéfinit l'ensemble des variables CSS
 * (fonds, textes, bordures, statuts) et, pour les plus typés, la palette ANSI
 * du terminal (variables --term-*, lues par terminalRegistry.buildTheme).
 * Aucun composant n'est touché : tout passe par les variables (section 7).
 */

export interface ThemeDef {
  id: string
  label: string
  tagline: string
  /** Base de résolution (color-scheme, contrôles natifs). */
  base: 'dark' | 'light'
  /**
   * Accent suggéré, appliqué à la sélection du thème (l'utilisateur peut
   * ensuite le changer). Absent = on garde l'accent courant.
   */
  accent?: string
  /** Variables CSS surchargées (clés sans « -- »). */
  vars: Record<string, string>
}

export const THEMES: ThemeDef[] = [
  {
    id: 'cyber',
    label: 'Cyber néon',
    tagline: 'Nuit bleutée, cyan et magenta électriques',
    base: 'dark',
    accent: '#00e5d0',
    vars: {
      bg: '#0a0e17',
      'bg-secondary': '#0d1220',
      'bg-tertiary': '#131a2c',
      'bg-hover': 'rgba(0, 229, 208, 0.07)',
      border: 'rgba(120, 160, 255, 0.14)',
      'border-strong': 'rgba(120, 160, 255, 0.26)',
      fg: '#d8e4ff',
      'fg-secondary': '#9fb1d8',
      'fg-muted': '#64749b',
      'warning-fg': '#ffb020',
      'warning-bg': 'rgba(255, 176, 32, 0.14)',
      'info-fg': '#45a7ff',
      'info-bg': 'rgba(69, 167, 255, 0.14)',
      'success-fg': '#00e08a',
      'success-bg': 'rgba(0, 224, 138, 0.14)',
      'danger-fg': '#ff2d78',
      'danger-bg': 'rgba(255, 45, 120, 0.14)',
      'term-cyan': '#00e5d0',
      'term-magenta': '#ff2d78',
      'term-blue': '#45a7ff'
    }
  },
  {
    id: 'matrix',
    label: 'Matrix',
    tagline: 'Noir profond, vert phosphore de terminal',
    base: 'dark',
    accent: '#33ff66',
    vars: {
      bg: '#050a06',
      'bg-secondary': '#081009',
      'bg-tertiary': '#0d180f',
      'bg-hover': 'rgba(51, 255, 102, 0.06)',
      border: 'rgba(51, 255, 102, 0.16)',
      'border-strong': 'rgba(51, 255, 102, 0.3)',
      fg: '#b8e6c0',
      'fg-secondary': '#7fce93',
      'fg-muted': '#497c57',
      'warning-fg': '#d8e64a',
      'warning-bg': 'rgba(216, 230, 74, 0.13)',
      'info-fg': '#4ad2e6',
      'info-bg': 'rgba(74, 210, 230, 0.13)',
      'success-fg': '#33ff66',
      'success-bg': 'rgba(51, 255, 102, 0.13)',
      'danger-fg': '#ff5544',
      'danger-bg': 'rgba(255, 85, 68, 0.13)',
      'term-green': '#33ff66',
      'term-bright-green': '#7dff9f',
      'term-white': '#b8e6c0',
      'term-bright-white': '#e2ffe9',
      'term-black': '#0d180f',
      'term-yellow': '#d8e64a',
      'term-cyan': '#4ad2e6'
    }
  },
  {
    id: 'synthwave',
    label: 'Synthwave',
    tagline: 'Violet rétrowave, rose et cyan coucher de soleil',
    base: 'dark',
    accent: '#ff3fa4',
    vars: {
      bg: '#241b3e',
      'bg-secondary': '#2a2049',
      'bg-tertiary': '#332758',
      'bg-hover': 'rgba(255, 63, 164, 0.09)',
      border: 'rgba(244, 233, 255, 0.13)',
      'border-strong': 'rgba(244, 233, 255, 0.24)',
      fg: '#f4e9ff',
      'fg-secondary': '#c9b8e8',
      'fg-muted': '#8d7cb3',
      'warning-fg': '#ffb347',
      'warning-bg': 'rgba(255, 179, 71, 0.15)',
      'info-fg': '#00d9ff',
      'info-bg': 'rgba(0, 217, 255, 0.14)',
      'success-fg': '#3ae8b0',
      'success-bg': 'rgba(58, 232, 176, 0.14)',
      'danger-fg': '#ff5470',
      'danger-bg': 'rgba(255, 84, 112, 0.15)',
      'term-magenta': '#ff3fa4',
      'term-cyan': '#00d9ff',
      'term-yellow': '#ffb347'
    }
  },
  {
    id: 'tokyo',
    label: 'Tokyo night',
    tagline: 'Bleu nuit urbain, le classique des IDE',
    base: 'dark',
    accent: '#7aa2f7',
    vars: {
      bg: '#1a1b26',
      'bg-secondary': '#1f2335',
      'bg-tertiary': '#24283b',
      'bg-hover': 'rgba(122, 162, 247, 0.09)',
      border: 'rgba(192, 202, 245, 0.11)',
      'border-strong': 'rgba(192, 202, 245, 0.22)',
      fg: '#c0caf5',
      'fg-secondary': '#9aa5ce',
      'fg-muted': '#565f89',
      'warning-fg': '#e0af68',
      'warning-bg': 'rgba(224, 175, 104, 0.14)',
      'info-fg': '#7dcfff',
      'info-bg': 'rgba(125, 207, 255, 0.13)',
      'success-fg': '#9ece6a',
      'success-bg': 'rgba(158, 206, 106, 0.14)',
      'danger-fg': '#f7768e',
      'danger-bg': 'rgba(247, 118, 142, 0.14)',
      'term-blue': '#7aa2f7',
      'term-cyan': '#7dcfff',
      'term-green': '#9ece6a',
      'term-red': '#f7768e',
      'term-yellow': '#e0af68',
      'term-magenta': '#bb9af7'
    }
  },
  {
    id: 'nord',
    label: 'Nord',
    tagline: 'Palette polaire scandinave, froide et apaisée',
    base: 'dark',
    accent: '#88c0d0',
    vars: {
      bg: '#2e3440',
      'bg-secondary': '#343b49',
      'bg-tertiary': '#3b4252',
      'bg-hover': 'rgba(236, 239, 244, 0.06)',
      border: 'rgba(236, 239, 244, 0.11)',
      'border-strong': 'rgba(236, 239, 244, 0.2)',
      fg: '#eceff4',
      'fg-secondary': '#d8dee9',
      'fg-muted': '#7b88a1',
      'warning-fg': '#ebcb8b',
      'warning-bg': 'rgba(235, 203, 139, 0.14)',
      'info-fg': '#81a1c1',
      'info-bg': 'rgba(129, 161, 193, 0.15)',
      'success-fg': '#a3be8c',
      'success-bg': 'rgba(163, 190, 140, 0.15)',
      'danger-fg': '#bf616a',
      'danger-bg': 'rgba(191, 97, 106, 0.16)',
      'term-blue': '#81a1c1',
      'term-cyan': '#88c0d0',
      'term-green': '#a3be8c',
      'term-red': '#bf616a',
      'term-yellow': '#ebcb8b',
      'term-magenta': '#b48ead'
    }
  },
  {
    id: 'oled',
    label: 'OLED minuit',
    tagline: 'Noir absolu — garde votre couleur d’accent',
    base: 'dark',
    vars: {
      bg: '#000000',
      'bg-secondary': '#0a0a0c',
      'bg-tertiary': '#131316',
      'bg-hover': 'rgba(255, 255, 255, 0.07)',
      border: 'rgba(255, 255, 255, 0.1)',
      'border-strong': 'rgba(255, 255, 255, 0.19)',
      fg: '#e7e7ef',
      'fg-secondary': '#b0b0bd',
      'fg-muted': '#74747f'
    }
  },
  {
    id: 'crt',
    label: 'Ambre CRT',
    tagline: 'Phosphore orange des terminaux des années 80',
    base: 'dark',
    accent: '#ffb000',
    vars: {
      bg: '#100b02',
      'bg-secondary': '#171006',
      'bg-tertiary': '#201709',
      'bg-hover': 'rgba(255, 176, 0, 0.07)',
      border: 'rgba(255, 176, 0, 0.17)',
      'border-strong': 'rgba(255, 176, 0, 0.32)',
      fg: '#ffd580',
      'fg-secondary': '#d9a852',
      'fg-muted': '#8a6a33',
      'warning-fg': '#ff8c00',
      'warning-bg': 'rgba(255, 140, 0, 0.14)',
      'info-fg': '#ffcf60',
      'info-bg': 'rgba(255, 207, 96, 0.13)',
      'success-fg': '#c8e05a',
      'success-bg': 'rgba(200, 224, 90, 0.13)',
      'danger-fg': '#ff5a3c',
      'danger-bg': 'rgba(255, 90, 60, 0.15)',
      'term-yellow': '#ffb000',
      'term-bright-yellow': '#ffd580',
      'term-white': '#ffd580',
      'term-bright-white': '#ffe9bd',
      'term-green': '#c8e05a',
      'term-red': '#ff5a3c'
    }
  },
  {
    id: 'paper',
    label: 'Papier',
    tagline: 'Clair façon e-ink, encre et sépia, reposant',
    base: 'light',
    accent: '#8a6d3b',
    vars: {
      bg: '#faf9f4',
      'bg-secondary': '#f0eee6',
      'bg-tertiary': '#e7e4d8',
      'bg-hover': 'rgba(43, 43, 40, 0.06)',
      border: 'rgba(43, 43, 40, 0.15)',
      'border-strong': 'rgba(43, 43, 40, 0.26)',
      fg: '#2b2b28',
      'fg-secondary': '#55534a',
      'fg-muted': '#807c6e',
      'warning-fg': '#a5761b',
      'warning-bg': 'rgba(165, 118, 27, 0.13)',
      'info-fg': '#3d6b9e',
      'info-bg': 'rgba(61, 107, 158, 0.11)',
      'success-fg': '#4a7c46',
      'success-bg': 'rgba(74, 124, 70, 0.12)',
      'danger-fg': '#b5432e',
      'danger-bg': 'rgba(181, 67, 46, 0.12)'
    }
  }
]

/** Clés de palette éditables/posables par un thème (statiques + personnalisés). */
export const PALETTE_KEYS = [
  'bg',
  'bg-secondary',
  'bg-tertiary',
  'bg-hover',
  'border',
  'border-strong',
  'fg',
  'fg-secondary',
  'fg-muted',
  'warning-fg',
  'warning-bg',
  'info-fg',
  'info-bg',
  'success-fg',
  'success-bg',
  'danger-fg',
  'danger-bg'
] as const

/** Toutes les clés de variables potentiellement posées par un thème (nettoyage). */
export const THEME_VAR_KEYS: string[] = [
  ...new Set([...THEMES.flatMap((t) => Object.keys(t.vars)), ...PALETTE_KEYS])
]

export function themeById(id: string): ThemeDef | null {
  return THEMES.find((t) => t.id === id) ?? null
}

/* --------------------- Thèmes personnalisés (éditeur) --------------------- */

/** Les 10 couleurs éditées par l'utilisateur ; le reste est dérivé. */
export interface CustomColors {
  bg: string
  bgSecondary: string
  bgTertiary: string
  fg: string
  fgSecondary: string
  fgMuted: string
  success: string
  danger: string
  warning: string
  info: string
}

/** « #rrggbb » → rgba(r, g, b, alpha) ; renvoie tel quel si non hexadécimal. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Base clair/sombre déduite de la luminance du fond (seuil 0,5). */
export function baseFromBg(bg: string): 'dark' | 'light' {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bg.trim())
  if (!m) return 'dark'
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? 'light' : 'dark'
}

/**
 * Palette complète à partir des 10 couleurs de l'éditeur : survol et bordures
 * dérivés du texte (teinte cohérente sur les deux bases), fonds de statut
 * dérivés de leur couleur de texte.
 */
export function buildCustomVars(c: CustomColors): Record<string, string> {
  const light = baseFromBg(c.bg) === 'light'
  return {
    bg: c.bg,
    'bg-secondary': c.bgSecondary,
    'bg-tertiary': c.bgTertiary,
    'bg-hover': withAlpha(c.fg, light ? 0.06 : 0.07),
    border: withAlpha(c.fg, light ? 0.14 : 0.12),
    'border-strong': withAlpha(c.fg, light ? 0.26 : 0.22),
    fg: c.fg,
    'fg-secondary': c.fgSecondary,
    'fg-muted': c.fgMuted,
    'warning-fg': c.warning,
    'warning-bg': withAlpha(c.warning, 0.14),
    'info-fg': c.info,
    'info-bg': withAlpha(c.info, 0.14),
    'success-fg': c.success,
    'success-bg': withAlpha(c.success, 0.14),
    'danger-fg': c.danger,
    'danger-bg': withAlpha(c.danger, 0.14)
  }
}

/** Cherche un thème par id parmi les statiques PUIS les personnalisés. */
export function findTheme(
  id: string,
  custom: CustomTheme[] | undefined
): Pick<ThemeDef, 'base' | 'vars'> | null {
  return themeById(id) ?? custom?.find((t) => t.id === id) ?? null
}

/**
 * Résout l'identifiant de thème effectif : planification jour/nuit si activée,
 * sinon `themeId` (palette), sinon le mode historique `theme` (auto/clair/sombre).
 * Renvoie 'auto' | 'light' | 'dark' | id de palette. Pur (testable).
 */
export function resolveThemeId(a: Appearance, now: Date): string {
  const s = a.themeSchedule
  if (s?.enabled) {
    const cur = now.getHours() * 60 + now.getMinutes()
    const day = toMinutes(s.dayFrom)
    const night = toMinutes(s.nightFrom)
    // Fenêtre de jour normale (08:00 → 20:00) ou à cheval sur minuit.
    const isDay = day <= night ? cur >= day && cur < night : cur >= day || cur < night
    return isDay ? s.day : s.night
  }
  return a.themeId || a.theme
}

/** « HH:MM » → minutes depuis minuit (0 si invalide). */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  if (!m) return 0
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]))
}
