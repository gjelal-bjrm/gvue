import { X } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { fmtBytes } from '../lib/format'

/** Barre de progression d'une copie longue, avec bouton d'annulation. */
export default function CopyProgress(): JSX.Element | null {
  const p = useUiStore((s) => s.copyProgress)
  if (!p) return null

  const pct = p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2">
      <div className="pointer-events-auto w-[min(440px,90vw)] rounded-app border border-border bg-bg-secondary p-3 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-[12px] text-fg">
          <span className="min-w-0 flex-1 truncate">Copie en cours — {p.name}</span>
          <span className="shrink-0 tabular-nums text-fg-muted">{pct}%</span>
          <button
            onClick={() => window.api.fs.cancelCopy()}
            title="Annuler la copie"
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg"
          >
            <X size={14} />
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-tertiary">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-[11px] tabular-nums text-fg-muted">
          {fmtBytes(p.done)} / {fmtBytes(p.total)}
        </div>
      </div>
    </div>
  )
}
