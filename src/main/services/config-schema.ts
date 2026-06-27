import type { AppConfig } from '@shared/types'

/**
 * Schéma et assainissement de la configuration — logique pure (aucun import
 * Electron), donc testable. Garantit qu'une config corrompue, partielle ou avec
 * des champs au mauvais type ne puisse jamais provoquer un crash au démarrage :
 * chaque clé manquante/invalide retombe sur sa valeur par défaut, sans écraser
 * les conteneurs valides (presets, espaces de travail, favoris…).
 */

export const DEFAULT_CONFIG: AppConfig = {
  appearance: {
    accent: '#D85A30',
    theme: 'auto',
    density: 'comfortable',
    corners: 'rounded',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
    windowOpacity: 1,
    titleCursor: true,
    presets: {}
  },
  window: {
    width: 1200,
    height: 800,
    maximized: false
  },
  favorites: [],
  shortcuts: [],
  recents: [],
  recentFiles: [],
  folderFreq: {},
  projectRoots: [],
  openWith: {},
  workspaces: {},
  runnerTasks: [],
  runnerProfiles: [],
  projectLaunch: {},
  sidebarOrder: ['thispc', 'drives', 'favorites', 'projects'],
  sidebarCollapsed: {},
  treeExpandToCurrent: true,
  defaultShell: '',
  lastSeenVersion: '',
  hideGitIgnored: true
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Assainit l'objet d'apparence : champs scalaires typés, presets préservés. */
function sanitizeAppearance(raw: unknown): AppConfig['appearance'] {
  const d = DEFAULT_CONFIG.appearance
  const out: AppConfig['appearance'] = { ...d }
  if (!isPlainObject(raw)) return out
  for (const key of Object.keys(d) as (keyof typeof d)[]) {
    if (key === 'presets') {
      // Conteneur arbitraire : on garde tel quel s'il s'agit d'un objet.
      out.presets = isPlainObject(raw.presets) ? (raw.presets as typeof d.presets) : {}
      continue
    }
    const rv = raw[key]
    if (typeof rv === typeof d[key]) {
      // Le type correspond : on adopte la valeur stockée.
      ;(out as unknown as Record<string, unknown>)[key] = rv
    }
  }
  return out
}

/**
 * Normalise une config brute (issue du disque) vers un AppConfig complet et
 * bien typé. Règles par clé :
 *  - tableau attendu → adopté seulement si c'est un tableau ;
 *  - objet attendu → adopté seulement si c'est un objet simple (conteneur) ;
 *  - scalaire attendu → adopté seulement si le `typeof` correspond ;
 *  - sinon, valeur par défaut.
 */
export function sanitizeConfig(raw: unknown): AppConfig {
  const src = isPlainObject(raw) ? raw : {}
  const out: AppConfig = { ...DEFAULT_CONFIG }

  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof AppConfig)[]) {
    if (key === 'appearance') {
      out.appearance = sanitizeAppearance(src.appearance)
      continue
    }
    const dv = DEFAULT_CONFIG[key]
    const rv = src[key]
    if (rv === undefined) continue // garde la valeur par défaut
    if (Array.isArray(dv)) {
      if (Array.isArray(rv)) (out as unknown as Record<string, unknown>)[key] = rv
    } else if (isPlainObject(dv)) {
      if (isPlainObject(rv)) (out as unknown as Record<string, unknown>)[key] = rv
    } else if (typeof rv === typeof dv) {
      ;(out as unknown as Record<string, unknown>)[key] = rv
    }
  }

  return out
}
