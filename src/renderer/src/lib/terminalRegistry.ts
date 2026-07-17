import '@xterm/xterm/css/xterm.css'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { attachSuggest } from './terminalSuggest'
import { registerTerminalImpl } from './terminalBridge'

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
  search: SearchAddon
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
    // Historique généreux : les serveurs de dev sont verbeux (le défaut de
    // 1000 lignes se remplit trop vite pour remonter aux anciens logs).
    scrollback: 10000,
    theme: buildTheme()
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  // Handler explicite : ouvre l'URL réelle dans le navigateur système. Sans lui,
  // le handler par défaut fait window.open() (vide) → l'OS reçoit « about:blank ».
  term.loadAddon(new WebLinksAddon((_event, uri) => void window.api.window.openExternal(uri)))
  const search = new SearchAddon()
  term.loadAddon(search)
  // Ctrl+F dans le terminal : ouvre la barre de recherche du panneau (xterm
  // avale les touches ; sans ce handler, Ctrl+F partirait au shell).
  term.attachCustomKeyEventHandler((ev) => {
    if (
      ev.type === 'keydown' &&
      ev.ctrlKey && !ev.shiftKey && !ev.altKey &&
      (ev.key === 'f' || ev.key === 'F')
    ) {
      window.dispatchEvent(new CustomEvent('gvue:terminal-search', { detail: { ptyId } }))
      return false
    }
    return true
  })
  term.open(element)

  // Clic droit façon Git Bash / mintty : copie la sélection si présente,
  // sinon colle le presse-papiers (term.paste respecte le bracketed paste).
  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
    if (term.hasSelection()) {
      const sel = term.getSelection()
      if (sel) void navigator.clipboard.writeText(sel)
      term.clearSelection() // confirme visuellement la copie
    } else {
      void navigator.clipboard.readText().then((text) => {
        if (text) term.paste(text)
      })
    }
  }
  element.addEventListener('contextmenu', onContextMenu)

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
    search,
    element,
    dispose: () => {
      detachSuggest?.()
      element.removeEventListener('contextmenu', onContextMenu)
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

/** Options de surlignage des correspondances (toutes + active). */
function searchOptions(incremental: boolean): {
  incremental: boolean
  decorations: {
    matchBackground: string
    matchOverviewRuler: string
    activeMatchBackground: string
    activeMatchColorOverviewRuler: string
  }
} {
  const accent = cssVar('--accent') || '#7f77dd'
  return {
    incremental,
    decorations: {
      matchBackground: 'rgba(255, 200, 0, 0.30)',
      matchOverviewRuler: '#ffc800',
      activeMatchBackground: accent,
      activeMatchColorOverviewRuler: accent
    }
  }
}

/**
 * Recherche dans le tampon d'un terminal (Ctrl+F). `incremental` étend la
 * correspondance courante pendant la frappe au lieu de sauter à la suivante.
 * Renvoie faux si aucune correspondance.
 */
export function searchTerminal(
  ptyId: string,
  query: string,
  dir: 'next' | 'prev',
  incremental = false
): boolean {
  const entry = registry.get(ptyId)
  if (!entry || !query) return false
  return dir === 'next'
    ? entry.search.findNext(query, searchOptions(incremental))
    : entry.search.findPrevious(query, searchOptions(incremental))
}

/** Efface les surlignages de recherche d'un terminal. */
export function clearTerminalSearch(ptyId: string): void {
  registry.get(ptyId)?.search.clearDecorations()
}

/** Rend le focus clavier au terminal (après fermeture de la recherche). */
export function focusTerminal(ptyId: string): void {
  registry.get(ptyId)?.term.focus()
}

// Expose les opérations aux stores via la façade : ils peuvent ainsi rester
// SANS import statique de ce module (chargement paresseux du chunk xterm).
registerTerminalImpl({ applyThemeAll, disposeTerminal })

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
