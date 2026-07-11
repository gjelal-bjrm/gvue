import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * Menu contextuel générique positionné au curseur. Se ferme au clic extérieur,
 * au clic droit ailleurs, ou sur Échap. La position est mesurée sur le menu
 * RÉEL (pas une hauteur estimée) puis contrainte à la fenêtre ; au-delà de la
 * hauteur disponible, le menu défile. Une entrée peut porter un sous-menu
 * (`children`), ouvert au survol, positionné en `fixed` pour ne pas être rogné.
 */

export interface MenuAction {
  type?: 'item'
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  /** Sous-menu : entrées affichées au survol (onClick est alors ignoré). */
  children?: MenuEntry[]
}

export type MenuEntry = MenuAction | { type: 'sep' }

const PAD = 6

export default function ContextMenu(props: {
  x: number
  y: number
  entries: MenuEntry[]
  onClose: () => void
}): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [openSub, setOpenSub] = useState<number | null>(null)
  const { onClose } = props

  useEffect(() => {
    // Ferme au clic en dehors du menu (comme l'explorateur), à Échap, au
    // redimensionnement et à la perte de focus. Les sous-menus sont dans le
    // sous-arbre DOM du menu : le test `contains` les couvre.
    const onDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('contextmenu', onDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('contextmenu', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  // Position réelle : mesurée après montage. L'ancienne heuristique (hauteur
  // estimée fixe) coupait les longs menus en bas de fenêtre.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      left: Math.max(PAD, Math.min(props.x, window.innerWidth - r.width - PAD)),
      top: Math.max(PAD, Math.min(props.y, window.innerHeight - r.height - PAD))
    })
  }, [props.x, props.y, props.entries])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-52 overflow-y-auto rounded-app border border-border bg-bg-secondary py-1 text-[12px] shadow-lg"
      style={{
        left: pos?.left ?? props.x,
        top: pos?.top ?? props.y,
        maxHeight: window.innerHeight - PAD * 2,
        visibility: pos ? undefined : 'hidden'
      }}
    >
      {props.entries.map((it, i) =>
        'type' in it && it.type === 'sep' ? (
          <div key={i} className="my-1 h-px bg-border" />
        ) : (it as MenuAction).children ? (
          <SubMenuItem
            key={i}
            item={it as MenuAction}
            open={openSub === i}
            onHover={() => setOpenSub(i)}
            onCloseAll={onClose}
          />
        ) : (
          <MenuRow
            key={i}
            item={it as MenuAction}
            onMouseEnter={() => setOpenSub(null)}
            onClick={() => {
              onClose()
              ;(it as MenuAction).onClick?.()
            }}
          />
        )
      )}
    </div>
  )
}

/** Ligne d'action simple (réutilisée par le menu et les sous-menus). */
function MenuRow(props: {
  item: MenuAction
  chevron?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}): JSX.Element {
  const { item } = props
  return (
    <button
      disabled={item.disabled}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-bg-hover disabled:opacity-40 disabled:hover:bg-transparent ${
        item.danger ? 'text-danger-fg' : 'text-fg-secondary hover:text-fg'
      }`}
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center">{item.icon}</span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {props.chevron && <ChevronRight size={13} className="shrink-0 text-fg-muted" />}
    </button>
  )
}

/**
 * Entrée à sous-menu : le panneau enfant est positionné en `fixed` (calculé
 * depuis la ligne survolée) pour ne pas être rogné par le défilement du menu
 * parent, et retourné à gauche / remonté s'il déborde de la fenêtre.
 */
function SubMenuItem(props: {
  item: MenuAction
  open: boolean
  onHover: () => void
  onCloseAll: () => void
}): JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!props.open) {
      setStyle(null)
      return
    }
    const row = rowRef.current?.getBoundingClientRect()
    const sub = subRef.current?.getBoundingClientRect()
    if (!row || !sub) return
    let left = row.right - 2
    if (left + sub.width > window.innerWidth - PAD) left = Math.max(PAD, row.left - sub.width + 2)
    let top = row.top - 5
    if (top + sub.height > window.innerHeight - PAD) {
      top = Math.max(PAD, window.innerHeight - PAD - sub.height)
    }
    setStyle({ left, top })
  }, [props.open])

  return (
    <div ref={rowRef} onMouseEnter={props.onHover}>
      <MenuRow item={props.item} chevron />
      {props.open && (
        <div
          ref={subRef}
          className="fixed z-50 w-56 overflow-y-auto rounded-app border border-border bg-bg-secondary py-1 shadow-lg"
          style={{
            ...(style ?? { left: 0, top: 0 }),
            maxHeight: window.innerHeight - PAD * 2,
            visibility: style ? undefined : 'hidden'
          }}
        >
          {(props.item.children ?? []).map((c, i) =>
            'type' in c && c.type === 'sep' ? (
              <div key={i} className="my-1 h-px bg-border" />
            ) : (
              <MenuRow
                key={i}
                item={c as MenuAction}
                onClick={() => {
                  props.onCloseAll()
                  ;(c as MenuAction).onClick?.()
                }}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
