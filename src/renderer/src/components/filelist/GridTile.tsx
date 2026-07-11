import type { DirEntry, GitFileChange } from '@shared/types'
import { fileIconSpec } from '../../lib/fileIcon'
import { useOsIcon } from '../../lib/osIcons'
import { gitBadge } from './helpers'
import RenameInput from './RenameInput'

/** Tuile de la vue grille : grande icône/vignette + nom sur deux lignes. */
export default function GridTile(props: {
  entry: DirEntry
  selected: boolean
  renaming: boolean
  git?: GitFileChange
  gitDir?: boolean
  dropActive?: boolean
  onClick: (e: React.MouseEvent) => void
  onActivate: () => void
  onContext: (e: React.MouseEvent) => void
  onCommitRename: (name: string) => void
  onCancelRename: () => void
  dropDir?: string
  onDragStart: (e: React.DragEvent) => void
  onDirOver?: (e: React.DragEvent) => void
  onDirDrop?: (e: React.DragEvent) => void
}): JSX.Element {
  const { entry, git } = props
  const { Icon, color } = fileIconSpec(entry)
  const osIcon = useOsIcon(entry)
  const badge = git ? gitBadge(git.category) : null

  return (
    <div
      data-gvue-dir={props.dropDir}
      draggable={!props.renaming}
      onDragStart={props.onDragStart}
      onDragOver={props.onDirOver}
      onDrop={props.onDirDrop}
      onClick={props.onClick}
      onDoubleClick={props.onActivate}
      onContextMenu={props.onContext}
      title={entry.path}
      className={`flex h-full w-full cursor-default flex-col items-center gap-1 rounded-app p-2 ${
        props.dropActive
          ? 'bg-accent-soft ring-1 ring-inset ring-accent'
          : props.selected
            ? 'bg-accent-soft'
            : 'hover:bg-bg-hover'
      } ${entry.hidden ? 'opacity-55' : ''}`}
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center">
        {osIcon ? (
          <img src={osIcon} alt="" className="max-h-10 max-w-10 object-contain" draggable={false} />
        ) : (
          <Icon size={34} style={{ color }} />
        )}
        {badge && (
          <span
            className="absolute -right-1 -top-1 font-mono text-[10px] font-bold"
            style={{ color: badge.color }}
            title={git?.category}
          >
            {badge.letter}
          </span>
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
          className={`line-clamp-2 w-full break-words text-center text-[11px] leading-tight ${
            props.selected ? 'text-accent' : badge ? '' : 'text-fg-secondary'
          }`}
          style={badge && !props.selected ? { color: badge.color } : undefined}
        >
          {entry.name}
        </span>
      )}
    </div>
  )
}
