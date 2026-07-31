import { EN } from './en'

/**
 * Internationalisation minimaliste, style gettext : la chaîne FRANÇAISE est la
 * clé. `t('Annuler')` renvoie « Annuler » en français et la traduction du
 * dictionnaire anglais sinon — une clé absente retombe sur le français, donc
 * rien ne casse jamais, au pire une chaîne reste à traduire.
 *
 * Interpolation par gabarits nommés : t('Charger « {name} »', { name }).
 * La langue est figée AVANT le premier rendu (initLang dans main.tsx) ; en
 * changer recharge la fenêtre — aucun composant n'a besoin de s'abonner.
 */

export type LangSetting = 'auto' | 'fr' | 'en'
export type Lang = 'fr' | 'en'

let current: Lang = 'fr'

/** Résout « auto » d'après la langue du système. Pur vis-à-vis du DOM absent (tests). */
export function resolveLang(setting: LangSetting | undefined): Lang {
  if (setting === 'fr' || setting === 'en') return setting
  const sys = typeof navigator !== 'undefined' ? navigator.language || 'fr' : 'fr'
  return sys.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function initLang(setting: LangSetting | undefined): void {
  current = resolveLang(setting)
}

export function currentLang(): Lang {
  return current
}

/** Traduit une chaîne française, avec interpolation `{nom}` optionnelle. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = current === 'en' ? (EN[fr] ?? fr) : fr
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  }
  return s
}

/**
 * Variante plurielle : choisit la forme selon les règles de la langue CIBLE
 * (français : pluriel à partir de 2 ; anglais : tout sauf 1), puis traduit.
 * Les deux formes françaises servent de clés ; `{n}` est interpolé d'office.
 */
export function tn(
  n: number,
  singulierFr: string,
  plurielFr: string,
  vars?: Record<string, string | number>
): string {
  const singulier = current === 'en' ? n === 1 : n <= 1
  return t(singulier ? singulierFr : plurielFr, { n, ...vars })
}
