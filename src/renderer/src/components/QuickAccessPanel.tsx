import { useCallback, useEffect, useState } from 'react'
import {
  Star,
  StarOff,
  FolderOpen,
  ExternalLink,
  Copy,
  Trash2,
  Code2,
  PenLine,
  AppWindow,
  FileArchive
} from 'lucide-react'
import { useNavStore } from '../state/useNavStore'
import { useFavoritesStore } from '../state/useFavoritesStore'
import { useAppsStore } from '../state/useAppsStore'
import { useOpenWithStore } from '../state/useOpenWithStore'
import type { DirEntry, QuickAccessData } from '@shared/types'
import { formatRelativeDate, formatDate, parentPath } from '../lib/format'
import { fileIconSpec } from '../lib/fileIcon'
import ContextMenu, { type MenuEntry } from './ContextMenu'

/**
 * Page « Accès rapide » (façon explorateur Windows) : dossiers fréquents et
 * fichiers récents. Clic = sélection, double-clic = ouvrir, clic droit = menu.
 */
export default function QuickAccessPanel(): JSX.Element {
  const navigate = useNavStore((s) => s.navigate)
  const [data, setData] = useState<QuickAccessData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: DirEntry } | null>(null)

  const load = useCallback((): void => {
    window.api.fs
      .quickAccess()
      .then(setData)
      .catch(() => setData({ frequent: [], recentFiles: [] }))
  }, [])

  useEffect(() => load(), [load])

  const activate = (entry: DirEntry): void => {
    if (entry.kind === 'directory') navigate(entry.path)
    else void window.api.fs.open(entry.path)
  }

  const extOf = (name: string): string => {
    const d = name.lastIndexOf('.')
    return d > 0 ? name.slice(d + 1).toLowerCase() : ''
  }

  const buildMenu = (entry: DirEntry): MenuEntry[] => {
    const apps = useAppsStore.getState().apps
    const isDir = entry.kind === 'directory'
    const items: MenuEntry[] = [
      { label: 'Ouvrir', icon: <FolderOpen size={14} />, onClick: () => activate(entry) },
      {
        label: "Ouvrir dans l'explorateur",
        icon: <ExternalLink size={14} />,
        onClick: () => void window.api.fs.reveal(entry.path)
      }
    ]

    const appItems: MenuEntry[] = []
    if (apps.vscode)
      appItems.push({
        label: 'Ouvrir avec VS Code',
        icon: <Code2 size={14} />,
        onClick: () => window.api.apps.openWith('vscode', [entry.path])
      })
    if (!isDir && apps.notepadpp)
      appItems.push({
        label: 'Éditer avec Notepad++',
        icon: <PenLine size={14} />,
        onClick: () => window.api.apps.openWith('notepadpp', [entry.path])
      })
    if (!isDir) {
      const ext = extOf(entry.name)
      for (const exe of useOpenWithStore.getState().get(ext)) {
        appItems.push({
          label: `Ouvrir avec ${(exe.split(/[\\/]/).pop() ?? exe).replace(/\.exe$/i, '')}`,
          icon: <AppWindow size={14} />,
          onClick: () => window.api.apps.openPathWith(exe, [entry.path])
        })
      }
      appItems.push({
        label: 'Ouvrir avec…',
        icon: <AppWindow size={14} />,
        onClick: async () => {
          const exe = await window.api.apps.pickProgram()
          if (!exe) return
          window.api.apps.openPathWith(exe, [entry.path])
          if (ext) useOpenWithStore.getState().add(ext, exe)
        }
      })
    }
    if (apps.sevenzip)
      appItems.push({
        label: 'Compresser en .zip (7-Zip)',
        icon: <FileArchive size={14} />,
        onClick: () => void window.api.apps.archive([entry.path])
      })
    if (appItems.length) items.push({ type: 'sep' }, ...appItems)

    items.push(
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
      }
    )

    if (isDir) {
      const fav = useFavoritesStore.getState()
      items.push({
        label: fav.has(entry.path) ? 'Retirer des favoris' : 'Ajouter aux favoris',
        icon: fav.has(entry.path) ? <StarOff size={14} /> : <Star size={14} />,
        onClick: () => useFavoritesStore.getState().toggle(entry.path)
      })
    }

    items.push(
      { type: 'sep' },
      {
        label: 'Supprimer (corbeille)',
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => void window.api.fs.trash(entry.path).then(load)
      }
    )
    return items
  }

  const onContext = (e: React.MouseEvent, entry: DirEntry): void => {
    e.preventDefault()
    setSelected(entry.path)
    setMenu({ x: e.clientX, y: e.clientY, entry })
  }

  const frequent = data?.frequent ?? []
  const recentFiles = data?.recentFiles ?? []
  const empty = data !== null && frequent.length === 0 && recentFiles.length === 0

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <Star size={15} className="text-accent" />
        <span className="text-[13px] font-medium text-fg">Accès rapide</span>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {empty && (
          <div className="p-8 text-center text-[13px] text-fg-muted">
            Naviguez dans des dossiers et ouvrez des fichiers pour peupler l’accès rapide.
          </div>
        )}

        {frequent.length > 0 && (
          <section className="mb-5">
            <GroupTitle>Dossiers fréquents ({frequent.length})</GroupTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-1.5">
              {frequent.map((e) => (
                <FolderCard
                  key={e.path}
                  entry={e}
                  selected={selected === e.path}
                  onSelect={() => setSelected(e.path)}
                  onActivate={() => activate(e)}
                  onContext={(ev) => onContext(ev, e)}
                />
              ))}
            </div>
          </section>
        )}

        {recentFiles.length > 0 && (
          <section>
            <GroupTitle>Fichiers récents ({recentFiles.length})</GroupTitle>
            <div className="flex flex-col">
              {recentFiles.map((e) => (
                <FileRow
                  key={e.path}
                  entry={e}
                  selected={selected === e.path}
                  onSelect={() => setSelected(e.path)}
                  onActivate={() => activate(e)}
                  onContext={(ev) => onContext(ev, e)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} entries={buildMenu(menu.entry)} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

function GroupTitle(props: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
      {props.children}
    </div>
  )
}

function FolderCard(props: {
  entry: DirEntry
  selected: boolean
  onSelect: () => void
  onActivate: () => void
  onContext: (e: React.MouseEvent) => void
}): JSX.Element {
  const { entry } = props
  return (
    <div
      className={`flex cursor-default items-center gap-2.5 rounded-app px-2.5 py-2 ${
        props.selected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
      }`}
      onClick={props.onSelect}
      onDoubleClick={props.onActivate}
      onContextMenu={props.onContext}
      title={entry.path}
    >
      <FolderOpen size={18} className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[13px] ${props.selected ? 'text-accent' : 'text-fg'}`}>
          {entry.name}
        </div>
        <div className="truncate text-[11px] text-fg-muted">{parentPath(entry.path)}</div>
      </div>
    </div>
  )
}

function FileRow(props: {
  entry: DirEntry
  selected: boolean
  onSelect: () => void
  onActivate: () => void
  onContext: (e: React.MouseEvent) => void
}): JSX.Element {
  const { entry } = props
  const { Icon, color } = fileIconSpec(entry)
  return (
    <div
      className={`flex h-8 cursor-default items-center gap-2.5 rounded-app px-2.5 ${
        props.selected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
      }`}
      onClick={props.onSelect}
      onDoubleClick={props.onActivate}
      onContextMenu={props.onContext}
      title={entry.path}
    >
      <Icon size={16} style={{ color }} className="shrink-0" />
      <span className={`shrink-0 truncate text-[13px] ${props.selected ? 'text-accent' : 'text-fg'}`}>
        {entry.name}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">{parentPath(entry.path)}</span>
      <span
        className="shrink-0 text-[11px] text-fg-muted tabular-nums"
        title={formatDate(entry.modifiedMs)}
      >
        {formatRelativeDate(entry.modifiedMs)}
      </span>
    </div>
  )
}
