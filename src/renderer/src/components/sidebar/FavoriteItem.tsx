import { Star, X } from 'lucide-react'
import { baseName } from '../../lib/format'

/** Favori de la sidebar (ouvrir au clic, retirer au survol). */
export default function FavoriteItem(props: {
  path: string
  active?: boolean
  onOpen: () => void
  onRemove: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}): JSX.Element {
  return (
    <div
      onContextMenu={props.onContextMenu}
      className={`group flex items-center gap-1 rounded-app pr-1 ${
        props.active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
      }`}
    >
      <button
        onClick={props.onOpen}
        title={props.path}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-[var(--row-pad)] text-left"
      >
        <Star size={16} className="shrink-0" />
        <span className="truncate">{baseName(props.path)}</span>
      </button>
      <button
        onClick={props.onRemove}
        title="Retirer des favoris"
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  )
}
