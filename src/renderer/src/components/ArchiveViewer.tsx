import { useEffect, useMemo, useState } from 'react'
import { FileArchive, X, Folder, File, Loader2, FileDown, Search } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useNavStore } from '../state/useNavStore'
import { fmtBytes, baseName } from '../lib/format'
import type { ArchiveEntry } from '@shared/types'

/**
 * Parcours d'une archive SANS extraction (7-Zip si installé, sinon .NET pour
 * les .zip) : liste filtrable des entrées + « Extraire tout » (dans un dossier
 * au nom libre à côté de l'archive).
 */
export default function ArchiveViewer(): JSX.Element | null {
  const file = useUiStore((s) => s.archivePath)
  const close = (): void => useUiStore.getState().setArchive(null)

  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!file) return
    let alive = true
    setEntries(null)
    setError(null)
    setFilter('')
    void window.api.archive.list(file).then((r) => {
      if (!alive) return
      if (r.ok) setEntries(r.entries)
      else setError(r.error ?? 'Lecture impossible.')
    })
    return () => {
      alive = false
    }
  }, [file])

  // Fermer avec Échap.
  useEffect(() => {
    if (!file) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [file])

  const shown = useMemo(() => {
    if (!entries) return []
    const q = filter.trim().toLowerCase()
    return q ? entries.filter((e) => e.path.toLowerCase().includes(q)) : entries
  }, [entries, filter])

  const totalSize = useMemo(
    () => (entries ?? []).reduce((acc, e) => acc + (e.dir ? 0 : e.size), 0),
    [entries]
  )

  if (!file) return null

  const extractAll = (): void => {
    void window.api.archive.extract(file).then((r) => {
      useUiStore
        .getState()
        .showToast(r.ok ? 'Extraction lancée à côté de l’archive.' : `Extraction impossible : ${r.error}`)
      if (r.ok) {
        useNavStore.getState().refreshAll()
        close()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex h-[min(600px,86vh)] w-[min(720px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <FileArchive size={15} className="text-accent" />
          <span className="min-w-0 truncate text-[13px] font-medium text-fg" title={file}>
            {baseName(file)}
          </span>
          {entries && (
            <span className="shrink-0 text-[11px] text-fg-muted">
              {entries.length} entrée{entries.length > 1 ? 's' : ''} · {fmtBytes(totalSize)} décompressé
            </span>
          )}
          <button
            onClick={close}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        {entries && entries.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
            <Search size={13} className="shrink-0 text-fg-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer les entrées…"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-muted"
            />
            <span className="shrink-0 text-[11px] text-fg-muted tabular-nums">{shown.length}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[12px]">
          {entries === null && !error && (
            <div className="flex h-full items-center justify-center gap-2 text-fg-muted">
              <Loader2 size={14} className="animate-spin" /> Lecture de l'archive…
            </div>
          )}
          {error && (
            <div className="flex h-full items-center justify-center px-6 text-center text-danger-fg">
              {error}
            </div>
          )}
          {shown.map((e) => (
            <div key={e.path} className="flex items-center gap-2 rounded-app px-1.5 py-0.5 hover:bg-bg-hover" title={e.path}>
              {e.dir ? (
                <Folder size={13} className="shrink-0 text-fg-muted" />
              ) : (
                <File size={13} className="shrink-0 text-fg-muted" />
              )}
              <span className="min-w-0 flex-1 truncate text-fg-secondary">{e.path}</span>
              <span className="shrink-0 text-[11px] text-fg-muted tabular-nums">
                {e.dir ? '' : fmtBytes(e.size)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
            Lecture seule — l'extraction crée un dossier au nom libre à côté de l'archive.
          </span>
          <button
            onClick={extractAll}
            disabled={!entries || entries.length === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-app bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <FileDown size={13} /> Extraire tout
          </button>
        </div>
      </div>
    </div>
  )
}
