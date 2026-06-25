import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowUp,
  ArrowDown,
  FolderOpen,
  ExternalLink,
  Copy,
  Trash2,
  Plus,
  Minus,
  Undo2,
  Scissors,
  ClipboardCopy,
  ClipboardPaste
} from 'lucide-react'
import { useNavStore, type SortKey } from '../state/useNavStore'
import { useAppearanceStore } from '../state/useAppearanceStore'
import { useGitStore } from '../state/useGitStore'
import type { DirEntry, GitCategory, GitFileChange } from '@shared/types'
import { useUiStore } from '../state/useUiStore'
import { formatSize, formatRelativeDate, formatDate, pathKey } from '../lib/format'
import { fileIconSpec } from '../lib/fileIcon'
import { clipFiles, pasteInto } from '../lib/fileActions'
import GitWidget from './GitWidget'
import ContextMenu, { type MenuEntry } from './ContextMenu'

/** Lettre + couleur (variable de thème) associées à une catégorie Git. */
function gitBadge(category: GitCategory): { letter: string; color: string } {
  switch (category) {
    case 'untracked':
      return { letter: 'U', color: 'var(--success-fg)' }
    case 'added':
      return { letter: 'A', color: 'var(--success-fg)' }
    case 'deleted':
      return { letter: 'D', color: 'var(--danger-fg)' }
    case 'renamed':
      return { letter: 'R', color: 'var(--info-fg)' }
    case 'conflict':
      return { letter: '!', color: 'var(--danger-fg)' }
    case 'ignored':
      return { letter: '·', color: 'var(--fg-muted)' }
    default:
      return { letter: 'M', color: 'var(--warning-fg)' }
  }
}

/**
 * Liste de fichiers virtualisée (@tanstack/react-virtual) : seules les lignes
 * visibles sont montées → fluide sur des dossiers de milliers d'entrées.
 */
const EMPTY_MAP: Record<string, GitFileChange> = {}
const EMPTY_SET = new Set<string>()

export default function FileList(props: { paneId: string }): JSX.Element {
  const pane = useNavStore((s) => s.panes.find((p) => p.id === props.paneId))
  const activeId = useNavStore((s) => s.activeId)
  const setSort = useNavStore((s) => s.setSort)
  const navigate = useNavStore((s) => s.navigate)
  const setSelected = useNavStore((s) => s.setSelectedPath)
  const showHidden = useNavStore((s) => s.showHidden)
  const hideGitIgnored = useNavStore((s) => s.hideGitIgnored)
  const density = useAppearanceStore((s) => s.appearance.density)
  const repo = useGitStore((s) => s.repo)
  const statusByPath = useGitStore((s) => s.statusByPath)
  const dirtyDirs = useGitStore((s) => s.dirtyDirs)
  const ignoredAll = useGitStore((s) => s.ignored)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: DirEntry } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const clipboard = useUiStore((s) => s.clipboard)
  const parentRef = useRef<HTMLDivElement>(null)

  const isActive = activeId === props.paneId
  const entries = pane?.entries ?? []
  const loading = pane?.loading ?? false
  const error = pane?.error ?? null
  const sortKey = pane?.sortKey ?? 'name'
  const sortDir = pane?.sortDir ?? 'asc'
  const path = pane?.path ?? ''
  const selected = pane?.selectedPath ?? null

  // Le store Git est global → on n'affiche les badges que dans le volet actif.
  const gitMap = isActive ? statusByPath : EMPTY_MAP
  const gitDirty = isActive ? dirtyDirs : EMPTY_SET
  const ignored = isActive ? ignoredAll : EMPTY_SET

  // Rafraîchit le statut Git du volet actif quand son dossier/contenu change.
  useEffect(() => {
    if (isActive && path) void useGitStore.getState().refresh(path)
  }, [isActive, path, entries])

  const rowHeight = density === 'compact' ? 26 : 34

  const visible = useMemo(() => {
    let v = showHidden ? entries : entries.filter((e) => !e.hidden)
    if (hideGitIgnored && ignored.size > 0) {
      v = v.filter((e) => !ignored.has(pathKey(e.path)))
    }
    return v
  }, [entries, showHidden, hideGitIgnored, ignored])

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

  // Rafraîchit statut Git + liste après une action (stage/discard/corbeille…).
  const refreshAfter = async (): Promise<void> => {
    await useGitStore.getState().refresh(path)
    useNavStore.getState().refresh()
  }

  const trash = async (entry: DirEntry): Promise<void> => {
    try {
      await window.api.fs.trash(entry.path)
      if (selected === entry.path) setSelected(null)
      await refreshAfter()
    } catch {
      /* annulé ou échec : la liste reste inchangée */
    }
  }

  // Dépôt de fichiers (depuis un autre volet, une autre instance, ou l'explorateur).
  // Maj enfoncée = déplacer, sinon copier.
  const doDrop = async (e: React.DragEvent, destDir: string): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.api.fs.pathForFile(f))
      .filter(Boolean)
    if (paths.length === 0) return
    const op = e.shiftKey ? window.api.fs.move : window.api.fs.copy
    await op(paths, destDir)
    useNavStore.getState().refreshAll()
    if (isActive) void useGitStore.getState().refresh(path)
  }

  const buildMenu = (entry: DirEntry): MenuEntry[] => {
    const git = statusByPath[pathKey(entry.path)]
    const entries: MenuEntry[] = [
      { label: 'Ouvrir', icon: <FolderOpen size={14} />, onClick: () => onActivate(entry) },
      {
        label: "Ouvrir dans l'explorateur",
        icon: <ExternalLink size={14} />,
        onClick: () => void window.api.fs.reveal(entry.path)
      },
      { type: 'sep' },
      {
        label: 'Copier le chemin',
        icon: <Copy size={14} />,
        onClick: () => void navigator.clipboard.writeText(entry.path)
      },
      {
        label: 'Copier le nom',
        icon: <Copy size={14} />,
        onClick: () => void navigator.clipboard.writeText(entry.name)
      },
      { type: 'sep' },
      { label: 'Couper', icon: <Scissors size={14} />, onClick: () => clipFiles([entry.path], 'cut') },
      { label: 'Copier', icon: <ClipboardCopy size={14} />, onClick: () => clipFiles([entry.path], 'copy') },
      {
        label: entry.kind === 'directory' ? 'Coller dans le dossier' : 'Coller',
        icon: <ClipboardPaste size={14} />,
        disabled: !clipboard,
        onClick: () => void pasteInto(entry.kind === 'directory' ? entry.path : path)
      }
    ]

    if (repo && git && git.category !== 'ignored') {
      entries.push({ type: 'sep' })
      entries.push({
        label: 'Indexer',
        icon: <Plus size={14} />,
        onClick: () => void window.api.git.stage(path, entry.path).then(refreshAfter)
      })
      entries.push({
        label: 'Désindexer',
        icon: <Minus size={14} />,
        disabled: !git.staged,
        onClick: () => void window.api.git.unstage(path, entry.path).then(refreshAfter)
      })
      if (git.category !== 'untracked') {
        entries.push({
          label: 'Annuler les modifications',
          icon: <Undo2 size={14} />,
          danger: true,
          onClick: () => {
            if (window.confirm(`Annuler les modifications de « ${entry.name} » ? Action irréversible.`)) {
              void window.api.git.discard(path, entry.path).then(refreshAfter)
            }
          }
        })
      }
    }

    entries.push({ type: 'sep' })
    entries.push({
      label: 'Supprimer (corbeille)',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: () => void trash(entry)
    })
    return entries
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ColumnHeader sortKey={sortKey} sortDir={sortDir} onSort={setSort} />

      {error && (
        <div className="m-3 rounded-app border border-danger-fg bg-danger-bg p-3 text-[13px] text-danger-fg">
          {error}
        </div>
      )}

      <div
        ref={parentRef}
        className={`relative flex-1 overflow-auto ${
          dragOver === '__pane__' && path ? 'ring-2 ring-inset ring-accent' : ''
        }`}
        onDragOver={(e) => {
          if (!path) return
          e.preventDefault()
          setDragOver('__pane__')
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) setDragOver(null)
        }}
        onDrop={(e) => void doDrop(e, path)}
      >
        {!loading && visible.length === 0 && !error && (
          <div className="p-8 text-center text-[13px] text-fg-muted">Dossier vide</div>
        )}
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const entry = visible[vi.index]
            const key = pathKey(entry.path)
            const isDir = entry.kind === 'directory'
            return (
              <Row
                key={entry.path}
                entry={entry}
                height={rowHeight}
                selected={selected === entry.path}
                top={vi.start}
                git={gitMap[key]}
                gitDir={isDir && gitDirty.has(key)}
                dropActive={dragOver === entry.path}
                onSelect={() => setSelected(entry.path)}
                onActivate={() => onActivate(entry)}
                onDragStart={() => window.api.fs.startDrag([entry.path])}
                onDirOver={
                  isDir
                    ? (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragOver(entry.path)
                      }
                    : undefined
                }
                onDirDrop={isDir ? (e) => void doDrop(e, entry.path) : undefined}
                onContext={(e) => {
                  e.preventDefault()
                  setSelected(entry.path)
                  setMenu({ x: e.clientX, y: e.clientY, entry })
                }}
              />
            )
          })}
        </div>
      </div>

      <StatusBar count={visible.length} total={entries.length} selected={selected} showGit={isActive} />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={buildMenu(menu.entry)}
          onClose={() => setMenu(null)}
        />
      )}
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
      <span className="w-6 shrink-0" />
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
  git?: GitFileChange
  gitDir?: boolean
  dropActive?: boolean
  onSelect: () => void
  onActivate: () => void
  onContext: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDirOver?: (e: React.DragEvent) => void
  onDirDrop?: (e: React.DragEvent) => void
}): JSX.Element {
  const { entry, git } = props
  const { Icon, color } = fileIconSpec(entry)
  const badge = git ? gitBadge(git.category) : null
  // Teinte le nom selon le statut Git (fichier suivi modifié, non suivi, conflit…).
  const nameColor = props.selected
    ? 'text-accent'
    : badge && git?.category !== 'ignored'
      ? ''
      : 'text-fg'
  return (
    <div
      className={`absolute left-0 flex w-full cursor-default items-center px-3 ${
        props.dropActive
          ? 'bg-accent-soft ring-1 ring-inset ring-accent'
          : props.selected
            ? 'bg-accent-soft'
            : 'hover:bg-bg-hover'
      } ${entry.hidden ? 'opacity-55' : ''}`}
      style={{ top: props.top, height: props.height }}
      draggable
      onDragStart={(e) => {
        // Glisser natif (vrais fichiers) géré côté main → cross-instance/explorateur.
        e.preventDefault()
        props.onDragStart()
      }}
      onDragOver={props.onDirOver}
      onDrop={props.onDirDrop}
      onClick={props.onSelect}
      onDoubleClick={props.onActivate}
      onContextMenu={props.onContext}
      title={git ? `${entry.path} · ${git.category}${git.staged ? ' (indexé)' : ''}` : entry.path}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
        <span className="relative shrink-0">
          <Icon size={16} style={{ color }} />
          {props.gitDir && !badge && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--warning-fg)' }}
            />
          )}
        </span>
        <span
          className={`truncate ${nameColor}`}
          style={badge && !props.selected ? { color: badge.color } : undefined}
        >
          {entry.name}
        </span>
        {entry.symlink && <span className="text-[11px] text-fg-muted">↗</span>}
        {entry.hidden && <span className="ml-1 text-[11px] text-fg-muted">masqué</span>}
      </div>
      <div className="w-6 shrink-0 text-center text-[12px] font-semibold tabular-nums">
        {badge && (
          <span style={{ color: badge.color }} title={git?.category}>
            {badge.letter}
          </span>
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
  showGit: boolean
}): JSX.Element {
  const hiddenCount = props.total - props.count
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-bg-secondary px-3 py-1.5 text-[12px] text-fg-muted">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0">
          {props.count} élément{props.count > 1 ? 's' : ''}
          {hiddenCount > 0 && ` · ${hiddenCount} masqué${hiddenCount > 1 ? 's' : ''}`}
        </span>
        {props.showGit && <GitWidget />}
      </div>
      {props.selected && (
        <span className="truncate pl-3">{props.selected.split(/[\\/]/).pop()}</span>
      )}
    </div>
  )
}
