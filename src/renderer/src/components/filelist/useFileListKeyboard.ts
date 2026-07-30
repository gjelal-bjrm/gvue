import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { DirEntry } from '@shared/types'
import { useNavStore } from '../../state/useNavStore'
import { useUiStore } from '../../state/useUiStore'

/**
 * Navigation clavier de la liste (volet actif) : flèches / Home / Fin / PgUp /
 * PgDn déplacent la sélection, Entrée ouvre, Retour arrière remonte, Ctrl+F
 * bascule le filtre, et taper-pour-sélectionner saute au 1er nom correspondant.
 * En vue grille (`cols` > 1), Haut/Bas sautent d'une rangée et Gauche/Droite
 * d'une tuile. Extrait du composant pour l'alléger.
 */
export function useFileListKeyboard(p: {
  isActive: boolean
  visible: DirEntry[]
  selected: string[]
  renaming: string | null
  /** Fait défiler jusqu'à l'index (dépend du mode liste/grille). */
  scrollToIndex: (index: number) => void
  /** Tuiles par rangée (1 = vue liste). */
  cols?: number
  anchorRef: MutableRefObject<number | null>
  typeBuf: MutableRefObject<{ s: string; t: number }>
  setSelected: (paths: string[]) => void
  setFilterOn: Dispatch<SetStateAction<boolean>>
  onActivate: (entry: DirEntry) => void
}): void {
  const {
    isActive,
    visible,
    selected,
    renaming,
    scrollToIndex,
    anchorRef,
    typeBuf,
    setSelected,
    setFilterOn,
    onActivate
  } = p
  const cols = Math.max(1, p.cols ?? 1)

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (renaming) return
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setFilterOn((o) => !o)
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return // laisse Ctrl+A/C/X/V à App
      const len = visible.length
      if (len === 0) return

      const cur = (() => {
        const last = selected[selected.length - 1]
        const i = last ? visible.findIndex((en) => en.path === last) : -1
        return i >= 0 ? i : 0
      })()
      const move = (idx: number): void => {
        const i = Math.max(0, Math.min(len - 1, idx))
        setSelected([visible[i].path])
        anchorRef.current = i
        scrollToIndex(i)
      }
      const page = cols > 1 ? cols * 4 : 12

      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); move(cur + cols); break
        case 'ArrowUp': e.preventDefault(); move(cur - cols); break
        case 'ArrowRight':
          if (cols > 1) { e.preventDefault(); move(cur + 1) }
          break
        case 'ArrowLeft':
          if (cols > 1) { e.preventDefault(); move(cur - 1) }
          break
        case 'Home': e.preventDefault(); move(0); break
        case 'End': e.preventDefault(); move(len - 1); break
        case 'PageDown': e.preventDefault(); move(cur + page); break
        case 'PageUp': e.preventDefault(); move(cur - page); break
        case 'Enter': {
          e.preventDefault()
          const en = visible[cur]
          if (en && selected.length) onActivate(en)
          break
        }
        case 'Backspace':
          e.preventDefault()
          useNavStore.getState().goParent()
          break
        case ' ':
          // Aperçu rapide façon Quick Look : Espace ouvre/ferme le panneau.
          e.preventDefault()
          useUiStore.getState().togglePreview()
          break
        default:
          if (e.key.length === 1 && e.key !== ' ') {
            const now = Date.now()
            const buf = typeBuf.current
            buf.s = (now - buf.t < 800 ? buf.s : '') + e.key.toLowerCase()
            buf.t = now
            const i = visible.findIndex((en) => en.name.toLowerCase().startsWith(buf.s))
            if (i >= 0) move(i)
          }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, visible, selected, renaming, scrollToIndex, cols])
}
