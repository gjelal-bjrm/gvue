import type { LucideIcon } from 'lucide-react'

/** Entrée générique de la sidebar (icône + libellé, état actif). */
export default function Item(props: {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}): JSX.Element {
  const { icon: Icon } = props
  return (
    <button
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
      title={props.label}
      className={`flex items-center gap-2.5 rounded-app px-2 py-[var(--row-pad)] text-left transition-colors ${
        props.active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{props.label}</span>
    </button>
  )
}
