import {
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
  PieChart,
  X
} from 'lucide-react'
import type { DirEntry, GitFileChange } from '@shared/types'
import type { GitRepo } from '../../state/useGitStore'
import { useNavStore } from '../../state/useNavStore'
import { useUiStore, type FileClipboard } from '../../state/useUiStore'
import { useAppsStore } from '../../state/useAppsStore'
import { useFavoritesStore } from '../../state/useFavoritesStore'
import { useOpenWithStore } from '../../state/useOpenWithStore'
import { clipFiles, pasteInto } from '../../lib/fileActions'
import { pathKey } from '../../lib/format'
import type { MenuEntry } from '../ContextMenu'
import { ARCHIVE_EXT, extOf, programName, baseSegment } from './helpers'

/**
 * Contexte fourni par le composant FileList aux constructeurs de menus :
 * l'état du volet (chemin, sélection, presse-papiers, Git) et les actions
 * (activer, renommer, corbeille…). Centralise la logique des menus contextuels
 * hors du composant pour le garder lisible.
 */
export interface MenuCtx {
  path: string
  selected: string[]
  selectedSet: Set<string>
  clipboard: FileClipboard | null
  repo: GitRepo | null
  statusByPath: Record<string, GitFileChange>
  onActivate: (entry: DirEntry) => void
  openTerminalHere: (dir: string) => void
  refreshAfter: () => Promise<void>
  createThen: (
    fn: (dir: string, base: string) => Promise<{ ok: boolean; path?: string }>,
    base: string
  ) => Promise<void>
  setRenaming: (p: string | null) => void
  setSelected: (paths: string[]) => void
  setBulkPaths: (paths: string[] | null) => void
  trashPaths: (paths: string[]) => Promise<void>
}

/** Menu proposé à la fin d'un glisser au clic droit (copier/déplacer ici…). */
export function buildDropMenu(paths: string[], destDir: string): MenuEntry[] {
  const n = paths.length
  const apps = useAppsStore.getState().apps
  const refreshAll = (): void => useNavStore.getState().refreshAll()
  const run = (op: 'copy' | 'move'): void => {
    void window.api.fs[op](paths, destDir).then(refreshAll)
  }
  const archives = paths.filter((p) => ARCHIVE_EXT.has(extOf(baseSegment(p))))

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

/** Menu de la zone vide (clic droit hors d'un élément) : créer / coller / actualiser. */
export function buildBackgroundMenu(ctx: MenuCtx): MenuEntry[] {
  const { path, clipboard } = ctx
  return [
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
      onClick: () => void ctx.createThen(window.api.fs.createDir, 'Nouveau dossier')
    },
    {
      label: 'Nouveau fichier',
      icon: <FilePlus size={14} />,
      onClick: () => void ctx.createThen(window.api.fs.createFile, 'Nouveau fichier.txt')
    },
    {
      label: 'Créer des dossiers… (en lot)',
      icon: <FolderPlus size={14} />,
      onClick: () => useUiStore.getState().setFolderCreator(true)
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
      onClick: () => ctx.openTerminalHere(path)
    },
    {
      label: "Ouvrir dans l'explorateur",
      icon: <ExternalLink size={14} />,
      onClick: () => void window.api.fs.reveal(path)
    }
  ]
}

/** Menu contextuel d'un élément (fichier/dossier), sélection multiple incluse. */
export function buildItemMenu(entry: DirEntry, ctx: MenuCtx): MenuEntry[] {
  const { path, selected, selectedSet, clipboard, repo, statusByPath } = ctx
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
    { label: 'Ouvrir', icon: <FolderOpen size={14} />, onClick: () => ctx.onActivate(entry) },
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
            onClick: () => ctx.openTerminalHere(entry.path)
          } as MenuEntry,
          {
            label: "Analyser l'espace disque",
            icon: <PieChart size={14} />,
            onClick: () => useUiStore.getState().setDiskUsage(entry.path)
          } as MenuEntry,
          {
            label: 'Créer des dossiers… (en lot)',
            icon: <FolderPlus size={14} />,
            onClick: () => useUiStore.getState().setFolderCreator(true, entry.path)
          } as MenuEntry
        ]
      : []),
    {
      label: 'Créer un raccourci',
      icon: <Link2 size={14} />,
      onClick: () => void window.api.fs.createShortcut(entry.path).then(ctx.refreshAfter)
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
    n > 1
      ? {
          label: `Renommer en masse (${n})…`,
          icon: <Pencil size={14} />,
          onClick: () => ctx.setBulkPaths(targets)
        }
      : { label: 'Renommer', icon: <Pencil size={14} />, onClick: () => ctx.setRenaming(entry.path) },
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
        ctx.setSelected([entry.path])
        ctx.setRenaming(entry.path)
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
      onClick: () => void window.api.git.stage(path, entry.path).then(ctx.refreshAfter)
    })
    entries.push({
      label: 'Désindexer',
      icon: <Minus size={14} />,
      disabled: !git.staged,
      onClick: () => void window.api.git.unstage(path, entry.path).then(ctx.refreshAfter)
    })
    if (git.category !== 'untracked') {
      entries.push({
        label: 'Annuler les modifications',
        icon: <Undo2 size={14} />,
        danger: true,
        onClick: () => {
          if (window.confirm(`Annuler les modifications de « ${entry.name} » ? Action irréversible.`)) {
            void window.api.git.discard(path, entry.path).then(ctx.refreshAfter)
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
    onClick: () => void ctx.trashPaths(targets)
  })
  return entries
}
