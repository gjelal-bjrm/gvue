import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import {
  Minus,
  X,
  Plus,
  TerminalSquare,
  ChevronDown,
  AlertTriangle,
  Eraser,
  Copy,
  Check,
  Columns2,
  Square,
  Star,
  Maximize2,
  Minimize2,
  Search,
  ArrowUp,
  ArrowDown,
  Link2
} from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useTerminalStore } from '../state/useTerminalStore'
import { useNavStore } from '../state/useNavStore'
import {
  clearTerminal,
  getTerminalText,
  searchTerminal,
  clearTerminalSearch,
  focusTerminal
} from '../lib/terminalRegistry'
import Terminal from './Terminal'

/**
 * Panneau terminal : barre d'onglets + instances xterm (node-pty).
 * Tous les onglets restent montés (masqués) pour préserver l'historique ;
 * seul l'onglet actif est visible.
 */
export default function TerminalPanel(): JSX.Element {
  const { toggleTerminal, setTerminalOpen } = useUiStore()
  const split = useUiStore((s) => s.terminalSplit)
  const toggleSplit = useUiStore((s) => s.toggleTerminalSplit)
  const maximized = useUiStore((s) => s.terminalMax)
  const toggleMax = useUiStore((s) => s.toggleTerminalMax)
  const { shells, tabs, activeId, error, loadShells, openTab, ensureTab, closeTab, setActive } =
    useTerminalStore()
  const defaultShellId = useTerminalStore((s) => s.defaultShellId)
  const setDefaultShell = useTerminalStore((s) => s.setDefaultShell)
  const linked = useTerminalStore((s) => s.linked)
  const toggleLinked = useTerminalStore((s) => s.toggleLinked)
  const navActiveId = useNavStore((s) => s.activeId)
  const panes = useNavStore((s) => s.panes)

  // Mode « lié » : ne montre que les terminaux de l'onglet de dossier actif
  // (+ ceux dont l'onglet d'origine a été fermé, considérés globaux).
  const paneIdSet = useMemo(() => new Set(panes.map((p) => p.id)), [panes])
  const visibleTabs = useMemo(
    () =>
      linked
        ? tabs.filter((t) => !t.paneId || t.paneId === navActiveId || !paneIdSet.has(t.paneId))
        : tabs,
    [linked, tabs, navActiveId, paneIdSet]
  )
  const activeVisible = visibleTabs.some((t) => t.id === activeId)

  // En changeant d'onglet de dossier, bascule sur un terminal de cet onglet.
  useEffect(() => {
    if (!linked || activeVisible) return
    const fallback = visibleTabs[visibleTabs.length - 1]
    if (fallback) setActive(fallback.id)
  }, [linked, navActiveId, visibleTabs, activeVisible, setActive])
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [noMatch, setNoMatch] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Recherche : frappe = incrémental, Entrée = suivant, Maj+Entrée = précédent.
  const runSearch = (q: string, dir: 'next' | 'prev', incremental = false): void => {
    if (!activeId) return
    setNoMatch(q.length > 0 && !searchTerminal(activeId, q, dir, incremental))
  }

  const closeSearch = (): void => {
    setSearchOpen(false)
    setQuery('')
    setNoMatch(false)
    if (activeId) {
      clearTerminalSearch(activeId)
      focusTerminal(activeId)
    }
  }

  // Ctrl+F depuis un terminal (événement émis par le registre xterm).
  useEffect(() => {
    const open = (): void => {
      setSearchOpen(true)
      setTimeout(() => searchRef.current?.select(), 0)
    }
    window.addEventListener('gvue:terminal-search', open)
    return () => window.removeEventListener('gvue:terminal-search', open)
  }, [])

  const clearActive = (): void => {
    if (activeId) clearTerminal(activeId)
  }

  const copyActive = async (): Promise<void> => {
    if (!activeId) return
    try {
      await navigator.clipboard.writeText(getTerminalText(activeId))
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* presse-papiers indisponible */
    }
  }

  // Au montage : charge les shells et garantit un onglet ouvert.
  useEffect(() => {
    void loadShells().then(() => ensureTab())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full flex-col border-t border-border bg-bg-tertiary">
      {/* En-tête + onglets. Double-clic (hors boutons) : plein espace / restaurer. */}
      <div
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          toggleMax()
        }}
        title="Double-clic : agrandir / restaurer le terminal"
        className="flex h-9 shrink-0 items-center justify-between border-b border-border pl-2 pr-2"
      >
        <div className="flex min-w-0 items-center gap-1">
          <TerminalSquare size={14} className="mr-1 shrink-0 text-fg-muted" />
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`group flex shrink-0 items-center gap-1.5 rounded-app px-2.5 py-1 text-[12px] ${
                  t.id === activeId
                    ? 'bg-bg-secondary text-fg'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary'
                }`}
              >
                <span className={t.exited ? 'opacity-60' : ''}>{t.title}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(t.id)
                  }}
                  className="grid h-4 w-4 place-items-center rounded opacity-0 hover:bg-bg-hover group-hover:opacity-100"
                  title="Fermer l'onglet"
                >
                  <X size={11} />
                </span>
              </button>
            ))}
          </div>

          {/* Nouveau terminal (avec choix du shell) — hors de la zone scrollable
              pour que le menu déroulant flotte au lieu d'être rogné. */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
              title="Nouveau terminal"
              className="flex items-center rounded-app px-1.5 py-1 text-fg-muted hover:bg-bg-hover hover:text-fg"
            >
              <Plus size={15} />
              <ChevronDown size={11} />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-app border border-border bg-bg-secondary py-1 shadow-lg">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-fg-muted">
                  ★ = shell par défaut
                </div>
                {shells.map((s) => (
                  <div key={s.id} className="group flex items-center pr-1 hover:bg-bg-hover">
                    <button
                      onMouseDown={() => {
                        setMenuOpen(false)
                        void openTab(s.id)
                      }}
                      className="min-w-0 flex-1 px-3 py-1.5 text-left text-[12px] text-fg-secondary hover:text-fg"
                    >
                      {s.label}
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDefaultShell(s.id === defaultShellId ? '' : s.id)
                      }}
                      title={
                        s.id === defaultShellId
                          ? 'Shell par défaut (cliquer pour retirer)'
                          : 'Définir comme shell par défaut'
                      }
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:text-accent"
                    >
                      <Star
                        size={12}
                        className={s.id === defaultShellId ? 'fill-accent text-accent' : ''}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {searchOpen ? (
            <div
              className={`flex items-center gap-0.5 rounded-app border bg-bg px-1 ${
                noMatch ? 'border-danger-fg' : 'border-border'
              }`}
            >
              <Search size={12} className="shrink-0 text-fg-muted" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  runSearch(e.target.value, 'next', true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch(query, e.shiftKey ? 'prev' : 'next')
                  else if (e.key === 'Escape') closeSearch()
                }}
                placeholder="Rechercher…"
                spellCheck={false}
                className="w-36 bg-transparent py-0.5 text-[12px] text-fg outline-none placeholder:text-fg-muted"
              />
              <HeaderBtn label="Précédent (Maj+Entrée)" onClick={() => runSearch(query, 'prev')}>
                <ArrowUp size={12} />
              </HeaderBtn>
              <HeaderBtn label="Suivant (Entrée)" onClick={() => runSearch(query, 'next')}>
                <ArrowDown size={12} />
              </HeaderBtn>
              <HeaderBtn label="Fermer la recherche (Échap)" onClick={closeSearch}>
                <X size={12} />
              </HeaderBtn>
            </div>
          ) : (
            <HeaderBtn
              label="Rechercher dans le terminal (Ctrl+F)"
              onClick={() => {
                setSearchOpen(true)
                setTimeout(() => searchRef.current?.focus(), 0)
              }}
              disabled={!activeId}
            >
              <Search size={14} />
            </HeaderBtn>
          )}
          <HeaderBtn
            label="Copier le contenu du terminal"
            onClick={() => void copyActive()}
            disabled={!activeId}
          >
            {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
          </HeaderBtn>
          <HeaderBtn label="Effacer le terminal" onClick={clearActive} disabled={!activeId}>
            <Eraser size={14} />
          </HeaderBtn>
          <HeaderBtn
            label={split ? 'Affichage en onglets' : 'Afficher côte à côte'}
            onClick={toggleSplit}
            disabled={tabs.length === 0}
            active={split}
          >
            {split ? <Square size={14} /> : <Columns2 size={14} />}
          </HeaderBtn>
          <HeaderBtn
            label={
              linked
                ? "Terminaux liés à l'onglet de dossier (cliquer pour tout afficher)"
                : "Lier les terminaux à l'onglet de dossier actif"
            }
            onClick={toggleLinked}
            active={linked}
          >
            <Link2 size={14} />
          </HeaderBtn>
          <div className="mx-0.5 my-1 w-px bg-border" />
          <HeaderBtn
            label={maximized ? 'Restaurer la taille du terminal' : 'Agrandir (plein espace)'}
            onClick={toggleMax}
            active={maximized}
          >
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </HeaderBtn>
          <HeaderBtn label="Réduire le terminal" onClick={toggleTerminal}>
            <Minus size={14} />
          </HeaderBtn>
          <HeaderBtn label="Fermer le terminal" onClick={() => setTerminalOpen(false)}>
            <X size={14} />
          </HeaderBtn>
        </div>
      </div>

      {/* Corps : instances xterm (toutes montées, inactives masquées) */}
      <div className="relative min-h-0 flex-1">
        {error && tabs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle size={28} className="text-warning-fg" />
            <p className="max-w-md text-[13px] text-fg-secondary">{error}</p>
            <button
              onClick={() => void openTab()}
              className="rounded-app border border-border px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
            >
              Réessayer
            </button>
          </div>
        )}
        {linked && visibleTabs.length === 0 && tabs.length > 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Link2 size={22} className="text-fg-muted" />
            <p className="text-[13px] text-fg-secondary">
              Aucun terminal pour cet onglet de dossier.
            </p>
            <p className="text-[12px] text-fg-muted">
              « + » pour en ouvrir un ici, ou {`« `}
              <Link2 size={11} className="inline" />
              {` »`} pour afficher tous les terminaux.
            </p>
          </div>
        )}
        {split ? (
          // Côte à côte : chaque terminal (visible) dans sa colonne redimensionnable.
          <PanelGroup key={`tsplit-${visibleTabs.length}-${linked}`} direction="horizontal" className="p-1.5">
            {visibleTabs.map((t, i) => (
              <Fragment key={t.id}>
                {i > 0 && (
                  <PanelResizeHandle className="group relative w-1.5 shrink-0">
                    <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-accent group-data-[resize-handle-active]:bg-accent" />
                  </PanelResizeHandle>
                )}
                <Panel minSize={12}>
                  <div
                    onMouseDown={() => setActive(t.id)}
                    className={`flex h-full flex-col overflow-hidden rounded-app border ${
                      t.id === activeId ? 'border-accent' : 'border-border'
                    }`}
                  >
                    <div className="flex shrink-0 items-center justify-between gap-1 border-b border-border bg-bg-secondary px-2 py-0.5">
                      <span
                        className={`truncate text-[11px] ${
                          t.exited ? 'text-fg-muted opacity-60' : t.id === activeId ? 'text-fg' : 'text-fg-muted'
                        }`}
                      >
                        {t.title}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(t.id)
                        }}
                        title="Fermer"
                        className="grid h-4 w-4 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
                      >
                        <X size={11} />
                      </button>
                    </div>
                    <div className="relative min-h-0 flex-1">
                      <Terminal ptyId={t.ptyId} active={t.id === activeId} shellId={t.shell.id} cwd={t.cwd} />
                    </div>
                  </div>
                </Panel>
              </Fragment>
            ))}
          </PanelGroup>
        ) : (
          // Tous les onglets restent montés (historique préservé) ; seul l'actif
          // — et visible dans le filtre « lié » — est affiché.
          tabs.map((t) => (
            <div
              key={t.id}
              className="absolute inset-0 p-1.5"
              style={{ display: t.id === activeId && activeVisible ? 'block' : 'none' }}
            >
              <Terminal ptyId={t.ptyId} active={t.id === activeId} shellId={t.shell.id} cwd={t.cwd} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function HeaderBtn(props: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.label}
      className={`grid h-6 w-6 place-items-center rounded hover:bg-bg-hover hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent ${
        props.active ? 'text-accent' : 'text-fg-muted'
      }`}
    >
      {props.children}
    </button>
  )
}
