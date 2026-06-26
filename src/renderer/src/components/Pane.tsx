import { X, Star, Rocket } from 'lucide-react'
import { useNavStore } from '../state/useNavStore'
import { baseName } from '../lib/format'
import FileList from './FileList'
import QuickAccessPanel from './QuickAccessPanel'
import LauncherPanel from './LauncherPanel'

/**
 * Volet de navigation : en-tête (chemin + fermeture, visible en multi-volets)
 * et corps (liste de fichiers ou page Accès rapide). Cliquer dans un volet le
 * rend actif — c'est lui que pilotent alors la barre d'outils, Git et la palette.
 */
export default function Pane({ paneId }: { paneId: string }): JSX.Element | null {
  const pane = useNavStore((s) => s.panes.find((p) => p.id === paneId))
  const activeId = useNavStore((s) => s.activeId)
  const count = useNavStore((s) => s.panes.length)
  const setActive = useNavStore((s) => s.setActive)
  const closePane = useNavStore((s) => s.closePane)

  if (!pane) return null
  const isActive = activeId === paneId
  const multi = count > 1

  return (
    <div
      className={`flex h-full min-w-0 flex-col ${multi && isActive ? 'ring-1 ring-inset ring-accent' : ''}`}
      onMouseDown={() => {
        if (!isActive) setActive(paneId)
      }}
    >
      {multi && (
        <div
          className={`flex h-7 shrink-0 items-center gap-1.5 border-b border-border px-2 text-[11px] ${
            isActive ? 'bg-bg-secondary text-fg' : 'bg-bg-tertiary text-fg-muted'
          }`}
        >
          {pane.quickAccess && <Star size={11} className="shrink-0 text-accent" />}
          {pane.launcher && <Rocket size={11} className="shrink-0 text-accent" />}
          <span className="min-w-0 flex-1 truncate" title={pane.path}>
            {pane.launcher
              ? 'Lanceur'
              : pane.quickAccess
                ? 'Accès rapide'
                : baseName(pane.path) || pane.path}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              closePane(paneId)
            }}
            title="Fermer le volet"
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {pane.launcher ? (
          <LauncherPanel />
        ) : pane.quickAccess ? (
          <QuickAccessPanel />
        ) : (
          <FileList paneId={paneId} />
        )}
      </div>
    </div>
  )
}
