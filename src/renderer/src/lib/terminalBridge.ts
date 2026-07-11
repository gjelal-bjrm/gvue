/**
 * Façade sans dépendance xterm : permet aux stores chargés au démarrage
 * (apparence, terminal) d'appeler le registre SANS l'importer statiquement —
 * sinon le chunk xterm (~450 ko) serait tiré au boot. Tant que le registre
 * n'est pas chargé (aucun terminal ouvert), les appels sont des no-ops :
 * il n'existe alors aucune instance xterm à thémer ou à détruire.
 */
interface TerminalImpl {
  applyThemeAll(): void
  disposeTerminal(ptyId: string): void
}

let impl: TerminalImpl | null = null

/** Appelé par terminalRegistry à son chargement. */
export function registerTerminalImpl(i: TerminalImpl): void {
  impl = i
}

export function applyThemeAll(): void {
  impl?.applyThemeAll()
}

export function disposeTerminal(ptyId: string): void {
  impl?.disposeTerminal(ptyId)
}
