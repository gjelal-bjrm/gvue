/**
 * Nettoyage des séquences d'échappement ANSI (sortie de terminal → texte
 * lisible par un humain ou un agent IA). Logique pure, testée.
 */
export function stripAnsi(s: string): string {
  return (
    s
      // OSC : ESC ] … terminé par BEL ou ESC \ (titres de fenêtre, hyperliens…)
      .replace(/\x1b\][^]*?(?:\x07|\x1b\\)/g, '')
      // CSI : ESC [ … caractère final (couleurs, curseur, effacements…)
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
      // Échappements simples : ESC + un caractère (OSC/CSI déjà consommés)
      .replace(/\x1b./g, '')
      // Retours chariot isolés (le \n suit dans les sorties pty Windows)
      .replace(/\r/g, '')
  )
}

/** Dernières `n` lignes d'un texte. */
export function tailLines(text: string, n: number): string {
  const lines = text.split('\n')
  return lines.slice(Math.max(0, lines.length - n)).join('\n')
}
