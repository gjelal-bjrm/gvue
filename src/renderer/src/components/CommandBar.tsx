import { useEffect, useState } from 'react'
import { ChevronDown, TerminalSquare, Check } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useTerminalStore } from '../state/useTerminalStore'

/**
 * Barre de commande : sélecteur de shell (détecté dynamiquement) + saisie qui
 * lance la commande dans le terminal actif (en l'ouvrant si nécessaire).
 */
export default function CommandBar(): JSX.Element {
  const { terminalOpen, toggleTerminal, openTerminalLarge } = useUiStore()
  const { shells, loadShells } = useTerminalStore()
  const defaultShellId = useTerminalStore((s) => s.defaultShellId)
  const setDefaultShell = useTerminalStore((s) => s.setDefaultShell)
  const [menuOpen, setMenuOpen] = useState(false)
  const [command, setCommand] = useState('')

  useEffect(() => {
    void loadShells()
  }, [loadShells])

  // Le shell « sélectionné » EST le shell par défaut (mémorisé). À défaut, le
  // premier détecté (cmd, cf. ordre de détection).
  const shellId = defaultShellId || shells[0]?.id || ''
  const currentLabel = shells.find((s) => s.id === shellId)?.label ?? 'Shell'

  // Sélectionner un shell le mémorise comme défaut (persisté).
  const selectShell = (id: string): void => {
    setDefaultShell(id)
    setMenuOpen(false)
  }

  const runCommand = async (): Promise<void> => {
    if (!command.trim()) return
    openTerminalLarge()
    const term = useTerminalStore.getState()
    // Cible le shell sélectionné : réutilise un onglet de ce shell s'il existe,
    // sinon en ouvre un. (Sans ça, la commande partait dans l'onglet actif,
    // souvent PowerShell, même après avoir choisi Git Bash.)
    const existing = term.tabs.find((t) => t.shell.id === shellId && !t.exited)
    if (existing) term.setActive(existing.id)
    else await term.openTab(shellId)
    useTerminalStore.getState().writeActive(command + '\r')
    setCommand('')
  }

  return (
    <div className="relative flex h-11 shrink-0 items-center gap-2 border-b border-border bg-bg-tertiary px-3">
      {/* Sélecteur de shell */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
          className="flex items-center gap-1.5 rounded-app border border-accent px-2.5 py-1 text-[12px] text-accent"
        >
          {currentLabel}
          <ChevronDown size={13} />
        </button>
        {menuOpen && shells.length > 0 && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-app border border-border bg-bg-secondary py-1 shadow-lg">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-fg-muted">
              Shell par défaut (mémorisé)
            </div>
            {shells.map((s) => (
              <button
                key={s.id}
                onMouseDown={() => selectShell(s.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-bg-hover ${
                  s.id === shellId ? 'text-accent' : 'text-fg-secondary'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {s.id === shellId && <Check size={13} className="shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Saisie de commande */}
      <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-app border border-border bg-bg px-2.5">
        <span className="font-mono text-[13px] text-accent">›</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runCommand()
          }}
          placeholder="Tapez une commande puis Entrée…"
          spellCheck={false}
          className="w-full bg-transparent font-mono text-[12px] text-fg outline-none placeholder:text-fg-muted"
        />
      </div>

      {/* Bascule terminal */}
      <button
        onClick={toggleTerminal}
        title="Basculer le terminal"
        className={`grid h-8 w-8 place-items-center rounded-app transition-colors hover:bg-bg-hover ${
          terminalOpen ? 'text-accent' : 'text-fg-secondary hover:text-fg'
        }`}
      >
        <TerminalSquare size={17} />
      </button>
    </div>
  )
}
