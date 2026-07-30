import type { Appearance } from '@shared/types'
import { THEME_VAR_KEYS, resolveThemeId, themeById } from './themes'

/**
 * Applique l'apparence en posant les variables CSS sur :root.
 * Aucun composant n'est touché : tout passe par les variables (cf. section 7).
 * Appelé au démarrage avant le premier rendu utile pour éviter le flash.
 *
 * Thèmes complets : si un id de palette est résolu (choix direct ou
 * planification jour/nuit), ses variables sont posées par-dessus la base
 * clair/sombre ; sinon on retire toute surcharge pour retomber sur la base.
 */
export function applyAppearance(a: Appearance): void {
  const root = document.documentElement
  const id = resolveThemeId(a, new Date())
  const palette = themeById(id)

  // Nettoie les surcharges du thème précédent (retour à variables.css).
  for (const key of THEME_VAR_KEYS) root.style.removeProperty(`--${key}`)

  const base = palette
    ? palette.base
    : id === 'auto' || (id !== 'light' && id !== 'dark')
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : id

  root.setAttribute('data-theme', base)
  if (palette) {
    for (const [key, value] of Object.entries(palette.vars)) {
      root.style.setProperty(`--${key}`, value)
    }
  }

  root.style.setProperty('--accent', a.accent)
  // La teinte douce se noie sur fond blanc : un peu plus dense en clair.
  root.style.setProperty('--accent-soft', hexToSoft(a.accent, base === 'light' ? 0.2 : 0.16))
  root.style.setProperty('--radius', a.corners === 'rounded' ? '8px' : '2px')
  root.style.setProperty('--row-pad', a.density === 'comfortable' ? '8px' : '4px')
  root.style.setProperty('--font-ui', a.fontFamily)
  root.style.setProperty('--font-size', `${a.fontSize}px`)
  // L'opacité de la fenêtre est appliquée au niveau OS (win.setOpacity), pas en CSS.
}

/** Construit la teinte douce de l'accent (opacité selon le thème). */
function hexToSoft(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return `rgba(127, 119, 221, ${alpha})`
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
