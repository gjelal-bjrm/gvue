/**
 * Reconnaît un chemin Windows dans du texte sélectionné (pur, testé) — pour
 * proposer « Aller sur ce chemin » au clic droit dans le terminal.
 *
 * Tolère ce qu'on sélectionne vraiment : guillemets, parenthèses, ligne d'une
 * trace d'erreur (`at C:\app\x.ts:12:5`), barres obliques dans les deux sens,
 * `file:///`. Rend le chemin normalisé (barres inversées) ou null.
 */
export function extractWindowsPath(text: string): string | null {
  // Une sélection multi-lignes : seule la première ligne peut être un chemin.
  let s = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  s = s.trim()
  if (!s) return null

  if (/^file:\/\/\//i.test(s)) {
    try {
      s = decodeURIComponent(s.replace(/^file:\/\/\//i, ''))
    } catch {
      return null
    }
  }

  // Le chemin commence rarement au premier caractère : « at C:\app\x.js:3 »,
  // « (voir 'C:\x') ». On repère le début d'un chemin (lecteur ou UNC) et on
  // ignore ce qui précède. La lettre de lecteur ne doit pas être la fin d'un
  // mot : dans « http:// », le « p:/ » ressemble à un lecteur sans en être un.
  const start = /(?<![A-Za-z0-9])[A-Za-z]:[\\/]|\\\\[^\\/\s]+[\\/]/.exec(s)
  if (!start) return null
  s = s.slice(start.index)
  // Enveloppes et ponctuation de fin : "C:\x", 'C:\x'), [C:\x]., C:\x;
  s = s.replace(/[\s"'`>)\]}.,;]+$/, '')
  // Suffixe ligne:colonne des traces d'erreur.
  s = s.replace(/:\d+(?::\d+)?$/, '')
  // Un chemin ne contient ni guillemet ni caractère interdit de Windows.
  if (/["<>|*?]/.test(s)) return null

  const norm = s.replace(/\//g, '\\')
  // « C:\ » reste « C:\ » ; sinon pas de barre finale.
  return norm.length <= 3 ? norm : norm.replace(/\\+$/, '')
}
