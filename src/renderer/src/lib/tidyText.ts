/**
 * « pdf, zip ; RAR » → ['pdf', 'zip', 'rar'] — miroir renderer de
 * main/services/tidy-rules.ts (le renderer ne peut pas importer le main).
 */
/**
 * Aperçu concret d'une règle pour l'utilisateur : où irait un fichier
 * d'exemple aujourd'hui. Miroir simplifié de renderSubfolder côté main.
 */
/** Mois courant au format des sous-dossiers {date} (ex. « 2026-08 »). */
export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function previewDestination(destDir: string, subfolder: string, sampleExt: string): string {
  const date = currentMonth()
  const sub = (subfolder || '')
    .replaceAll('{date}', date)
    .replaceAll('{ext}', sampleExt || 'autres')
    .replace(/^[\\/]+|[\\/]+$/g, '')
    .trim()
  const base = destDir.replace(/[\\/]+$/, '')
  return sub ? `${base}\\${sub.replace(/\//g, '\\')}` : base
}

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
