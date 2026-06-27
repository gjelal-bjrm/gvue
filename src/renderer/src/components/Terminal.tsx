import { useEffect, useRef } from 'react'
import { acquire } from '../lib/terminalRegistry'

/**
 * Vue d'un terminal : monte (réattache) l'instance xterm persistante du
 * registre dans son conteneur et gère l'ajustement de taille. L'instance
 * survit au démontage du composant (réduction du panneau) → historique préservé.
 */
export default function Terminal(props: {
  ptyId: string
  active: boolean
  shellId?: string
  cwd?: string
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const meta = props.shellId ? { shellId: props.shellId, cwd: props.cwd ?? '' } : undefined
    const entry = acquire(props.ptyId, meta)
    container.appendChild(entry.element)

    const refit = (): void => {
      try {
        entry.fit.fit()
        window.api.terminal.resize(props.ptyId, entry.term.cols, entry.term.rows)
      } catch {
        /* conteneur masqué */
      }
    }
    refit()

    const ro = new ResizeObserver(refit)
    ro.observe(container)

    return () => {
      ro.disconnect()
      if (entry.element.parentNode === container) container.removeChild(entry.element)
    }
  }, [props.ptyId])

  // Réajuste et focalise quand l'onglet (re)devient visible.
  useEffect(() => {
    if (!props.active) return
    const entry = acquire(props.ptyId)
    requestAnimationFrame(() => {
      try {
        entry.fit.fit()
        window.api.terminal.resize(props.ptyId, entry.term.cols, entry.term.rows)
        entry.term.focus()
      } catch {
        /* ignore */
      }
    })
  }, [props.active, props.ptyId])

  return <div ref={containerRef} className="h-full w-full" />
}
