import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Filter, X, Loader2 } from 'lucide-react'
import { useNavStore } from '../state/useNavStore'
import { useAppearanceStore } from '../state/useAppearanceStore'
import { useGitStore } from '../state/useGitStore'
import type { DirEntry, GitFileChange } from '@shared/types'
import { useUiStore } from '../state/useUiStore'
import { useTerminalStore } from '../state/useTerminalStore'
import { pathKey } from '../lib/format'
import { copyOrMove } from '../lib/fileActions'
import { t, tn } from '../i18n'
import ContextMenu from './ContextMenu'
import BulkRenameDialog from './BulkRenameDialog'
import Row from './filelist/Row'
import GridTile from './filelist/GridTile'
import ColumnHeader from './filelist/ColumnHeader'
import StatusBar from './filelist/StatusBar'
import { useFileListKeyboard } from './filelist/useFileListKeyboard'
import { buildItemMenu, buildBackgroundMenu, buildDropMenu, type MenuCtx } from './filelist/menus'
import { baseSegment } from './filelist/helpers'
import { lassoIndices, normRect, type LassoRect } from './filelist/lasso'

/**
 * Liste de fichiers virtualisée (@tanstack/react-virtual) : seules les lignes
 * visibles sont montées → fluide sur des dossiers de milliers d'entrées.
 * L'affichage (lignes, en-tête, barre d'état), les menus contextuels et la
 * navigation clavier vivent dans `./filelist/*` ; ce composant orchestre l'état.
 */
const EMPTY_MAP: Record<string, GitFileChange> = {}
const EMPTY_SET = new Set<string>()
const EMPTY_LIST: string[] = []

export default function FileList(props: { paneId: string }): JSX.Element {
  const pane = useNavStore((s) => s.panes.find((p) => p.id === props.paneId))
  const activeId = useNavStore((s) => s.activeId)
  const setSort = useNavStore((s) => s.setSort)
  const navigate = useNavStore((s) => s.navigate)
  const setSelected = useNavStore((s) => s.setSelected)
  const setRenaming = useNavStore((s) => s.setRenaming)
  const showHidden = useNavStore((s) => s.showHidden)
  const hideGitIgnored = useNavStore((s) => s.hideGitIgnored)
  const viewMode = useNavStore((s) => s.viewMode)
  const gridSize = useNavStore((s) => s.gridSize)
  const density = useAppearanceStore((s) => s.appearance.density)
  const repo = useGitStore((s) => s.repo)
  const statusByPath = useGitStore((s) => s.statusByPath)
  const dirtyDirs = useGitStore((s) => s.dirtyDirs)
  const ignoredAll = useGitStore((s) => s.ignored)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: DirEntry | null } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dropMenu, setDropMenu] = useState<{ x: number; y: number; paths: string[]; destDir: string } | null>(
    null
  )
  const clipboard = useUiStore((s) => s.clipboard)
  const [filter, setFilter] = useState('')
  const [filterOn, setFilterOn] = useState(false)
  const [bulkPaths, setBulkPaths] = useState<string[] | null>(null)
  const [showLoader, setShowLoader] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<number | null>(null)
  const renameTimer = useRef<number | null>(null)
  const typeBuf = useRef({ s: '', t: 0 })
  const [lasso, setLasso] = useState<LassoRect | null>(null)
  const lassoRef = useRef<{
    startX: number
    startY: number
    additive: boolean
    base: string[]
    active: boolean
  } | null>(null)
  // Après un lasso, le clic de relâchement ne doit pas désélectionner.
  const suppressClickRef = useRef(false)

  const isActive = activeId === props.paneId
  const entries = pane?.entries ?? []
  const loading = pane?.loading ?? false
  const error = pane?.error ?? null
  const sortKey = pane?.sortKey ?? 'name'
  const sortDir = pane?.sortDir ?? 'asc'
  const path = pane?.path ?? ''
  const selected = pane?.selected ?? EMPTY_LIST
  const renaming = pane?.renaming ?? null
  const selectedSet = useMemo(() => new Set(selected), [selected])

  // Le store Git est global → on n'affiche les badges que dans le volet actif.
  const gitMap = isActive ? statusByPath : EMPTY_MAP
  const gitDirty = isActive ? dirtyDirs : EMPTY_SET
  const ignored = isActive ? ignoredAll : EMPTY_SET

  // Rafraîchit le statut Git du volet actif quand son dossier/contenu change.
  useEffect(() => {
    if (isActive && path) void useGitStore.getState().refresh(path)
  }, [isActive, path, entries])

  const rowHeight = density === 'compact' ? 26 : 34

  // Vue grille : taille de tuile réglable (persistée), colonnes selon la largeur.
  // Tuile ≈ vignette carrée pleine case + libellé sur 2 lignes (façon Explorer).
  const TILE_W = gridSize
  const TILE_H = gridSize + 18
  const [gridWidth, setGridWidth] = useState(0)
  useEffect(() => {
    const el = parentRef.current
    if (!el || viewMode !== 'grid') return
    const ro = new ResizeObserver((entries) => setGridWidth(entries[0]?.contentRect.width ?? 0))
    ro.observe(el)
    setGridWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [viewMode])
  const cols = viewMode === 'grid' ? Math.max(1, Math.floor((gridWidth - 8) / TILE_W)) : 1

  const visible = useMemo(() => {
    let v = showHidden ? entries : entries.filter((e) => !e.hidden)
    if (hideGitIgnored && ignored.size > 0) {
      v = v.filter((e) => !ignored.has(pathKey(e.path)))
    }
    const q = filterOn ? filter.trim().toLowerCase() : ''
    if (q) v = v.filter((e) => e.name.toLowerCase().includes(q))
    return v
  }, [entries, showHidden, hideGitIgnored, ignored, filter, filterOn])

  // Réinitialise le filtre en changeant de dossier.
  useEffect(() => {
    setFilter('')
    setFilterOn(false)
  }, [path])

  // Loader différé : n'apparaît que si le chargement dure (>180 ms) — évite tout
  // clignotement sur la navigation locale instantanée, visible sur le réseau lent.
  useEffect(() => {
    if (!loading) {
      setShowLoader(false)
      return
    }
    const t = window.setTimeout(() => setShowLoader(true), 180)
    return () => window.clearTimeout(t)
  }, [loading])

  // En grille, on virtualise par RANGÉE de `cols` tuiles (même virtualiseur).
  const rowVirtualizer = useVirtualizer({
    count: viewMode === 'grid' ? Math.ceil(visible.length / cols) : visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (viewMode === 'grid' ? TILE_H : rowHeight),
    overscan: 14
  })

  // Recalcule les positions quand la densité/le mode/la largeur/la taille changent.
  useEffect(() => rowVirtualizer.measure(), [rowHeight, viewMode, cols, gridSize, rowVirtualizer])

  // Défilement clavier : en grille, l'index d'élément se convertit en rangée.
  const scrollToIndex = (i: number): void => {
    rowVirtualizer.scrollToIndex(viewMode === 'grid' ? Math.floor(i / cols) : i, { align: 'auto' })
  }

  const clearRenameTimer = (): void => {
    if (renameTimer.current) {
      clearTimeout(renameTimer.current)
      renameTimer.current = null
    }
  }
  useEffect(() => clearRenameTimer, [])

  const onActivate = (entry: DirEntry): void => {
    clearRenameTimer() // un double-clic ouvre, il n'arme pas le renommage
    if (entry.kind === 'directory') navigate(entry.path)
    else void window.api.fs.open(entry.path)
  }

  useFileListKeyboard({
    isActive,
    visible,
    selected,
    renaming,
    scrollToIndex,
    cols,
    anchorRef,
    typeBuf,
    setSelected,
    setFilterOn,
    onActivate
  })

  // Sélection façon explorateur : clic simple = remplace ; Ctrl = bascule ;
  // Maj = plage depuis l'ancre. L'index est celui dans la liste visible.
  const onRowClick = (e: React.MouseEvent, entry: DirEntry, index: number): void => {
    clearRenameTimer()
    if (e.shiftKey && anchorRef.current !== null) {
      const [a, b] = [anchorRef.current, index].sort((x, y) => x - y)
      setSelected(visible.slice(a, b + 1).map((en) => en.path))
    } else if (e.ctrlKey || e.metaKey) {
      const next = selectedSet.has(entry.path)
        ? selected.filter((p) => p !== entry.path)
        : [...selected, entry.path]
      setSelected(next)
      anchorRef.current = index
    } else {
      // Reclic sur l'unique élément déjà sélectionné → renommage différé
      // (comme l'explorateur Windows ; le double-clic l'annule via onActivate).
      const wasSole = selected.length === 1 && selected[0] === entry.path
      setSelected([entry.path])
      anchorRef.current = index
      if (wasSole) {
        renameTimer.current = window.setTimeout(() => setRenaming(entry.path), 500)
      }
    }
  }

  // Ouvre un terminal intégré directement dans un dossier donné.
  const openTerminalHere = (dir: string): void => {
    useUiStore.getState().setTerminalOpen(true)
    void useTerminalStore.getState().openTab(undefined, dir)
  }

  // Rafraîchit statut Git + liste après une action (stage/discard/corbeille…).
  const refreshAfter = async (): Promise<void> => {
    await useGitStore.getState().refresh(path)
    useNavStore.getState().refresh()
  }

  const trashPaths = async (paths: string[]): Promise<void> => {
    const failed: string[] = []
    for (const p of paths) {
      try {
        await window.api.fs.trash(p)
      } catch {
        failed.push(p.split(/[\\/]/).pop() ?? p)
      }
    }
    if (failed.length) {
      const list = failed.slice(0, 3).join(', ') + (failed.length > 3 ? '…' : '')
      useUiStore
        .getState()
        .showToast(
          tn(failed.length, 'Corbeille : {n} échec — {list}', 'Corbeille : {n} échecs — {list}', { list })
        )
    }
    setSelected([])
    await refreshAfter()
  }

  // Renommage en place : valide via fs.rename, sélectionne le nouveau chemin.
  const commitRename = async (oldPath: string, newName: string): Promise<void> => {
    setRenaming(null)
    const trimmed = newName.trim()
    if (!trimmed || trimmed === baseSegment(oldPath)) return
    const res = await window.api.fs.rename(oldPath, trimmed)
    if (res.ok && res.path) {
      setSelected([res.path])
      await refreshAfter()
    }
  }

  // Création d'un fichier/dossier puis renommage immédiat (flux Windows).
  const createThen = async (
    fn: (dir: string, base: string) => Promise<{ ok: boolean; path?: string }>,
    base: string
  ): Promise<void> => {
    const res = await fn(path, base)
    if (res.ok && res.path) {
      // silentRefresh (et non refresh) pour ne pas réinitialiser le renommage
      // qu'on vient d'armer : le nouvel élément entre directement en édition.
      await useNavStore.getState().silentRefresh(props.paneId)
      setSelected([res.path])
      setRenaming(res.path)
    }
  }

  // Dépôt : drag interne (entre volets, chemins en données) ou externe (fichiers
  // de l'explorateur). Interne → déplacer par défaut ; externe → copier. Ctrl
  // force la copie, Maj force le déplacement.
  const doDrop = async (e: React.DragEvent, destDir: string): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const internal = e.dataTransfer.getData('application/x-gvue-paths')
    let paths: string[]
    let defaultMove: boolean
    if (internal) {
      paths = JSON.parse(internal) as string[]
      defaultMove = true
    } else {
      paths = Array.from(e.dataTransfer.files)
        .map((f) => window.api.fs.pathForFile(f))
        .filter(Boolean)
      defaultMove = false
    }
    if (paths.length === 0) return
    const move = e.ctrlKey ? false : e.shiftKey ? true : defaultMove
    // Gère les conflits (dialogue), le toast d'erreurs et le rafraîchissement.
    await copyOrMove(move ? 'move' : 'copy', paths, destDir)
    if (isActive) void useGitStore.getState().refresh(path)
  }

  // Glisser au clic droit : à la fin, on propose un menu (copier/déplacer ici).
  // Fonctionne entre volets via le dossier marqué « data-gvue-dir » sous le curseur.
  const onRowMouseDown = (e: React.MouseEvent, entry: DirEntry): void => {
    if (e.button !== 2) return
    const paths = selectedSet.has(entry.path) ? selected : [entry.path]
    const start = { x: e.clientX, y: e.clientY, moved: false }
    const move = (ev: MouseEvent): void => {
      if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 6) start.moved = true
    }
    const up = (ev: MouseEvent): void => {
      window.removeEventListener('mousemove', move, true)
      window.removeEventListener('mouseup', up, true)
      if (!start.moved) return // simple clic droit → menu contextuel normal
      // Bloque le menu contextuel qui suivrait ce relâchement.
      const blockCtx = (ce: Event): void => {
        ce.preventDefault()
        ce.stopPropagation()
      }
      window.addEventListener('contextmenu', blockCtx, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('contextmenu', blockCtx, true), 300)
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const target = el?.closest('[data-gvue-dir]') as HTMLElement | null
      const destDir = target?.dataset.gvueDir
      if (destDir) setDropMenu({ x: ev.clientX, y: ev.clientY, paths, destDir })
    }
    window.addEventListener('mousemove', move, true)
    window.addEventListener('mouseup', up, true)
  }

  // Contexte transmis aux constructeurs de menus (état + actions du volet).
  const menuCtx: MenuCtx = {
    path,
    visible,
    selected,
    selectedSet,
    clipboard,
    repo,
    statusByPath,
    onActivate,
    openTerminalHere,
    refreshAfter,
    createThen,
    setRenaming,
    setSelected,
    setBulkPaths,
    trashPaths
  }

  // Lasso : pression sur le fond (pas sur un élément) puis glisser → rectangle
  // de sélection. Fonctionne avec la virtualisation (calcul par géométrie).
  // Ctrl au départ = ajoute à la sélection existante.
  const onLassoMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0 || !path || renaming) return
    if ((e.target as HTMLElement).closest('[data-gvue-item]')) return
    const el = parentRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const additive = e.ctrlKey || e.metaKey
    lassoRef.current = {
      startX: e.clientX - r.left + el.scrollLeft,
      startY: e.clientY - r.top + el.scrollTop,
      additive,
      base: additive ? selected : [],
      active: false
    }

    const onMove = (ev: MouseEvent): void => {
      const st = lassoRef.current
      const box = parentRef.current
      if (!st || !box) return
      const rr = box.getBoundingClientRect()
      // Auto-défilement quand le curseur frôle les bords.
      if (ev.clientY < rr.top + 24) box.scrollTop -= 16
      else if (ev.clientY > rr.bottom - 24) box.scrollTop += 16
      const cx = ev.clientX - rr.left + box.scrollLeft
      const cy = ev.clientY - rr.top + box.scrollTop
      if (!st.active && Math.abs(cx - st.startX) + Math.abs(cy - st.startY) < 6) return
      st.active = true
      ev.preventDefault()
      const rect: LassoRect = { x1: st.startX, y1: st.startY, x2: cx, y2: cy }
      setLasso(rect)
      const idx = lassoIndices(rect, {
        mode: viewMode === 'grid' ? 'grid' : 'list',
        rowHeight: viewMode === 'grid' ? TILE_H : rowHeight,
        cols,
        colWidth: cols > 0 ? (gridWidth - 8) / cols : 0,
        padX: 4,
        count: visible.length
      })
      const picked = idx.map((i) => visible[i].path)
      setSelected(st.additive ? [...new Set([...st.base, ...picked])] : picked)
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('mouseup', onUp, true)
      if (lassoRef.current?.active) suppressClickRef.current = true
      lassoRef.current = null
      setLasso(null)
    }
    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mouseup', onUp, true)
  }

  // Taille cumulée de la sélection (barre d'état) — Map pour rester O(sélection).
  const entryByPath = useMemo(() => {
    const m = new Map<string, DirEntry>()
    for (const en of entries) m.set(en.path, en)
    return m
  }, [entries])
  const selInfo = useMemo(() => {
    let bytes = 0
    let dirs = 0
    for (const p of selected) {
      const en = entryByPath.get(p)
      if (!en) continue
      if (en.kind === 'directory') dirs++
      else bytes += en.size
    }
    return { bytes, dirs }
  }, [selected, entryByPath])

  // Ctrl+molette en vue grille : agrandit / réduit les tuiles (persisté).
  const onWheel = (e: React.WheelEvent): void => {
    if (viewMode !== 'grid' || !(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    useNavStore.getState().setGridSize(gridSize + (e.deltaY < 0 ? 12 : -12))
  }

  // Ouvre le menu du dossier courant (utile quand la liste est pleine : on peut
  // toujours faire clic droit sur l'en-tête ou la barre d'état).
  const openBackgroundMenu = (e: React.MouseEvent): void => {
    if (!path) return
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, entry: null })
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <div onContextMenu={openBackgroundMenu}>
        <ColumnHeader sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
      </div>

      {filterOn && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
          <Filter size={13} className="shrink-0 text-fg-muted" />
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setFilter('')
                setFilterOn(false)
              } else if (e.key === 'Enter' && visible.length) {
                onActivate(visible[0])
              }
            }}
            placeholder={t('Filtrer ce dossier…')}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-muted"
          />
          <span className="shrink-0 text-[11px] text-fg-muted tabular-nums">{visible.length}</span>
          <button
            onClick={() => {
              setFilter('')
              setFilterOn(false)
            }}
            title={t('Fermer le filtre (Échap)')}
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {error && (
        <div className="m-3 rounded-app border border-danger-fg bg-danger-bg p-3 text-[13px] text-danger-fg">
          {error}
        </div>
      )}

      <div
        ref={parentRef}
        data-gvue-dir={path || undefined}
        onWheel={onWheel}
        className={`relative flex-1 overflow-auto ${
          dragOver === '__pane__' && path ? 'ring-2 ring-inset ring-accent' : ''
        }`}
        onDragOver={(e) => {
          if (!path) return
          e.preventDefault()
          setDragOver('__pane__')
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) setDragOver(null)
        }}
        onDrop={(e) => void doDrop(e, path)}
        onMouseDown={onLassoMouseDown}
        onClick={(e) => {
          // Un lasso vient de se terminer : son relâchement ne désélectionne pas.
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          // Clic dans le vide (pas sur une ligne) → désélectionne.
          if (e.target === e.currentTarget) setSelected([])
        }}
        onContextMenu={(e) => {
          if (!path) return
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, entry: null })
        }}
      >
        {showLoader && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-app border border-border bg-bg-secondary px-3 py-1.5 text-[12px] text-fg-secondary shadow-lg">
              <Loader2 size={14} className="animate-spin text-accent" />
              {t('Chargement…')}
            </div>
          </div>
        )}
        {!loading && visible.length === 0 && !error && (
          <div className="p-8 text-center text-[13px] text-fg-muted">{t('Dossier vide')}</div>
        )}
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {lasso &&
            (() => {
              const nr = normRect(lasso)
              return (
                <div
                  className="pointer-events-none absolute z-10 rounded-[2px] border border-accent"
                  style={{
                    left: nr.left,
                    top: nr.top,
                    width: nr.right - nr.left,
                    height: nr.bottom - nr.top,
                    background: 'var(--accent-soft)'
                  }}
                />
              )
            })()}
          {viewMode === 'grid'
            ? rowVirtualizer.getVirtualItems().map((vi) => {
                const start = vi.index * cols
                return (
                  <div
                    key={vi.index}
                    className="absolute left-0 grid w-full px-1"
                    style={{
                      top: vi.start,
                      height: TILE_H,
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
                    }}
                  >
                    {visible.slice(start, start + cols).map((entry, j) => {
                      const index = start + j
                      const key = pathKey(entry.path)
                      const isDir = entry.kind === 'directory'
                      return (
                        <GridTile
                          key={entry.path}
                          entry={entry}
                          tileSize={gridSize}
                          selected={selectedSet.has(entry.path)}
                          renaming={renaming === entry.path}
                          git={gitMap[key]}
                          gitDir={isDir && gitDirty.has(key)}
                          dropActive={dragOver === entry.path}
                          onClick={(e) => onRowClick(e, entry, index)}
                          onActivate={() => onActivate(entry)}
                          onContext={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!selectedSet.has(entry.path)) setSelected([entry.path])
                            setMenu({ x: e.clientX, y: e.clientY, entry })
                          }}
                          onCommitRename={(name) => void commitRename(entry.path, name)}
                          onCancelRename={() => setRenaming(null)}
                          dropDir={isDir ? entry.path : undefined}
                          onDragStart={(e) => {
                            const sel = selectedSet.has(entry.path) ? selected : [entry.path]
                            e.dataTransfer.setData('application/x-gvue-paths', JSON.stringify(sel))
                            e.dataTransfer.effectAllowed = 'copyMove'
                          }}
                          onDirOver={
                            isDir
                              ? (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setDragOver(entry.path)
                                }
                              : undefined
                          }
                          onDirDrop={isDir ? (e) => void doDrop(e, entry.path) : undefined}
                        />
                      )
                    })}
                  </div>
                )
              })
            : rowVirtualizer.getVirtualItems().map((vi) => {
            const entry = visible[vi.index]
            const key = pathKey(entry.path)
            const isDir = entry.kind === 'directory'
            return (
              <Row
                key={entry.path}
                entry={entry}
                index={vi.index}
                height={rowHeight}
                selected={selectedSet.has(entry.path)}
                renaming={renaming === entry.path}
                top={vi.start}
                git={gitMap[key]}
                gitDir={isDir && gitDirty.has(key)}
                dropActive={dragOver === entry.path}
                onRowClick={(e) => onRowClick(e, entry, vi.index)}
                onActivate={() => onActivate(entry)}
                onCommitRename={(name) => void commitRename(entry.path, name)}
                onCancelRename={() => setRenaming(null)}
                dropDir={isDir ? entry.path : undefined}
                onDragStart={(e) => {
                  const sel = selectedSet.has(entry.path) ? selected : [entry.path]
                  e.dataTransfer.setData('application/x-gvue-paths', JSON.stringify(sel))
                  e.dataTransfer.effectAllowed = 'copyMove'
                }}
                onRightDragStart={(e) => onRowMouseDown(e, entry)}
                onDirOver={
                  isDir
                    ? (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragOver(entry.path)
                      }
                    : undefined
                }
                onDirDrop={isDir ? (e) => void doDrop(e, entry.path) : undefined}
                onContext={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!selectedSet.has(entry.path)) setSelected([entry.path])
                  setMenu({ x: e.clientX, y: e.clientY, entry })
                }}
              />
            )
          })}
        </div>
      </div>

      <div onContextMenu={openBackgroundMenu}>
        <StatusBar
          count={visible.length}
          total={entries.length}
          selectedCount={selected.length}
          selectedBytes={selInfo.bytes}
          selectedDirs={selInfo.dirs}
          showGit={isActive}
        />
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={menu.entry ? buildItemMenu(menu.entry, menuCtx) : buildBackgroundMenu(menuCtx)}
          onClose={() => setMenu(null)}
        />
      )}

      {dropMenu && (
        <ContextMenu
          x={dropMenu.x}
          y={dropMenu.y}
          entries={buildDropMenu(dropMenu.paths, dropMenu.destDir)}
          onClose={() => setDropMenu(null)}
        />
      )}

      {bulkPaths && (
        <BulkRenameDialog
          paths={bulkPaths}
          onClose={() => setBulkPaths(null)}
          onDone={() => void refreshAfter()}
        />
      )}
    </div>
  )
}
