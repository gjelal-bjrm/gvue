/**
 * Outils texte du serveur MCP, sans dépendance à Electron (testables) :
 * nettoyage des sorties de terminal et traduction de touches nommées.
 */

/** Nettoie une sortie : espaces de fin, rafales de lignes vides, retours arrière. */
export function tidy(text: string): string {
  return text
    .replace(/[^\n]\x08/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
}

const NAMED_KEYS: Record<string, string> = {
  enter: '\r',
  return: '\r',
  esc: '\x1b',
  escape: '\x1b',
  tab: '\t',
  backspace: '\x7f',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  home: '\x1b[H',
  end: '\x1b[F',
  space: ' '
}

/** « ctrl+c », « up up enter », « ctrl+d »… → séquence à écrire dans le pty. */
export function keySequence(keys: string): string {
  const parts = keys
    .split(/[\s,]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
  if (!parts.length) throw new Error('Paramètre « keys » requis (ex. « ctrl+c », « up enter »).')
  return parts
    .map((k) => {
      const ctrl = /^(?:ctrl|control|c)[+-]([a-z\[\\\]])$/.exec(k)
      if (ctrl) return String.fromCharCode(ctrl[1].toUpperCase().charCodeAt(0) - 64)
      if (k in NAMED_KEYS) return NAMED_KEYS[k]
      throw new Error(`Touche inconnue : ${k}. Exemples : ctrl+c, ctrl+d, enter, esc, tab, up, down.`)
    })
    .join('')
}

