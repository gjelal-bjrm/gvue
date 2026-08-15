import type { TidyAction } from './types'

/**
 * Application des actions de rangement (pur, testé) — en shared car le moteur
 * (main) exécute et le dialogue (renderer) prévisualise avec la MÊME logique.
 */

/** Résultat d'une action appliquée à un fichier rangé. */
export interface TidyActionOutcome {
  /** Nouveau nom complet (extension comprise), null = le nom ne change pas. */
  name: string | null
  /** Action à persister (compteur avancé, nom consommé), null = inchangée. */
  updated: TidyAction | null
  /** La liste de noms est épuisée : le fichier garde son nom, avertir. */
  exhausted: boolean
}

/** « rapport.pdf » → { stem: 'rapport', ext: '.pdf' } (ext vide si aucune). */
export function splitName(name: string): { stem: string; ext: string } {
  const i = name.lastIndexOf('.')
  if (i <= 0) return { stem: name, ext: '' }
  return { stem: name.slice(0, i), ext: name.slice(i) }
}

/** Neutralise les caractères interdits de Windows dans un nom de fichier. */
function sanitize(name: string): string {
  return name.replace(/[\\/<>:"|?*]/g, '-').trim()
}

/**
 * Rend le gabarit de renommage : {n} → compteur, {date} → AAAA-MM-JJ (jour
 * plein — contrairement aux sous-dossiers, un fichier se date précisément),
 * {nom} → nom d'origine sans extension, {ext} → extension sans point.
 */
export function renderNameTemplate(
  template: string,
  originalName: string,
  counter: number,
  now: Date
): string {
  const { stem, ext } = splitName(originalName)
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
  return sanitize(
    template
      .replaceAll('{n}', String(counter))
      .replaceAll('{date}', date)
      .replaceAll('{nom}', stem)
      .replaceAll('{ext}', ext.replace(/^\./, ''))
  )
}

/**
 * Applique une action au fichier « originalName ». Ne touche pas au disque :
 * renvoie le nom voulu et l'état d'action à persister — le moteur s'occupe
 * des collisions (freeName) et de l'écriture.
 */
export function applyTidyAction(action: TidyAction, originalName: string, now: Date): TidyActionOutcome {
  if (action.kind === 'rename') {
    const template = action.template?.trim()
    if (!template) return { name: null, updated: null, exhausted: false }
    const counter = action.counter ?? 1
    const stem = renderNameTemplate(template, originalName, counter, now)
    // Gabarit qui ne produit rien : on garde le nom d'origine.
    if (!stem) return { name: null, updated: null, exhausted: false }
    const { ext } = splitName(originalName)
    // Le compteur n'avance que si le gabarit s'en sert.
    const updated = template.includes('{n}') ? { ...action, counter: counter + 1 } : null
    return { name: stem + ext, updated, exhausted: false }
  }

  if (action.kind === 'nameList') {
    const names = (action.names ?? []).map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) return { name: null, updated: null, exhausted: true }
    const entry = sanitize(names[0])
    const { ext } = splitName(originalName)
    // Un nom SANS extension hérite de celle du fichier ; avec, il est pris tel quel.
    const name = splitName(entry).ext ? entry : entry + ext
    return { name, updated: { ...action, names: names.slice(1) }, exhausted: false }
  }

  // 'script' : exécuté par le moteur APRÈS le déplacement, pas un renommage.
  return { name: null, updated: null, exhausted: false }
}
