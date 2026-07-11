import { useEffect } from 'react'
import type { NativeMenuItem } from '@shared/types'

/**
 * Menu contextuel NATIF (popup OS via Menu.popup côté main) : contrairement à
 * un menu HTML, il peut DÉBORDER de la fenêtre de l'application, comme celui
 * de l'explorateur Windows. Ce composant garde l'API historique (entries avec
 * onClick/children) : il sérialise la structure, l'envoie au processus
 * principal, puis exécute le onClick correspondant à l'entrée cliquée.
 * `icon` et `danger` sont conservés dans le type pour compatibilité mais ne
 * sont pas rendus (menus natifs Windows).
 */

export interface MenuAction {
  type?: 'item'
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  /** Sous-menu natif. */
  children?: MenuEntry[]
}

export type MenuEntry = MenuAction | { type: 'sep' }

export default function ContextMenu(props: {
  x: number
  y: number
  entries: MenuEntry[]
  onClose: () => void
}): null {
  const { x, y, entries, onClose } = props

  useEffect(() => {
    let cancelled = false
    const handlers = new Map<string, () => void>()
    let counter = 0

    const serialize = (list: MenuEntry[]): NativeMenuItem[] =>
      list.map((it) => {
        if ('type' in it && it.type === 'sep') return { type: 'separator' }
        const a = it as MenuAction
        if (a.children) {
          return { label: a.label, enabled: !a.disabled, submenu: serialize(a.children) }
        }
        const id = `m${counter++}`
        if (a.onClick) handlers.set(id, a.onClick)
        return { id, label: a.label, enabled: !a.disabled }
      })

    void window.api.menu.popup(serialize(entries), x, y).then((id) => {
      if (cancelled) return
      onClose()
      if (id) handlers.get(id)?.()
    })

    return () => {
      cancelled = true
    }
    // Le menu est un instantané : ouvert une seule fois au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
