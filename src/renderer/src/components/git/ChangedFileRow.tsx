import { Undo2 } from 'lucide-react'
import type { GitFileChange } from '@shared/types'
import { badge } from './badge'

/**
 * Ligne d'un fichier modifié (vue Modifications) : case indexer/désindexer,
 * badge de statut, chemin relatif et bouton « annuler » au survol.
 */
export default function ChangedFileRow(props: {
  file: GitFileChange
  rel: string
  selected: boolean
  /** Fichier dont le diff est affiché (anneau accent). */
  lead: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onToggleStaged: () => void
  onDiscard: () => void
}): JSX.Element {
  const { file, rel } = props
  const b = badge(file.category)
  return (
    <div
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
      className={`group flex cursor-pointer items-center gap-1.5 rounded-app px-1.5 py-1 ${
        props.selected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
      } ${props.lead ? 'ring-1 ring-inset ring-accent' : ''}`}
    >
      <input
        type="checkbox"
        checked={file.staged}
        onClick={(e) => e.stopPropagation()}
        onChange={props.onToggleStaged}
        title={file.staged ? 'Sera commité (cliquer pour désindexer)' : 'Cocher pour indexer'}
        className="shrink-0 accent-[var(--accent)]"
      />
      <span className={`w-3 shrink-0 text-center font-mono text-[11px] font-bold ${b.cls}`}>
        {b.letter}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[12px] ${props.selected ? 'text-accent' : 'text-fg-secondary'}`}
        title={rel}
      >
        {rel}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onDiscard()
        }}
        title="Annuler les modifications (destructif)"
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
      >
        <Undo2 size={12} />
      </button>
    </div>
  )
}
