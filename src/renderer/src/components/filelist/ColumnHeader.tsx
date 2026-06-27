import { ArrowUp, ArrowDown } from 'lucide-react'
import type { SortKey } from '../../state/useNavStore'

/** En-tête de colonnes triables (nom, taille, date de modification). */
export default function ColumnHeader(props: {
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
