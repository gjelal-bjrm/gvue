import { useEffect, useMemo, useState } from 'react'
import { PieChart, ArrowUp, X, Folder, File, ExternalLink, Loader2 } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useNavStore } from '../state/useNavStore'
import type { UsageEntry } from '@shared/types'

/** Formate une taille en octets (dossiers inclus). */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`
  const u = ['Ko', 'Mo', 'Go', 'To']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`
}

/** Parent d'un chemin en slashes (null si racine de lecteur). */
function parentOf(p: string): string | null {
  const norm = p.replace(/\/+$/, '')
  const i = norm.lastIndexOf('/')
  if (i <= 0) return null
  const parent = norm.slice(0, i)
  return /^[a-zA-Z]:$/.test(parent) ? parent + '/' : parent
}

/**
 * Analyse de l'espace disque (façon WinDirStat, en liste) : enfants du dossier
 * triés par taille, barres proportionnelles, descente dans les dossiers.
 */
export default function DiskUsage(): JSX.Element | null {
  const root = useUiStore((s) => s.diskUsagePath)
  const setDiskUsage = useUiStore((s) => s.setDiskUsage)
  const [dir, setDir] = useState<string | null>(null)
  const [entries, setEntries] = useState<UsageEntry[]>([])
  const [loading, setLoading] = useState(false)

  // (Ré)initialise au dossier demandé à l'ouverture.
  useEffect(() => {
    setDir(root)
  }, [root])

  // Calcule l'usage du dossier courant.
  useEffect(() => {
    if (!dir) return
    setLoading(true)
    let alive = true
    window.api.fs
      .usage(dir)
      .then((u) => alive && setEntries(u))
      .catch(() => alive && setEntries([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [dir])

  const total = useMemo(() => entries.reduce((a, e) => a + e.size, 0), [entries])
  const max = entries[0]?.size ?? 0

  if (!root || !dir) return null

  const close = (): void => setDiskUsage(null)
  const parent = parentOf(dir)

  const openInGvue = (p: string): void => {
    close()
    void useNavStore.getState().navigate(p)
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center pt-[8vh]" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[80vh] w-[min(760px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          <PieChart size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">Espace disque</span>
          <button
            onClick={() => parent && setDir(parent)}
            disabled={!parent}
            title="Dossier parent"
            className="ml-2 grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg disabled:opacity-30"
          >
            <ArrowUp size={15} />
          </button>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-muted" title={dir}>
            {dir}
          </span>
          <span className="shrink-0 text-[12px] text-fg-secondary">{fmtBytes(total)}</span>
          {loading && <Loader2 size={14} className="shrink-0 animate-spin text-fg-muted" />}
          <button
            onClick={close}
            title="Fermer"
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto py-1">
          {entries.length === 0 ? (
            <div className="px-3 py-8 text-center text-[13px] text-fg-muted">
              {loading ? 'Calcul des tailles…' : 'Dossier vide'}
            </div>
          ) : (
            entries.map((e) => {
              const pct = total > 0 ? (e.size / total) * 100 : 0
              const barW = max > 0 ? (e.size / max) * 100 : 0
              return (
                <div
                  key={e.path}
                  onClick={() => (e.dir ? setDir(e.path) : undefined)}
                  className={`group flex items-center gap-2 px-3 py-1 ${
                    e.dir ? 'cursor-pointer hover:bg-bg-hover' : ''
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center text-fg-muted">
                    {e.dir ? <Folder size={15} className="text-accent" /> : <File size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-fg-secondary" title={e.name}>
                        {e.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-fg-muted tabular-nums">
                        {pct.toFixed(1)}%
                      </span>
                      <span className="w-20 shrink-0 text-right text-[12px] text-fg tabular-nums">
                        {fmtBytes(e.size)}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                      <div
                        className={`h-full rounded-full ${e.dir ? 'bg-accent' : 'bg-fg-muted'}`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation()
                      openInGvue(e.dir ? e.path : dir)
                    }}
                    title="Ouvrir dans GVue"
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
