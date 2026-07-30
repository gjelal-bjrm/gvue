import type { DirEntry, GitFileChange } from '@shared/types'
import { fileIconSpec } from '../../lib/fileIcon'
import { useOsIcon } from '../../lib/osIcons'
import { gitBadge } from './helpers'
import RenameInput from './RenameInput'

/**
 * Tuile de la vue grille, façon explorateur Windows : la vignette occupe toute
 * la case (générée à la résolution de la tuile — agrandir la grille agrandit
 * réellement les images), nom sur deux lignes dessous.
 */
export default function GridTile(props: {
  entry: DirEntry
  /** Largeur de la tuile (px) — pilote la taille de la vignette demandée. */
  tileSize: number
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
  // Zone d'image : la tuile moins le padding — la vignette est générée à cette taille.
  const box = Math.max(40, props.tileSize - 20)
  const osIcon = useOsIcon(entry, box)
  const badge = git ? gitBadge(git.category) : null

  return (
    <div
      data-gvue-item=""
      data-gvue-dir={props.dropDir}
      draggable={!props.renaming}
      onDragStart={props.onDragStart}
      onDragOver={props.onDirOver}
      onDrop={props.onDirDrop}
      onClick={props.onClick}
      onDoubleClick={props.onActivate}
      onContextMenu={props.onContext}
      title={entry.path}
      className={`flex h-full w-full cursor-default flex-col items-center gap-1 rounded-app p-1.5 ${
        props.dropActive
          ? 'bg-accent-soft ring-1 ring-inset ring-accent'
          : props.selected
            ? 'bg-accent-soft'
            : 'hover:bg-bg-hover'
      } ${entry.hidden ? 'opacity-55' : ''}`}
    >
      <span
        className="relative grid shrink-0 place-items-center overflow-hidden"
        style={{ width: box, height: box }}
      >
        {osIcon ? (
          <img
            src={osIcon}
            alt=""
            className="max-h-full max-w-full rounded-[3px] object-contain"
            draggable={false}
          />
        ) : (
          <Icon size={Math.round(box * 0.52)} style={{ color }} strokeWidth={1.5} />
        )}
        {badge && (
          <span
            className="absolute right-0.5 top-0.5 rounded bg-bg/80 px-0.5 font-mono text-[10px] font-bold"
            style={{ color: badge.color }}
            title={git?.category}
          >
            {badge.letter}
          </span>
        )}
        {props.gitDir && !badge && (
          <span
            className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
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
