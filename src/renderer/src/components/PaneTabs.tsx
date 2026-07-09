import { Plus, X, Star, Rocket, Folder } from 'lucide-react'
import { useNavStore, type Pane } from '../state/useNavStore'
import { baseName } from '../lib/format'

/** Libellé d'un onglet : nom du dossier, ou la page spéciale affichée. */
function tabLabel(p: Pane): string {
  if (p.quickAccess) return 'Accès rapide'
  if (p.launcher) return 'Lanceur'
  return baseName(p.path) || p.path || '…'
}

function tabIcon(p: Pane): JSX.Element {
  if (p.quickAccess) return <Star size={12} className="shrink-0" />
  if (p.launcher) return <Rocket size={12} className="shrink-0" />
  return <Folder size={12} className="shrink-0" />
}

/**
 * Barre d'onglets d'une colonne (façon explorateur Windows) : un clic active
 * l'onglet, la molette (clic milieu) ou × le ferme, « + » ouvre un onglet sur
 * le même dossier. Ctrl+T / Ctrl+W pilotent la colonne active.
 */
export default function PaneTabs(props: {
  group: number
  tabs: Pane[]
  visibleId: string
}): JSX.Element {
  const activeId = useNavStore((s) => s.activeId)
  const totalPanes = useNavStore((s) => s.panes.length)
  const setActive = useNavStore((s) => s.setActive)
  const closePane = useNavStore((s) => s.closePane)
  const addTab = useNavStore((s) => s.addTab)

  const canClose = totalPanes > 1

  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border bg-bg-secondary px-1">
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {props.tabs.map((t) => {
          const visible = t.id === props.visibleId
          const isActive = t.id === activeId
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              onAuxClick={(e) => {
                // Clic milieu : ferme l'onglet (comme un navigateur).
                if (e.button === 1 && canClose) closePane(t.id)
              }}
              title={t.quickAccess ? 'Accès rapide' : t.launcher ? 'Lanceur' : t.path}
              className={`group flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-app px-2 py-1 text-[12px] ${
                visible
                  ? isActive
                    ? 'bg-accent-soft text-accent'
                    : 'bg-bg text-fg'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary'
              }`}
            >
              {tabIcon(t)}
              <span className="min-w-0 truncate">{tabLabel(t)}</span>
              {canClose && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    closePane(t.id)
                  }}
                  title="Fermer l'onglet (Ctrl+W)"
                  className="grid h-4 w-4 shrink-0 place-items-center rounded opacity-0 hover:bg-bg-hover group-hover:opacity-100"
                >
                  <X size={11} />
                </span>
              )}
            </button>
          )
        })}
        {/* « + » collé au dernier onglet, façon Chrome. */}
        <button
          onClick={() => void addTab(props.group)}
          title="Nouvel onglet (Ctrl+T)"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
