import type { Appearance } from '@shared/types'

/**
 * Applique l'apparence en posant les variables CSS sur :root.
 * Aucun composant n'est touché : tout passe par les variables (cf. section 7).
 * Appelé au démarrage avant le premier rendu utile pour éviter le flash.
 */
export function applyAppearance(a: Appearance): void {
  const root = document.documentElement
  const resolvedTheme =
    a.theme === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : a.theme

  root.setAttribute('data-theme', resolvedTheme)
  root.style.setProperty('--accent', a.accent)
  // La teinte douce se noie sur fond blanc : un peu plus dense en clair.
  root.style.setProperty('--accent-soft', hexToSoft(a.accent, resolvedTheme === 'light' ? 0.2 : 0.16))
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
