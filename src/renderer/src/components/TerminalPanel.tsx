import { useEffect, useState } from 'react'
import { Minus, X, Plus, TerminalSquare, ChevronDown, AlertTriangle } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useTerminalStore } from '../state/useTerminalStore'
import Terminal from './Terminal'

/**
 * Panneau terminal : barre d'onglets + instances xterm (node-pty).
 * Tous les onglets restent montés (masqués) pour préserver l'historique ;
 * seul l'onglet actif est visible.
 */
export default function TerminalPanel(): JSX.Element {
  const { toggleTerminal, setTerminalOpen } = useUiStore()
  const { shells, tabs, activeId, error, loadShells, openTab, ensureTab, closeTab, setActive } =
    useTerminalStore()
  const [menuOpen, setMenuOpen] = useState(false)

  // Au montage : charge les shells et garantit un onglet ouvert.
  useEffect(() => {
    void loadShells().then(() => ensureTab())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full flex-col border-t border-border bg-bg-tertiary">
      {/* En-tête + onglets */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border pl-2 pr-2">
        <div className="flex min-w-0 items-center gap-1">
          <TerminalSquare size={14} className="mr-1 shrink-0 text-fg-muted" />
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {tabs.map((t) => (
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

            {/* Nouveau terminal (avec choix du shell) */}
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
                <div className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-app border border-border bg-bg-secondary py-1 shadow-lg">
                  {shells.map((s) => (
                    <button
                      key={s.id}
                      onMouseDown={() => {
                        setMenuOpen(false)
                        void openTab(s.id)
                      }}
                      className="block w-full px-3 py-1.5 text-left text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
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
        {tabs.map((t) => (
          <div
            key={t.id}
            className="absolute inset-0 p-1.5"
            style={{ display: t.id === activeId ? 'block' : 'none' }}
          >
            <Terminal ptyId={t.ptyId} active={t.id === activeId} />
          </div>
        ))}
      </div>
    </div>
  )
}

function HeaderBtn(props: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      title={props.label}
      className="grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
    >
      {props.children}
    </button>
  )
}
