import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { attachSuggest } from './terminalSuggest'

/** Métadonnées d'un terminal, pour l'autocomplétion (type de shell + cwd). */
export interface TermMeta {
  shellId: string
  cwd: string
}

/**
 * Registre d'instances xterm, indexé par ptyId.
 *
 * Garder l'instance (et son élément DOM) en dehors du cycle de vie React permet
 * de réduire/rouvrir le panneau terminal sans perdre l'historique : on détache
 * puis réattache le même élément, au lieu de recréer xterm à chaque montage.
 */

export interface TermEntry {
  term: XTerm
  fit: FitAddon
  element: HTMLDivElement
  dispose: () => void
}

const registry = new Map<string, TermEntry>()

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function buildTheme(): Record<string, string> {
  return {
    background: cssVar('--bg-tertiary') || '#25252d',
    foreground: cssVar('--fg') || '#e7e7ef',
    cursor: cssVar('--accent') || '#7f77dd',
    cursorAccent: cssVar('--bg-tertiary') || '#25252d',
    selectionBackground: cssVar('--accent-soft') || 'rgba(127,119,221,.3)'
  }
}

/** Récupère (ou crée) l'instance xterm liée à un ptyId. `meta` sert à la
 * première création (autocomplétion : type de shell + cwd). */
export function acquire(ptyId: string, meta?: TermMeta): TermEntry {
  const existing = registry.get(ptyId)
  if (existing) return existing

  const element = document.createElement('div')
  element.style.width = '100%'
  element.style.height = '100%'

  const term = new XTerm({
    fontFamily: cssVar('--font-mono') || 'monospace',
    fontSize: 13,
    cursorBlink: true,
    allowProposedApi: true,
    theme: buildTheme()
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  // Handler explicite : ouvre l'URL réelle dans le navigateur système. Sans lui,
  // le handler par défaut fait window.open() (vide) → l'OS reçoit « about:blank ».
  term.loadAddon(new WebLinksAddon((_event, uri) => void window.api.window.openExternal(uri)))
  term.open(element)

  // Branchement IPC bidirectionnel (le tampon du preload évite la perte initiale).
  const unsubData = window.api.terminal.onData(ptyId, (data) => term.write(data))
  const inputDisp = term.onData((data) => window.api.terminal.write(ptyId, data))

  // Autocomplétion fantôme (si on connaît le shell + le cwd).
  const detachSuggest = meta
    ? attachSuggest(term, {
        shellId: meta.shellId,
        cwd: meta.cwd,
        write: (d) => window.api.terminal.write(ptyId, d)
      })
    : null

  const entry: TermEntry = {
    term,
    fit,
    element,
    dispose: () => {
      detachSuggest?.()
      unsubData()
      inputDisp.dispose()
      term.dispose()
      element.remove()
      registry.delete(ptyId)
    }
  }
  registry.set(ptyId, entry)
  return entry
}

/** Détruit l'instance xterm d'un ptyId (à la fermeture de l'onglet). */
export function disposeTerminal(ptyId: string): void {
  registry.get(ptyId)?.dispose()
}

/** Efface le contenu affiché du terminal (conserve la ligne courante). */
export function clearTerminal(ptyId: string): void {
  registry.get(ptyId)?.term.clear()
}

/** Renvoie tout le contenu textuel du terminal (scrollback + écran). */
export function getTerminalText(ptyId: string): string {
  const entry = registry.get(ptyId)
  if (!entry) return ''
  const buf = entry.term.buffer.active
  const lines: string[] = []
  for (let i = 0; i < buf.length; i++) {
    const line = buf.getLine(i)
    lines.push(line ? line.translateToString(true) : '')
  }
  // Retire les lignes vides en fin de tampon.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

/** Applique le thème courant à toutes les instances vivantes. */
export function applyThemeAll(): void {
  const theme = buildTheme()
  for (const { term } of registry.values()) {
    term.options.theme = theme
    term.options.fontFamily = cssVar('--font-mono') || 'monospace'
  }
}
