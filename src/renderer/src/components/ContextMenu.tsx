import { useEffect } from 'react'

/**
 * Menu contextuel générique positionné au curseur. Se ferme au clic extérieur,
 * au clic droit ailleurs, ou sur Échap. Les bords sont contraints à la fenêtre.
 */

export interface MenuAction {
  type?: 'item'
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export type MenuEntry = MenuAction | { type: 'sep' }

const MENU_WIDTH = 220
const MENU_EST_HEIGHT = 360

export default function ContextMenu(props: {
  x: number
  y: number
  entries: MenuEntry[]
  onClose: () => void
}): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  const left = Math.min(props.x, window.innerWidth - MENU_WIDTH)
  const top = Math.min(props.y, window.innerHeight - MENU_EST_HEIGHT)

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={props.onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          props.onClose()
        }}
      />
      <div
        className="fixed z-50 w-52 rounded-app border border-border bg-bg-secondary py-1 text-[12px] shadow-lg"
        style={{ left, top }}
      >
        {props.entries.map((it, i) =>
          'type' in it && it.type === 'sep' ? (
            <div key={i} className="my-1 h-px bg-border" />
          ) : (
            <button
              key={i}
              disabled={(it as MenuAction).disabled}
              onClick={() => {
                props.onClose()
                ;(it as MenuAction).onClick()
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-bg-hover disabled:opacity-40 disabled:hover:bg-transparent ${
                (it as MenuAction).danger ? 'text-danger-fg' : 'text-fg-secondary hover:text-fg'
              }`}
            >
              <span className="grid h-4 w-4 shrink-0 place-items-center">
                {(it as MenuAction).icon}
              </span>
              {(it as MenuAction).label}
            </button>
          )
        )}
      </div>
    </>
  )
}
