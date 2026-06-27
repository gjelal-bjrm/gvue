import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Folder, File, Loader2 } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { baseName } from '../lib/format'
import type { TreeEntry } from '@shared/types'

/** Score flou : sous-chaîne (meilleur, bonus si début) puis sous-séquence, sinon -1. */
function score(query: string, text: string): number {
  if (!query) return 1
  const t = text.toLowerCase()
  const idx = t.indexOf(query)
  if (idx >= 0) return 1000 - idx - text.length * 0.1
  let ti = 0
  for (const ch of query) {
    ti = t.indexOf(ch, ti)
    if (ti === -1) return -1
    ti++
  }
  return 100 - text.length * 0.1
}

/**
 * Recherche de fichiers par nom (Ctrl+E), façon « Aller au fichier » de VS Code :
 * parcourt l'arborescence du dossier courant (dossiers lourds ignorés, borné),
 * filtre/ordonne en flou côté client. Entrée : dossier → on y entre ; fichier →
 * on l'affiche dans son dossier (sélectionné).
 */
export default function FileFinder(): JSX.Element | null {
  const open = useUiStore((s) => s.fileFinderOpen)
  const setOpen = useUiStore((s) => s.setFileFinder)
  const path = useNavStore((s) => activePane(s).path)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [entries, setEntries] = useState<TreeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // (Re)charge l'arborescence du dossier courant à l'ouverture.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(0)
    setLoading(true)
    inputRef.current?.focus()
    let alive = true
    window.api.fs
      .listTree(path)
      .then((t) => alive && setEntries(t))
      .catch(() => alive && setEntries([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [open, path])

  const rootPrefix = path.replace(/[\\/]+$/, '') + '/'
  const rel = (p: string): string => (p.startsWith(rootPrefix) ? p.slice(rootPrefix.length) : p)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .map((e) => ({ e, s: q ? score(q, e.name) : 1 }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
      .slice(0, 100)
      .map((x) => x.e)
  }, [entries, query])

  useEffect(() => setSelected((s) => Math.min(s, Math.max(0, filtered.length - 1))), [filtered.length])
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected, filtered.length])

  if (!open) return null

  const choose = (entry: TreeEntry): void => {
    setOpen(false)
    const nav = useNavStore.getState()
    if (entry.dir) {
      void nav.navigate(entry.path)
    } else {
      const parent = entry.path.slice(0, entry.path.lastIndexOf('/')) || entry.path
      void nav.navigate(parent).then(() => nav.setSelected([entry.path]))
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const en = filtered[selected]
      if (en) choose(en)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[70vh] w-[min(640px,92vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={`Aller à un fichier dans ${baseName(path) || path}…`}
            spellCheck={false}
            className="w-full bg-transparent py-3 text-[14px] text-fg outline-none placeholder:text-fg-muted"
          />
          {loading && <Loader2 size={15} className="shrink-0 animate-spin text-fg-muted" />}
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-fg-muted">
              {loading ? 'Indexation…' : 'Aucun fichier'}
            </div>
          ) : (
            filtered.map((en, i) => {
              const r = rel(en.path)
              const dirPart = r.includes('/') ? r.slice(0, r.lastIndexOf('/')) : ''
              return (
                <button
                  key={en.path}
                  data-selected={i === selected}
                  onMouseMove={() => setSelected(i)}
                  onClick={() => choose(en)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] ${
                    i === selected ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover'
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center">
                    {en.dir ? <Folder size={15} /> : <File size={15} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{en.name}</span>
                  {dirPart && <span className="shrink-0 truncate text-[11px] text-fg-muted">{dirPart}</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
