import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowUp,
  ArrowDown,
  FolderOpen,
  ExternalLink,
  Copy,
  Trash2,
  Plus,
  Minus,
  Undo2,
  Scissors,
  ClipboardCopy,
  ClipboardPaste,
  FolderPlus,
  FilePlus,
  RefreshCw,
  Link2,
  Pencil,
  Star,
  StarOff,
  Code2,
  PenLine,
  FileArchive,
  FileDown,
  AppWindow,
  FolderInput,
  TerminalSquare,
  X
} from 'lucide-react'
import { useNavStore, type SortKey } from '../state/useNavStore'
import { useAppearanceStore } from '../state/useAppearanceStore'
import { useGitStore } from '../state/useGitStore'
import type { DirEntry, GitCategory, GitFileChange } from '@shared/types'
import { useUiStore } from '../state/useUiStore'
import { useTerminalStore } from '../state/useTerminalStore'
import { formatSize, formatRelativeDate, formatDate, pathKey } from '../lib/format'
import { fileIconSpec } from '../lib/fileIcon'
import { useOsIcon } from '../lib/osIcons'
import { useFavoritesStore } from '../state/useFavoritesStore'
import { useAppsStore } from '../state/useAppsStore'
import { useOpenWithStore } from '../state/useOpenWithStore'
import { clipFiles, pasteInto } from '../lib/fileActions'
import GitWidget from './GitWidget'
import ContextMenu, { type MenuEntry } from './ContextMenu'

/** Lettre + couleur (variable de thème) associées à une catégorie Git. */
function gitBadge(category: GitCategory): { letter: string; color: string } {
  switch (category) {
    case 'untracked':
      return { letter: 'U', color: 'var(--success-fg)' }
    case 'added':
      return { letter: 'A', color: 'var(--success-fg)' }
    case 'deleted':
      return { letter: 'D', color: 'var(--danger-fg)' }
    case 'renamed':
      return { letter: 'R', color: 'var(--info-fg)' }
    case 'conflict':
      return { letter: '!', color: 'var(--danger-fg)' }
    case 'ignored':
      return { letter: '·', color: 'var(--fg-muted)' }
    default:
      return { letter: 'M', color: 'var(--warning-fg)' }
  }
}

/**
 * Liste de fichiers virtualisée (@tanstack/react-virtual) : seules les lignes
 * visibles sont montées → fluide sur des dossiers de milliers d'entrées.
 */
const EMPTY_MAP: Record<string, GitFileChange> = {}
const EMPTY_SET = new Set<string>()
const EMPTY_LIST: string[] = []

const ARCHIVE_EXT = new Set([
  'zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'cab', 'iso', 'wim', 'lzh', 'arj', 'zipx'
])
function extOf(name: string): string {
  const d = name.lastIndexOf('.')
  return d > 0 ? name.slice(d + 1).toLowerCase() : ''
}
/** Nom lisible d'un exécutable (basename sans « .exe »). */
function programName(exe: string): string {
  return (exe.split(/[\\/]/).pop() ?? exe).replace(/\.exe$/i, '')
}

export default function FileList(props: { paneId: string }): JSX.Element {
  const pane = useNavStore((s) => s.panes.find((p) => p.id === props.paneId))
  const activeId = useNavStore((s) => s.activeId)
  const setSort = useNavStore((s) => s.setSort)
  const navigate = useNavStore((s) => s.navigate)
  const setSelected = useNavStore((s) => s.setSelected)
  const setRenaming = useNavStore((s) => s.setRenaming)
  const showHidden = useNavStore((s) => s.showHidden)
  const hideGitIgnored = useNavStore((s) => s.hideGitIgnored)
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
  const parentRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<number | null>(null)
  const renameTimer = useRef<number | null>(null)
  const typeBuf = useRef({ s: '', t: 0 })

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

  const visible = useMemo(() => {
    let v = showHidden ? entries : entries.filter((e) => !e.hidden)
    if (hideGitIgnored && ignored.size > 0) {
      v = v.filter((e) => !ignored.has(pathKey(e.path)))
    }
    return v
  }, [entries, showHidden, hideGitIgnored, ignored])

  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 14
  })

  // Recalcule les positions quand la densité (donc la hauteur de ligne) change.
  useEffect(() => rowVirtualizer.measure(), [rowHeight, rowVirtualizer])

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

  // Navigation clavier (volet actif) : flèches/Home/Fin/PgUp/PgDn pour déplacer
  // la sélection, Entrée pour ouvrir, Retour arrière pour remonter, et
  // taper-pour-sélectionner (saute au 1er fichier dont le nom commence ainsi).
  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (renaming) return
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
        rowVirtualizer.scrollToIndex(i, { align: 'auto' })
      }

      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); move(cur + 1); break
        case 'ArrowUp': e.preventDefault(); move(cur - 1); break
        case 'Home': e.preventDefault(); move(0); break
        case 'End': e.preventDefault(); move(len - 1); break
        case 'PageDown': e.preventDefault(); move(cur + 12); break
        case 'PageUp': e.preventDefault(); move(cur - 12); break
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
  }, [isActive, visible, selected, renaming, rowVirtualizer])

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
    for (const p of paths) {
      try {
        await window.api.fs.trash(p)
      } catch {
        /* annulé ou échec sur cet élément */
      }
    }
    setSelected([])
    await refreshAfter()
  }

  // Renommage en place : valide via fs.rename, sélectionne le nouveau chemin.
  const commitRename = async (oldPath: string, newName: string): Promise<void> => {
    setRenaming(null)
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldPath.split(/[\\/]/).pop()) return
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
    await (move ? window.api.fs.move : window.api.fs.copy)(paths, destDir)
    useNavStore.getState().refreshAll()
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

  const buildDropMenu = (paths: string[], destDir: string): MenuEntry[] => {
    const n = paths.length
    const apps = useAppsStore.getState().apps
    const refreshAll = (): void => useNavStore.getState().refreshAll()
    const run = (op: 'copy' | 'move'): void => {
      void window.api.fs[op](paths, destDir).then(refreshAll)
    }
    const archives = paths.filter((p) => ARCHIVE_EXT.has(extOf(p.split(/[\\/]/).pop() ?? p)))

    const items: MenuEntry[] = [
      {
        label: n > 1 ? `Copier ici (${n})` : 'Copier ici',
        icon: <ClipboardCopy size={14} />,
        onClick: () => run('copy')
      },
      {
        label: n > 1 ? `Déplacer ici (${n})` : 'Déplacer ici',
        icon: <FolderInput size={14} />,
        onClick: () => run('move')
      },
      {
        label: n > 1 ? `Créer ${n} raccourcis ici` : 'Créer un raccourci ici',
        icon: <Link2 size={14} />,
        onClick: () =>
          void Promise.all(paths.map((p) => window.api.fs.createShortcut(p, destDir))).then(refreshAll)
      }
    ]

    if (apps.sevenzip) {
      items.push({
        label: 'Compresser ici (.zip)',
        icon: <FileArchive size={14} />,
        onClick: () => void window.api.apps.archive(paths, destDir)
      })
      if (archives.length > 0) {
        items.push({
          label: archives.length > 1 ? `Extraire ici (${archives.length})` : 'Extraire ici',
          icon: <FileDown size={14} />,
          onClick: () => archives.forEach((a) => void window.api.apps.extract(a, destDir))
        })
      }
    }

    items.push({ type: 'sep' }, { label: 'Annuler', icon: <X size={14} />, onClick: () => {} })
    return items
  }

  // Menu de la zone vide (clic droit hors d'un élément) : créer / coller / actualiser.
  const backgroundMenu = (): MenuEntry[] => [
    ...(useAppsStore.getState().apps.vscode
      ? [
          {
            label: 'Ouvrir avec VS Code',
            icon: <Code2 size={14} />,
            onClick: () => window.api.apps.openWith('vscode', [path])
          } as MenuEntry,
          { type: 'sep' } as MenuEntry
        ]
      : []),
    {
      label: 'Nouveau dossier',
      icon: <FolderPlus size={14} />,
      onClick: () => void createThen(window.api.fs.createDir, 'Nouveau dossier')
    },
    {
      label: 'Nouveau fichier',
      icon: <FilePlus size={14} />,
      onClick: () => void createThen(window.api.fs.createFile, 'Nouveau fichier.txt')
    },
    { type: 'sep' },
    {
      label: 'Coller',
      icon: <ClipboardPaste size={14} />,
      disabled: !clipboard,
      onClick: () => void pasteInto(path)
    },
    { type: 'sep' },
    {
      label: useFavoritesStore.getState().has(path) ? 'Retirer des favoris' : 'Ajouter aux favoris',
      icon: useFavoritesStore.getState().has(path) ? <StarOff size={14} /> : <Star size={14} />,
      onClick: () => useFavoritesStore.getState().toggle(path)
    },
    { label: 'Actualiser', icon: <RefreshCw size={14} />, onClick: () => useNavStore.getState().refresh() },
    {
      label: 'Ouvrir un terminal ici',
      icon: <TerminalSquare size={14} />,
      onClick: () => openTerminalHere(path)
    },
    {
      label: "Ouvrir dans l'explorateur",
      icon: <ExternalLink size={14} />,
      onClick: () => void window.api.fs.reveal(path)
    }
  ]

  const buildMenu = (entry: DirEntry): MenuEntry[] => {
    const git = statusByPath[pathKey(entry.path)]
    const apps = useAppsStore.getState().apps
    // Cible des opérations groupées : la sélection si l'élément en fait partie.
    const targets = selectedSet.has(entry.path) && selected.length > 1 ? selected : [entry.path]
    const n = targets.length

    // Intégrations d'applications externes (affichées seulement si installées).
    const appEntries: MenuEntry[] = []
    if (apps.vscode)
      appEntries.push({
        label: 'Ouvrir avec VS Code',
        icon: <Code2 size={14} />,
        onClick: () => window.api.apps.openWith('vscode', targets)
      })
    if (apps.notepadpp && entry.kind === 'file')
      appEntries.push({
        label: 'Éditer avec Notepad++',
        icon: <PenLine size={14} />,
        onClick: () => window.api.apps.openWith('notepadpp', targets)
      })
    // « Ouvrir avec » : programmes mémorisés pour ce type + sélecteur.
    if (entry.kind === 'file') {
      const ext = extOf(entry.name)
      for (const exe of useOpenWithStore.getState().get(ext)) {
        appEntries.push({
          label: `Ouvrir avec ${programName(exe)}`,
          icon: <AppWindow size={14} />,
          onClick: () => window.api.apps.openPathWith(exe, targets)
        })
      }
      appEntries.push({
        label: 'Ouvrir avec…',
        icon: <AppWindow size={14} />,
        onClick: async () => {
          const exe = await window.api.apps.pickProgram()
          if (!exe) return
          window.api.apps.openPathWith(exe, targets)
          if (ext) useOpenWithStore.getState().add(ext, exe)
        }
      })
    }
    if (apps.sevenzip) {
      appEntries.push({
        label: n > 1 ? `Compresser (${n}) en .zip` : 'Compresser en .zip (7-Zip)',
        icon: <FileArchive size={14} />,
        onClick: () => void window.api.apps.archive(targets)
      })
      if (entry.kind === 'file' && ARCHIVE_EXT.has(extOf(entry.name)))
        appEntries.push({
          label: 'Extraire (7-Zip)',
          icon: <FileDown size={14} />,
          onClick: () => void window.api.apps.extract(entry.path)
        })
    }

    const entries: MenuEntry[] = [
      { label: 'Ouvrir', icon: <FolderOpen size={14} />, onClick: () => onActivate(entry) },
      {
        label: "Ouvrir dans l'explorateur",
        icon: <ExternalLink size={14} />,
        onClick: () => void window.api.fs.reveal(entry.path)
      },
      ...(entry.kind === 'directory'
        ? [
            {
              label: 'Ouvrir un terminal ici',
              icon: <TerminalSquare size={14} />,
              onClick: () => openTerminalHere(entry.path)
            } as MenuEntry
          ]
        : []),
      {
        label: 'Créer un raccourci',
        icon: <Link2 size={14} />,
        onClick: () => void window.api.fs.createShortcut(entry.path).then(refreshAfter)
      },
      ...(appEntries.length ? [{ type: 'sep' } as MenuEntry, ...appEntries] : []),
      { type: 'sep' },
      {
        label: 'Copier le chemin',
        icon: <Copy size={14} />,
        onClick: () => void navigator.clipboard.writeText(entry.path)
      },
      {
        label: 'Copier le nom',
        icon: <Copy size={14} />,
        onClick: () => void navigator.clipboard.writeText(entry.name)
      },
      { type: 'sep' },
      {
        label: n > 1 ? `Couper (${n})` : 'Couper',
        icon: <Scissors size={14} />,
        onClick: () => clipFiles(targets, 'cut')
      },
      {
        label: n > 1 ? `Copier (${n})` : 'Copier',
        icon: <ClipboardCopy size={14} />,
        onClick: () => clipFiles(targets, 'copy')
      },
      ...(entry.kind === 'directory'
        ? [
            {
              label: 'Coller dans le dossier',
              icon: <ClipboardPaste size={14} />,
              disabled: !clipboard,
              onClick: () => void pasteInto(entry.path)
            } as MenuEntry
          ]
        : []),
      {
        label: 'Renommer',
        icon: <Pencil size={14} />,
        onClick: () => {
          setSelected([entry.path])
          setRenaming(entry.path)
        }
      },
      ...(entry.kind === 'directory'
        ? [
            {
              label: useFavoritesStore.getState().has(entry.path)
                ? 'Retirer des favoris'
                : 'Ajouter aux favoris',
              icon: useFavoritesStore.getState().has(entry.path) ? (
                <StarOff size={14} />
              ) : (
                <Star size={14} />
              ),
              onClick: () => useFavoritesStore.getState().toggle(entry.path)
            } as MenuEntry
          ]
        : [])
    ]

    if (repo && git && git.category !== 'ignored') {
      entries.push({ type: 'sep' })
      entries.push({
        label: 'Indexer',
        icon: <Plus size={14} />,
        onClick: () => void window.api.git.stage(path, entry.path).then(refreshAfter)
      })
      entries.push({
        label: 'Désindexer',
        icon: <Minus size={14} />,
        disabled: !git.staged,
        onClick: () => void window.api.git.unstage(path, entry.path).then(refreshAfter)
      })
      if (git.category !== 'untracked') {
        entries.push({
          label: 'Annuler les modifications',
          icon: <Undo2 size={14} />,
          danger: true,
          onClick: () => {
            if (window.confirm(`Annuler les modifications de « ${entry.name} » ? Action irréversible.`)) {
              void window.api.git.discard(path, entry.path).then(refreshAfter)
            }
          }
        })
      }
    }

    entries.push({ type: 'sep' })
    entries.push({
      label: n > 1 ? `Supprimer (${n}) → corbeille` : 'Supprimer (corbeille)',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: () => void trashPaths(targets)
    })
    return entries
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ColumnHeader sortKey={sortKey} sortDir={sortDir} onSort={setSort} />

      {error && (
        <div className="m-3 rounded-app border border-danger-fg bg-danger-bg p-3 text-[13px] text-danger-fg">
          {error}
        </div>
      )}

      <div
        ref={parentRef}
        data-gvue-dir={path || undefined}
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
        onClick={(e) => {
          // Clic dans le vide (pas sur une ligne) → désélectionne.
          if (e.target === e.currentTarget) setSelected([])
        }}
        onContextMenu={(e) => {
          if (!path) return
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, entry: null })
        }}
      >
        {!loading && visible.length === 0 && !error && (
          <div className="p-8 text-center text-[13px] text-fg-muted">Dossier vide</div>
        )}
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vi) => {
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

      <StatusBar
        count={visible.length}
        total={entries.length}
        selectedCount={selected.length}
        showGit={isActive}
      />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={menu.entry ? buildMenu(menu.entry) : backgroundMenu()}
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
    </div>
  )
}

function ColumnHeader(props: {
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}): JSX.Element {
  const Arrow = ({ k }: { k: SortKey }): JSX.Element | null => {
    if (props.sortKey !== k) return null
    return props.sortDir === 'asc' ? (
      <ArrowUp size={12} className="ml-1 inline" />
    ) : (
      <ArrowDown size={12} className="ml-1 inline" />
    )
  }
  return (
    <div className="flex shrink-0 items-center border-b border-border px-3 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
      <button className="flex-1 px-2 py-2 text-left hover:text-fg-secondary" onClick={() => props.onSort('name')}>
        Nom <Arrow k="name" />
      </button>
      <span className="w-6 shrink-0" />
      <button className="w-24 px-2 py-2 text-right hover:text-fg-secondary" onClick={() => props.onSort('size')}>
        Taille <Arrow k="size" />
      </button>
      <button className="w-32 px-2 py-2 text-right hover:text-fg-secondary" onClick={() => props.onSort('modifiedMs')}>
        Modifié <Arrow k="modifiedMs" />
      </button>
    </div>
  )
}

function Row(props: {
  entry: DirEntry
  index: number
  height: number
  selected: boolean
  renaming: boolean
  top: number
  git?: GitFileChange
  gitDir?: boolean
  dropActive?: boolean
  onRowClick: (e: React.MouseEvent) => void
  onActivate: () => void
  onContext: (e: React.MouseEvent) => void
  onCommitRename: (name: string) => void
  onCancelRename: () => void
  dropDir?: string
  onDragStart: (e: React.DragEvent) => void
  onRightDragStart: (e: React.MouseEvent) => void
  onDirOver?: (e: React.DragEvent) => void
  onDirDrop?: (e: React.DragEvent) => void
}): JSX.Element {
  const { entry, git } = props
  const { Icon, color } = fileIconSpec(entry)
  const osIcon = useOsIcon(entry)
  const badge = git ? gitBadge(git.category) : null
  // Teinte le nom selon le statut Git (fichier suivi modifié, non suivi, conflit…).
  const nameColor = props.selected
    ? 'text-accent'
    : badge && git?.category !== 'ignored'
      ? ''
      : 'text-fg'
  return (
    <div
      className={`absolute left-0 flex w-full cursor-default items-center px-3 ${
        props.dropActive
          ? 'bg-accent-soft ring-1 ring-inset ring-accent'
          : props.selected
            ? 'bg-accent-soft'
            : 'hover:bg-bg-hover'
      } ${entry.hidden ? 'opacity-55' : ''}`}
      style={{ top: props.top, height: props.height }}
      data-gvue-dir={props.dropDir}
      draggable={!props.renaming}
      onDragStart={props.onDragStart}
      onMouseDown={props.onRightDragStart}
      onDragOver={props.onDirOver}
      onDrop={props.onDirDrop}
      onClick={props.onRowClick}
      onDoubleClick={props.onActivate}
      onContextMenu={props.onContext}
      title={git ? `${entry.path} · ${git.category}${git.staged ? ' (indexé)' : ''}` : entry.path}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
        <span className="relative grid h-4 w-4 shrink-0 place-items-center">
          {osIcon ? (
            <img src={osIcon} alt="" className="max-h-4 max-w-4 object-contain" draggable={false} />
          ) : (
            <Icon size={16} style={{ color }} />
          )}
          {props.gitDir && !badge && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--warning-fg)' }}
            />
          )}
        </span>
        {props.renaming ? (
          <RenameInput
            initial={entry.name}
            onCommit={props.onCommitRename}
            onCancel={props.onCancelRename}
          />
        ) : (
          <span
            className={`truncate ${nameColor}`}
            style={badge && !props.selected ? { color: badge.color } : undefined}
          >
            {entry.name}
          </span>
        )}
        {!props.renaming && entry.symlink && <span className="text-[11px] text-fg-muted">↗</span>}
        {!props.renaming && entry.hidden && (
          <span className="ml-1 text-[11px] text-fg-muted">masqué</span>
        )}
      </div>
      <div className="w-6 shrink-0 text-center text-[12px] font-semibold tabular-nums">
        {badge && (
          <span style={{ color: badge.color }} title={git?.category}>
            {badge.letter}
          </span>
        )}
      </div>
      <div className="w-24 px-2 text-right text-[12px] text-fg-muted tabular-nums">
        {formatSize(entry.size, entry.kind)}
      </div>
      <div
        className="w-32 px-2 text-right text-[12px] text-fg-muted tabular-nums"
        title={formatDate(entry.modifiedMs)}
      >
        {formatRelativeDate(entry.modifiedMs)}
      </div>
    </div>
  )
}

function StatusBar(props: {
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

function RenameInput(props: {
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
    // Sélectionne le nom sans l'extension (comme l'explorateur Windows).
    const dot = props.initial.lastIndexOf('.')
    if (dot > 0) el.setSelectionRange(0, dot)
    else el.select()
  }, [props.initial])

  // Garantit une seule issue (valider OU annuler) malgré le blur au démontage.
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
