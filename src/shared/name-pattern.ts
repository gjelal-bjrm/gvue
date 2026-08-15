/**
 * Compilation du filtre de nom des règles de rangement — en shared car le
 * main (moteur) et le renderer (avertissement « motif invalide ») doivent
 * juger un motif EXACTEMENT de la même façon.
 *
 * Trois lectures, de la plus simple à la plus experte :
 * - « facture » (aucun joker) → le nom CONTIENT facture ;
 * - « mn_* » (jokers * / ?) → le nom ENTIER correspond au motif ;
 * - regex brute si l'utilisateur a coché « expression régulière ».
 * Toujours insensible à la casse. null = motif invalide (regex mal formée).
 */
export function compileNamePattern(pattern: string, isRegex: boolean): RegExp | null {
  const p = pattern.trim()
  if (!p) return null
  try {
    if (isRegex) return new RegExp(p, 'i')
    const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    if (/[*?]/.test(p)) {
      return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i')
    }
    return new RegExp(escaped, 'i')
  } catch {
    return null
  }
}
