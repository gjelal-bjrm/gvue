import { useEffect, useState } from 'react'
import { Star, FolderOpen } from 'lucide-react'
import { useNavStore } from '../state/useNavStore'
import type { DirEntry, QuickAccessData } from '@shared/types'
import { formatRelativeDate, formatDate, parentPath } from '../lib/format'
import { fileIconSpec } from '../lib/fileIcon'

/**
 * Page « Accès rapide » (façon explorateur Windows) : dossiers fréquents et
 * fichiers récents. Remplace la liste de fichiers quand on clique sur le bouton
 * Accès rapide de la sidebar. Clic = sélection, double-clic = ouvrir.
 */
export default function QuickAccessPanel(): JSX.Element {
  const navigate = useNavStore((s) => s.navigate)
  const [data, setData] = useState<QuickAccessData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Rechargé à chaque ouverture de la page (le composant est monté à la demande).
  useEffect(() => {
    let alive = true
    window.api.fs
      .quickAccess()
      .then((d) => {
        if (alive) setData(d)
      })
      .catch(() => {
        if (alive) setData({ frequent: [], recentFiles: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  const activate = (entry: DirEntry): void => {
    if (entry.kind === 'directory') navigate(entry.path)
    else void window.api.fs.open(entry.path)
  }

  const frequent = data?.frequent ?? []
  const recentFiles = data?.recentFiles ?? []
  const empty = data !== null && frequent.length === 0 && recentFiles.length === 0

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <Star size={15} className="text-accent" />
        <span className="text-[13px] font-medium text-fg">Accès rapide</span>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {empty && (
          <div className="p-8 text-center text-[13px] text-fg-muted">
            Naviguez dans des dossiers et ouvrez des fichiers pour peupler l’accès rapide.
          </div>
        )}

        {frequent.length > 0 && (
          <section className="mb-5">
            <GroupTitle>Dossiers fréquents ({frequent.length})</GroupTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-1.5">
              {frequent.map((e) => (
                <FolderCard
                  key={e.path}
                  entry={e}
                  selected={selected === e.path}
                  onSelect={() => setSelected(e.path)}
                  onActivate={() => activate(e)}
                />
              ))}
            </div>
          </section>
        )}

        {recentFiles.length > 0 && (
          <section>
            <GroupTitle>Fichiers récents ({recentFiles.length})</GroupTitle>
            <div className="flex flex-col">
              {recentFiles.map((e) => (
                <FileRow
                  key={e.path}
                  entry={e}
                  selected={selected === e.path}
                  onSelect={() => setSelected(e.path)}
                  onActivate={() => activate(e)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function GroupTitle(props: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
      {props.children}
    </div>
  )
}

function FolderCard(props: {
  entry: DirEntry
  selected: boolean
  onSelect: () => void
  onActivate: () => void
}): JSX.Element {
  const { entry } = props
  return (
    <div
      className={`flex cursor-default items-center gap-2.5 rounded-app px-2.5 py-2 ${
        props.selected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
      }`}
      onClick={props.onSelect}
      onDoubleClick={props.onActivate}
      title={entry.path}
    >
      <FolderOpen size={18} className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[13px] ${props.selected ? 'text-accent' : 'text-fg'}`}>
          {entry.name}
        </div>
        <div className="truncate text-[11px] text-fg-muted">{parentPath(entry.path)}</div>
      </div>
    </div>
  )
}

function FileRow(props: {
  entry: DirEntry
  selected: boolean
  onSelect: () => void
  onActivate: () => void
}): JSX.Element {
  const { entry } = props
  const { Icon, color } = fileIconSpec(entry)
  return (
    <div
      className={`flex h-8 cursor-default items-center gap-2.5 rounded-app px-2.5 ${
        props.selected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
      }`}
      onClick={props.onSelect}
      onDoubleClick={props.onActivate}
      title={entry.path}
    >
      <Icon size={16} style={{ color }} className="shrink-0" />
      <span className={`shrink-0 truncate text-[13px] ${props.selected ? 'text-accent' : 'text-fg'}`}>
        {entry.name}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">{parentPath(entry.path)}</span>
      <span
        className="shrink-0 text-[11px] text-fg-muted tabular-nums"
        title={formatDate(entry.modifiedMs)}
      >
        {formatRelativeDate(entry.modifiedMs)}
      </span>
    </div>
  )
}
