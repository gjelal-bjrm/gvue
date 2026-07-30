import { useEffect, useRef, useState } from 'react'
import { Layers, X, ClipboardPaste, FolderInput, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useShelfStore } from '../state/useShelfStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'
import { copyOrMove } from '../lib/fileActions'
import { baseName } from '../lib/format'

/**
 * Étagère flottante (coin bas-droit de la zone de fichiers) : panier où l'on
 * dépose des fichiers au fil de la navigation, pour tout coller/déplacer d'un
 * coup à destination. Visible uniquement si elle contient des éléments — ou
 * pendant un glisser-déposer, pour servir de cible de dépôt.
 */
export default function Shelf(): JSX.Element | null {
  const enabled = useShelfStore((s) => s.enabled)
  const items = useShelfStore((s) => s.items)
  const destDir = useNavStore((s) => activePane(s).path)
  const [collapsed, setCollapsed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState(false)
  const dragTimer = useRef<number | null>(null)

  // Détecte un glisser en cours (interne ou fichiers externes) pour faire
  // apparaître l'étagère comme cible, même vide.
  useEffect(() => {
    if (!enabled) return
    const onDragOver = (e: DragEvent): void => {
      const types = e.dataTransfer?.types
      if (!types || (!types.includes('application/x-gvue-paths') && !types.includes('Files'))) return
      setDragging(true)
      if (dragTimer.current) window.clearTimeout(dragTimer.current)
      dragTimer.current = window.setTimeout(() => setDragging(false), 400)
    }
    window.addEventListener('dragover', onDragOver)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      if (dragTimer.current) window.clearTimeout(dragTimer.current)
    }
  }, [enabled])

  if (!enabled || (items.length === 0 && !dragging)) return null

  const pasteAll = async (move: boolean): Promise<void> => {
    if (!destDir || items.length === 0) return
    const res = await copyOrMove(move ? 'move' : 'copy', items, destDir)
    if (res && res.ok > 0) {
      if (move) useShelfStore.getState().clear()
      useUiStore
        .getState()
        .showToast(`Étagère : ${res.ok} élément${res.ok > 1 ? 's' : ''} ${move ? 'déplacé' : 'collé'}${res.ok > 1 ? 's' : ''}.`)
    }
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setOver(false)
    const internal = e.dataTransfer.getData('application/x-gvue-paths')
    const paths = internal
      ? (JSON.parse(internal) as string[])
      : Array.from(e.dataTransfer.files)
          .map((f) => window.api.fs.pathForFile(f))
          .filter(Boolean)
    if (paths.length) useShelfStore.getState().add(paths)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`absolute bottom-10 right-4 z-30 w-64 rounded-app border bg-bg-secondary shadow-lg ${
        over ? 'border-accent ring-2 ring-accent' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
        <Layers size={14} className="shrink-0 text-accent" />
        <span className="text-[12px] font-medium text-fg">Étagère</span>
        {items.length > 0 && (
          <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-medium leading-[16px] text-accent">
            {items.length}
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Déplier' : 'Replier'}
          className="ml-auto grid h-5 w-5 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button
          onClick={() => useShelfStore.getState().clear()}
          title="Vider l'étagère"
          className="grid h-5 w-5 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {!collapsed && (
        <>
          {items.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-[11px] text-fg-muted">
              Déposez des fichiers ici pour les rassembler.
            </p>
          ) : (
            <div className="max-h-48 overflow-auto p-1">
              {items.map((p) => (
                <div
                  key={p}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-gvue-paths', JSON.stringify([p]))
                    e.dataTransfer.effectAllowed = 'copyMove'
                  }}
                  title={p}
                  className="group flex items-center gap-1.5 rounded-app px-1.5 py-1 hover:bg-bg-hover"
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] text-fg-secondary">
                    {baseName(p)}
                  </span>
                  <button
                    onClick={() => useShelfStore.getState().remove(p)}
                    title="Retirer de l'étagère"
                    className="grid h-4 w-4 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="flex gap-1 border-t border-border p-1.5">
              <button
                onClick={() => void pasteAll(false)}
                title="Copier tout le contenu de l'étagère dans le dossier affiché"
                className="flex flex-1 items-center justify-center gap-1 rounded-app bg-accent px-1.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
              >
                <ClipboardPaste size={12} /> Tout coller ici
              </button>
              <button
                onClick={() => void pasteAll(true)}
                title="Déplacer tout le contenu de l'étagère dans le dossier affiché (vide l'étagère)"
                className="flex flex-1 items-center justify-center gap-1 rounded-app border border-border px-1.5 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover"
              >
                <FolderInput size={12} /> Déplacer
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
