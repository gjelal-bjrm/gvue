import { app } from 'electron'
import { getConfig } from './services/config-store'
import { EN } from './i18n-en'

/**
 * i18n du processus principal (tray, dialogues, notifications) — même
 * principe que côté renderer : la chaîne française est la clé, l'anglais
 * vient du dictionnaire, une clé absente retombe sur le français.
 * La langue est relue à CHAQUE appel : le menu du tray, reconstruit à la
 * volée, suit ainsi un changement de langue sans redémarrage.
 */

export function mainLang(): 'fr' | 'en' {
  let setting: string = 'auto'
  try {
    setting = getConfig('language') ?? 'auto'
  } catch {
    /* config indisponible (très tôt au démarrage) → auto */
  }
  if (setting === 'fr' || setting === 'en') return setting
  try {
    return app.getLocale().toLowerCase().startsWith('fr') ? 'fr' : 'en'
  } catch {
    return 'fr'
  }
}

/** Traduit une chaîne française, avec interpolation `{nom}` optionnelle. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = mainLang() === 'en' ? (EN[fr] ?? fr) : fr
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  }
  return s
}
