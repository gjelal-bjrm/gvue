import { useMemo } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useUpdateStore } from '../state/useUpdateStore'
import Logo from './Logo'
import { WHATS_NEW } from '../data/whatsNew'

/** Compare deux versions « x.y.z » (>0 si a>b). */
function cmpVer(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

/**
 * Pop-up « Nouveautés » : montre les notes des versions plus récentes que
 * `whatsNewSince`. Affichée une fois après une mise à jour (cf. App.tsx) ou à la
 * demande via la palette (alors `since` vaut '' → tout le changelog).
 */
export default function WhatsNew(): JSX.Element | null {
  const since = useUiStore((s) => s.whatsNewSince)
  const setWhatsNew = useUiStore((s) => s.setWhatsNew)
  const version = useUpdateStore((s) => s.version)

  const items = useMemo(() => {
    if (since == null) return []
    return WHATS_NEW.filter((r) => cmpVer(r.version, since) > 0)
  }, [since])

  if (since == null) return null
  const close = (): void => setWhatsNew(null)
  // Si rien de spécifique au changelog, message générique.
  const shown = items.length > 0 ? items : version ? [{ version, notes: [] as string[] }] : []

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 flex max-h-[80vh] w-[min(520px,92vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
          <Logo size={22} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[14px] font-medium text-fg">
              <Sparkles size={15} className="text-accent" /> Nouveautés de GVue
            </div>
            {version && <div className="text-[11px] text-fg-muted">version {version}</div>}
          </div>
          <button
            onClick={close}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 text-[13px]">
          {shown.length === 0 ? (
            <p className="text-fg-muted">Aucune note de version disponible.</p>
          ) : (
            shown.map((r) => (
              <div key={r.version} className="mb-4 last:mb-0">
                <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-accent">
                  v{r.version}
                </div>
                {r.notes.length === 0 ? (
                  <p className="text-fg-muted">Mise à jour appliquée.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {r.notes.map((n, i) => (
                      <li key={i} className="flex gap-2 text-fg-secondary">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-border px-4 py-3">
          <button
            onClick={close}
            className="rounded-app bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
          >
            Super, merci !
          </button>
        </div>
      </div>
    </div>
  )
}
