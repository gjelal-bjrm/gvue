import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useNavStore, type SortKey } from '../state/useNavStore'
import { useAppearanceStore } from '../state/useAppearanceStore'
import type { DirEntry } from '@shared/types'
import { formatSize, formatRelativeDate, formatDate } from '../lib/format'
import { fileIconSpec } from '../lib/fileIcon'

/**
 * Liste de fichiers virtualisée (@tanstack/react-virtual) : seules les lignes
 * visibles sont montées → fluide sur des dossiers de milliers d'entrées.
 */
export default function FileList(): JSX.Element {
  const { entries, loading, error, sortKey, sortDir, setSort, showHidden, navigate } =
    useNavStore()
  const density = useAppearanceStore((s) => s.appearance.density)
  const [selected, setSelected] = useState<string | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const rowHeight = density === 'compact' ? 26 : 34

  const visible = useMemo(
    () => (showHidden ? entries : entries.filter((e) => !e.hidden)),
    [entries, showHidden]
  )

  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 14
  })

  // Recalcule les positions quand la densité (donc la hauteur de ligne) change.
  useEffect(() => rowVirtualizer.measure(), [rowHeight, rowVirtualizer])

  const onActivate = (entry: DirEntry): void => {
    if (entry.kind === 'directory') navigate(entry.path)
    else void window.api.fs.open(entry.path)
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ColumnHeader sortKey={sortKey} sortDir={sortDir} onSort={setSort} />

      {error && (
        <div className="m-3 rounded-app border border-danger-fg bg-danger-bg p-3 text-[13px] text-danger-fg">
          {error}
        </div>
      )}

      <div ref={parentRef} className="relative flex-1 overflow-auto">
        {!loading && visible.length === 0 && !error && (
          <div className="p-8 text-center text-[13px] text-fg-muted">Dossier vide</div>
        )}
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const entry = visible[vi.index]
            return (
              <Row
                key={entry.path}
                entry={entry}
                height={rowHeight}
                selected={selected === entry.path}
                top={vi.start}
                onSelect={() => setSelected(entry.path)}
                onActivate={() => onActivate(entry)}
              />
            )
          })}
        </div>
      </div>

      <StatusBar count={visible.length} total={entries.length} selected={selected} />
    </div>
  )
}

function ColumnHeader(props: {
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}): JSX.Element {
  const Arrow = ({ k }: { k: SortKey }): JSX.Element | null => {
    if (props.sortKey !== k) return null
    return props.sortDir === 'asc' ? (
      <ArrowUp size={12} className="ml-1 inline" />
    ) : (
      <ArrowDown size={12} className="ml-1 inline" />
    )
  }
  return (
    <div className="flex shrink-0 items-center border-b border-border px-3 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
      <button className="flex-1 px-2 py-2 text-left hover:text-fg-secondary" onClick={() => props.onSort('name')}>
        Nom <Arrow k="name" />
      </button>
      <button className="w-24 px-2 py-2 text-right hover:text-fg-secondary" onClick={() => props.onSort('size')}>
        Taille <Arrow k="size" />
      </button>
      <button className="w-32 px-2 py-2 text-right hover:text-fg-secondary" onClick={() => props.onSort('modifiedMs')}>
        Modifié <Arrow k="modifiedMs" />
      </button>
    </div>
  )
}

function Row(props: {
  entry: DirEntry
  height: number
  selected: boolean
  top: number
  onSelect: () => void
  onActivate: () => void
}): JSX.Element {
  const { entry } = props
  const { Icon, color } = fileIconSpec(entry)
  return (
    <div
      className={`absolute left-0 flex w-full cursor-default items-center px-3 ${
        props.selected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
      } ${entry.hidden ? 'opacity-55' : ''}`}
      style={{ top: props.top, height: props.height }}
      onClick={props.onSelect}
      onDoubleClick={props.onActivate}
      title={entry.path}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
        <Icon size={16} style={{ color }} className="shrink-0" />
        <span className={`truncate ${props.selected ? 'text-accent' : 'text-fg'}`}>
          {entry.name}
        </span>
        {entry.symlink && <span className="text-[11px] text-fg-muted">↗</span>}
        {entry.hidden && (
          <span className="ml-1 text-[11px] text-fg-muted">masqué</span>
        )}
      </div>
      <div className="w-24 px-2 text-right text-[12px] text-fg-muted tabular-nums">
        {formatSize(entry.size, entry.kind)}
      </div>
      <div
        className="w-32 px-2 text-right text-[12px] text-fg-muted tabular-nums"
        title={formatDate(entry.modifiedMs)}
      >
        {formatRelativeDate(entry.modifiedMs)}
      </div>
    </div>
  )
}

function StatusBar(props: {
  count: number
  total: number
  selected: string | null
}): JSX.Element {
  const hiddenCount = props.total - props.count
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-bg-secondary px-3 py-1.5 text-[12px] text-fg-muted">
      <span>
        {props.count} élément{props.count > 1 ? 's' : ''}
        {hiddenCount > 0 && ` · ${hiddenCount} masqué${hiddenCount > 1 ? 's' : ''}`}
      </span>
      {props.selected && (
        <span className="truncate pl-3">{props.selected.split(/[\\/]/).pop()}</span>
      )}
    </div>
  )
}
