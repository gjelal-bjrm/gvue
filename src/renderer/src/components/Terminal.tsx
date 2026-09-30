import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Copy, ClipboardPaste } from 'lucide-react'
import { acquire } from '../lib/terminalRegistry'
import { extractWindowsPath } from '../lib/pathText'
import { revealPath } from '../lib/revealPath'
import ContextMenu, { type MenuEntry } from './ContextMenu'
import { t } from '../i18n'

/**
 * Vue d'un terminal : monte (réattache) l'instance xterm persistante du
 * registre dans son conteneur et gère l'ajustement de taille. L'instance
 * survit au démontage du composant (réduction du panneau) → historique préservé.
 *
 * Clic droit : copier / coller, et « Aller sur ce chemin » quand le texte
 * sélectionné est un chemin Windows — le pendant, dans le terminal, du
 * « Ouvrir dans GVue » de l'Explorateur (demande utilisateur).
 */
export default function Terminal(props: {
  ptyId: string
  active: boolean
  shellId?: string
  cwd?: string
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const meta = props.shellId ? { shellId: props.shellId, cwd: props.cwd ?? '' } : undefined
    const entry = acquire(props.ptyId, meta)
    container.appendChild(entry.element)

    const refit = (): void => {
      // Ne JAMAIS ajuster un conteneur masqué (onglet inactif : taille 0) :
      // xterm calculerait ~0 colonne, redimensionnerait le pty en conséquence
      // et détruirait le scrollback du terminal caché (perte des logs) tout en
      // reformatant le programme en cours d'exécution.
      if (!container.clientWidth || !container.clientHeight) return
      try {
        entry.fit.fit()
        window.api.terminal.resize(props.ptyId, entry.term.cols, entry.term.rows)
      } catch {
        /* ignore */
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
      const el = containerRef.current
      if (!el || !el.clientWidth || !el.clientHeight) return
      try {
        entry.fit.fit()
        window.api.terminal.resize(props.ptyId, entry.term.cols, entry.term.rows)
        entry.term.focus()
      } catch {
        /* ignore */
      }
    })
  }, [props.active, props.ptyId])

  const onContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    const term = acquire(props.ptyId).term
    const selection = term.getSelection()
    const path = selection ? extractWindowsPath(selection) : null
    const entries: MenuEntry[] = []
    if (path) {
      entries.push({
        label: t('Aller sur ce chemin'),
        icon: <FolderOpen size={14} />,
        onClick: () => void revealPath(path)
      })
      entries.push({ type: 'sep' })
    }
    if (selection) {
      entries.push({
        label: t('Copier'),
        icon: <Copy size={14} />,
        onClick: () => void navigator.clipboard?.writeText(selection)
      })
    }
    entries.push({
      label: t('Coller'),
      icon: <ClipboardPaste size={14} />,
      onClick: () =>
        void navigator.clipboard?.readText().then((text) => {
          if (text) window.api.terminal.write(props.ptyId, text)
          term.focus()
        })
    })
    setMenu({ x: e.clientX, y: e.clientY, entries })
  }

  return (
    <>
      <div ref={containerRef} className="h-full w-full" onContextMenu={onContextMenu} />
      {menu && <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />}
    </>
  )
}
