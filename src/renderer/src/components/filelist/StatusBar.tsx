import GitWidget from '../GitWidget'

/** Barre d'état bas de liste : compteurs d'éléments + widget Git du volet actif. */
export default function StatusBar(props: {
  count: number
  total: number
  selectedCount: number
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
      {props.selectedCount > 0 && (
        <span className="shrink-0 pl-3">
          {props.selectedCount} sélectionné{props.selectedCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
