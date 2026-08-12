/**
 * « pdf, zip ; RAR » → ['pdf', 'zip', 'rar'] — miroir renderer de
 * main/services/tidy-rules.ts (le renderer ne peut pas importer le main).
 */
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
