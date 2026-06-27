import type { DirEntry, GitFileChange } from '@shared/types'
import { formatSize, formatRelativeDate, formatDate } from '../../lib/format'
import { fileIconSpec } from '../../lib/fileIcon'
import { useOsIcon } from '../../lib/osIcons'
import { gitBadge } from './helpers'
import RenameInput from './RenameInput'

/** Une ligne (virtualisée) de la liste de fichiers. */
export default function Row(props: {
  entry: DirEntry
  index: number
  height: number
  selected: boolean
  renaming: boolean
  top: number
  git?: GitFileChange
  gitDir?: boolean
  dropActive?: boolean
  onRowClick: (e: React.MouseEvent) => void
  onActivate: () => void
  onContext: (e: React.MouseEvent) => void
  onCommitRename: (name: string) => void
  onCancelRename: () => void
  dropDir?: string
  onDragStart: (e: React.DragEvent) => void
  onRightDragStart: (e: React.MouseEvent) => void
  onDirOver?: (e: React.DragEvent) => void
  onDirDrop?: (e: React.DragEvent) => void
}): JSX.Element {
  const { entry, git } = props
  const { Icon, color } = fileIconSpec(entry)
  const osIcon = useOsIcon(entry)
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
      data-gvue-dir={props.dropDir}
      draggable={!props.renaming}
      onDragStart={props.onDragStart}
      onMouseDown={props.onRightDragStart}
      onDragOver={props.onDirOver}
      onDrop={props.onDirDrop}
      onClick={props.onRowClick}
      onDoubleClick={props.onActivate}
      onContextMenu={props.onContext}
      title={git ? `${entry.path} · ${git.category}${git.staged ? ' (indexé)' : ''}` : entry.path}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
        <span className="relative grid h-4 w-4 shrink-0 place-items-center">
          {osIcon ? (
            <img src={osIcon} alt="" className="max-h-4 max-w-4 object-contain" draggable={false} />
          ) : (
            <Icon size={16} style={{ color }} />
          )}
          {props.gitDir && !badge && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--warning-fg)' }}
            />
          )}
        </span>
        {props.renaming ? (
          <RenameInput
            initial={entry.name}
            onCommit={props.onCommitRename}
            onCancel={props.onCancelRename}
          />
        ) : (
          <span
            className={`truncate ${nameColor}`}
            style={badge && !props.selected ? { color: badge.color } : undefined}
          >
            {entry.name}
          </span>
        )}
        {!props.renaming && entry.symlink && <span className="text-[11px] text-fg-muted">↗</span>}
        {!props.renaming && entry.hidden && (
          <span className="ml-1 text-[11px] text-fg-muted">masqué</span>
        )}
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
