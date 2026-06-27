import { useEffect, useRef, useState } from 'react'

/**
 * Champ d'édition inline d'un nom de fichier/dossier. Sélectionne le nom sans
 * l'extension à l'ouverture (comme l'explorateur Windows) et garantit une seule
 * issue (valider OU annuler), même lors du blur au démontage.
 */
export default function RenameInput(props: {
  initial: string
  onCommit: (name: string) => void
  onCancel: () => void
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const [val, setVal] = useState(props.initial)
  const doneRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = props.initial.lastIndexOf('.')
    if (dot > 0) el.setSelectionRange(0, dot)
    else el.select()
  }, [props.initial])

  const finish = (commit: boolean): void => {
    if (doneRef.current) return
    doneRef.current = true
    if (commit) props.onCommit(val)
    else props.onCancel()
  }

  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
      spellCheck={false}
      className="min-w-0 flex-1 rounded border border-accent bg-bg px-1 text-[13px] text-fg outline-none"
    />
  )
}
