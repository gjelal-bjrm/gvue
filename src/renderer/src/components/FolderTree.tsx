import { useEffect, useReducer, useRef, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Crosshair } from 'lucide-react'
import { useNavStore, activePane } from '../state/useNavStore'
import { useSidebarStore } from '../state/useSidebarStore'
import { pathKey } from '../lib/format'
import type { DirEntry } from '@shared/types'

/** Chemins ancêtres (de la racine du lecteur au parent direct), pour le dépli auto. */
function ancestors(p: string): string[] {
  const norm = p.replace(/\//g, '\\').replace(/\\+$/, '')
  const parts = norm.split('\\')
  if (parts.length === 0 || !parts[0]) return []
  const res: string[] = [parts[0] + '\\'] // racine du lecteur, ex. « C:\ »
  let cur = res[0]
  for (let i = 1; i < parts.length - 1; i++) {
    cur = cur.endsWith('\\') ? cur + parts[i] : cur + '\\' + parts[i]
    res.push(cur)
  }
  return res
}

/**
 * Arbre des dossiers (façon explorateur Windows) : lecteurs en racines,
 * sous-dossiers chargés à la demande. Option « développer jusqu'au dossier
 * ouvert » : déplie automatiquement le chemin du volet actif (activable).
 */
export default function FolderTree(): JSX.Element {
  const drives = useNavStore((s) => s.locations?.drives ?? [])
  const navigate = useNavStore((s) => s.navigate)
  const showHidden = useNavStore((s) => s.showHidden)
  const path = useNavStore((s) => activePane(s).path)
  const quickAccess = useNavStore((s) => activePane(s).quickAccess)
  const launcher = useNavStore((s) => activePane(s).launcher)
  const treeExpand = useSidebarStore((s) => s.treeExpand)
  const toggleTreeExpand = useSidebarStore((s) => s.toggleTreeExpand)

  const cacheRef = useRef<Record<string, DirEntry[]>>({})
  const [, bump] = useReducer((v: number) => v + 1, 0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const selectedRef = useRef<HTMLDivElement>(null)

  const currentKey = !quickAccess && !launcher ? pathKey(path) : ''

  // Charge (une fois) les sous-dossiers d'un dossier dans le cache.
  const ensureChildren = async (p: string): Promise<void> => {
    const k = pathKey(p)
    if (cacheRef.current[k]) return
    try {
      const res = await window.api.fs.list(p, false)
      cacheRef.current[k] = res.entries
        .filter((e) => e.kind === 'directory' && (showHidden || !e.hidden))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      cacheRef.current[k] = []
    }
    bump()
  }

  const toggle = (p: string): void => {
    const k = pathKey(p)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else {
        next.add(k)
        void ensureChildren(p)
      }
      return next
    })
  }

  // Dépli automatique jusqu'au dossier ouvert (si l'option est active).
  useEffect(() => {
    if (!treeExpand || quickAccess || launcher || !path) return
    let cancelled = false
    void (async () => {
      const chain = ancestors(path)
      for (const a of chain) {
        if (cancelled) return
        await ensureChildren(a)
      }
      if (!cancelled) setExpanded((prev) => new Set([...prev, ...chain.map(pathKey)]))
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, treeExpand, quickAccess, launcher])

  // Recharge les lecteurs en racines au montage.
  useEffect(() => {
    for (const d of drives) void ensureChildren(d.path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drives.length])

  // Fait défiler le dossier sélectionné dans la vue quand il change.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentKey, expanded])

  const renderNode = (p: string, label: string, depth: number): JSX.Element => {
    const k = pathKey(p)
    const isOpen = expanded.has(k)
    const kids = cacheRef.current[k] ?? []
    const selected = k === currentKey
    return (
      <div key={k}>
        <div
          ref={selected ? selectedRef : undefined}
          onClick={() => navigate(p)}
          title={p}
          className={`flex cursor-pointer items-center gap-1 rounded-app pr-1 ${
            selected ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
          }`}
          style={{ paddingLeft: depth * 12 + 2 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggle(p)
            }}
            className="grid h-5 w-4 shrink-0 place-items-center text-fg-muted hover:text-fg"
          >
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {isOpen ? (
            <FolderOpen size={15} className="shrink-0" />
          ) : (
            <Folder size={15} className="shrink-0" />
          )}
          <span className="truncate py-[var(--row-pad)] text-[12px]">{label}</span>
        </div>
        {isOpen && kids.map((c) => renderNode(c.path, c.name, depth + 1))}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={toggleTreeExpand}
        title="Développer l'arbre jusqu'au dossier ouvert"
        className={`mb-1 flex items-center gap-1.5 rounded-app px-2 py-1 text-left text-[11px] ${
          treeExpand ? 'text-accent' : 'text-fg-muted hover:text-fg-secondary'
        }`}
      >
        <Crosshair size={12} className="shrink-0" />
        <span className="truncate">Suivre le dossier ouvert</span>
        <span className="ml-auto text-[10px]">{treeExpand ? 'activé' : 'désactivé'}</span>
      </button>
      {drives.map((d) => renderNode(d.path, d.label, 0))}
    </div>
  )
}
