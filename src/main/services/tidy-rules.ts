import type { TidyRule } from '@shared/types'

/**
 * Logique PURE du rangement automatique des téléchargements (testée par
 * vitest, sans Electron ni système de fichiers) : détection des fichiers en
 * cours de téléchargement, choix de la règle, gabarits de sous-dossier et
 * résolution des collisions de noms.
 */

/** Extensions des téléchargements INACHEVÉS des navigateurs et gestionnaires. */
const TEMP_EXT = new Set(['crdownload', 'part', 'partial', 'download', 'tmp', 'opdownload'])

/** Extension en minuscules, sans point ('' si aucune). */
export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

/** Fichier à IGNORER : téléchargement en cours, temporaire ou caché. */
export function isTempDownload(name: string): boolean {
  if (name.startsWith('.') || name.startsWith('~')) return true
  return TEMP_EXT.has(extOf(name))
}

/** Première règle ACTIVE dont les extensions correspondent (vide = toutes). */
export function pickRule(rules: TidyRule[], name: string): TidyRule | null {
  const ext = extOf(name)
  for (const r of rules) {
    if (!r.enabled || !r.destDir.trim()) continue
    if (r.extensions.length === 0 || r.extensions.includes(ext)) return r
  }
  return null
}

/** « pdf, zip ; RAR » → ['pdf', 'zip', 'rar'] (séparateurs libres, sans point). */
export function parseExtensions(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((s) => s.trim().replace(/^\./, '').toLowerCase())
        .filter(Boolean)
    )
  ]
}

/**
 * Rend le gabarit de sous-dossier : {date} → AAAA-MM, {ext} → extension (ou
 * « autres »). Les caractères interdits de Windows sont neutralisés.
 */
export function renderSubfolder(template: string, name: string, now: Date): string {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return template
    .replaceAll('{date}', date)
    .replaceAll('{ext}', extOf(name) || 'autres')
    .replace(/[<>:"|?*]/g, '-')
    .replace(/^[\\/]+|[\\/]+$/g, '')
    .trim()
}

/** Nom libre dans un dossier : « rapport.pdf » → « rapport (2).pdf »… */
export function freeName(existing: Set<string>, name: string): string {
  const lower = new Set([...existing].map((n) => n.toLowerCase()))
  if (!lower.has(name.toLowerCase())) return name
  const i = name.lastIndexOf('.')
  const stem = i > 0 ? name.slice(0, i) : name
  const ext = i > 0 ? name.slice(i) : ''
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
}
