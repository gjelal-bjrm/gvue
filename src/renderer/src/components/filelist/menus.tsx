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
  History,
  Info,
  ListChecks,
  Layers,
  X
} from 'lucide-react'
import type { DirEntry, GitFileChange } from '@shared/types'
import type { GitRepo } from '../../state/useGitStore'
import { useNavStore } from '../../state/useNavStore'
import { useUiStore, type FileClipboard } from '../../state/useUiStore'
import { useAppsStore } from '../../state/useAppsStore'
import { useFavoritesStore } from '../../state/useFavoritesStore'
import { useOpenWithStore } from '../../state/useOpenWithStore'
import { clipFiles, pasteInto, copyOrMove } from '../../lib/fileActions'
import { useCustomCommandsStore } from '../../state/useCustomCommandsStore'
import { useShelfStore } from '../../state/useShelfStore'
import { useTerminalStore } from '../../state/useTerminalStore'
import { substituteTokens, cwdFor } from '../../lib/customCommands'
import { pathKey } from '../../lib/format'
import { t, tn } from '../../i18n'
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
  /** Éléments actuellement affichés (filtres/masqués appliqués). */
  visible: DirEntry[]
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
  // copyOrMove gère conflits (dialogue), toast et rafraîchissement.
  const run = (op: 'copy' | 'move'): void => {
    void copyOrMove(op, paths, destDir)
  }
  const archives = paths.filter((p) => ARCHIVE_EXT.has(extOf(baseSegment(p))))

  const items: MenuEntry[] = [
    {
      label: tn(n, 'Copier ici', 'Copier ici ({n})'),
      icon: <ClipboardCopy size={14} />,
      onClick: () => run('copy')
    },
    {
      label: tn(n, 'Déplacer ici', 'Déplacer ici ({n})'),
      icon: <FolderInput size={14} />,
      onClick: () => run('move')
    },
    {
      label: tn(n, 'Créer un raccourci ici', 'Créer {n} raccourcis ici'),
      icon: <Link2 size={14} />,
      onClick: () =>
        void Promise.all(paths.map((p) => window.api.fs.createShortcut(p, destDir))).then(refreshAll)
    }
  ]

  if (apps.sevenzip) {
    items.push({
      label: t('Compresser ici (.zip)'),
      icon: <FileArchive size={14} />,
      onClick: () => void window.api.apps.archive(paths, destDir)
    })
    if (archives.length > 0) {
      items.push({
        label: tn(archives.length, 'Extraire ici', 'Extraire ici ({n})'),
        icon: <FileDown size={14} />,
        onClick: () => archives.forEach((a) => void window.api.apps.extract(a, destDir))
      })
    }
  }

  items.push({ type: 'sep' }, { label: t('Annuler'), icon: <X size={14} />, onClick: () => {} })
  return items
}

/**
 * Sous-menu « Sélectionner » : sélections intelligentes sur la liste visible —
 * tout, inversion, par type, par extension de l'élément cliqué, modifiés
 * aujourd'hui. Complète le lasso et Ctrl/Maj+clic.
 */
function buildSelectSubmenu(ctx: MenuCtx, current: DirEntry | null): MenuEntry {
  const { visible, selectedSet, setSelected } = ctx
  const pick = (pred: (e: DirEntry) => boolean): void =>
    setSelected(visible.filter(pred).map((e) => e.path))

  const children: MenuEntry[] = [
    { label: t('Tout sélectionner'), onClick: () => pick(() => true) },
    {
      label: t('Inverser la sélection'),
      onClick: () => pick((e) => !selectedSet.has(e.path))
    },
    { type: 'sep' },
    { label: t('Fichiers seulement'), onClick: () => pick((e) => e.kind === 'file') },
    { label: t('Dossiers seulement'), onClick: () => pick((e) => e.kind === 'directory') },
    {
      label: t("Modifiés aujourd'hui"),
      onClick: () => {
        const midnight = new Date()
        midnight.setHours(0, 0, 0, 0)
        pick((e) => e.modifiedMs >= midnight.getTime())
      }
    }
  ]

  const ext = current && current.kind === 'file' ? extOf(current.name) : ''
  if (ext) {
    children.splice(2, 0, {
      label: t('Même extension (.{ext})', { ext }),
      onClick: () => pick((e) => e.kind === 'file' && extOf(e.name) === ext)
    })
  }

  return { label: t('Sélectionner'), icon: <ListChecks size={14} />, children }
}

/** Menu de la zone vide (clic droit hors d'un élément) : créer / coller / actualiser. */
export function buildBackgroundMenu(ctx: MenuCtx): MenuEntry[] {
  const { path } = ctx
  return [
    ...(useAppsStore.getState().apps.vscode
      ? [
          {
            label: t('Ouvrir avec VS Code'),
            icon: <Code2 size={14} />,
            onClick: () => window.api.apps.openWith('vscode', [path])
          } as MenuEntry,
          { type: 'sep' } as MenuEntry
        ]
      : []),
    {
      label: t('Nouveau dossier'),
      icon: <FolderPlus size={14} />,
      onClick: () => void ctx.createThen(window.api.fs.createDir, 'Nouveau dossier')
    },
    {
      label: t('Nouveau fichier'),
      icon: <FilePlus size={14} />,
      onClick: () => void ctx.createThen(window.api.fs.createFile, 'Nouveau fichier.txt')
    },
    {
      label: t('Créer des dossiers… (en lot)'),
      icon: <FolderPlus size={14} />,
      onClick: () => useUiStore.getState().setFolderCreator(true)
    },
    { type: 'sep' },
    {
      // Toujours actif : les fichiers peuvent venir du presse-papiers de
      // l'Explorateur Windows (invisible d'ici sans un aller-retour PowerShell).
      label: t('Coller'),
      icon: <ClipboardPaste size={14} />,
      onClick: () => void pasteInto(path)
    },
    buildSelectSubmenu(ctx, null),
    { type: 'sep' },
    {
      label: useFavoritesStore.getState().has(path) ? t('Retirer des favoris') : t('Ajouter aux favoris'),
      icon: useFavoritesStore.getState().has(path) ? <StarOff size={14} /> : <Star size={14} />,
      onClick: () => useFavoritesStore.getState().toggle(path)
    },
    { label: t('Actualiser'), icon: <RefreshCw size={14} />, onClick: () => useNavStore.getState().refresh() },
    {
      label: t('Ouvrir un terminal ici'),
      icon: <TerminalSquare size={14} />,
      onClick: () => ctx.openTerminalHere(path)
    },
    {
      label: t("Ouvrir dans l'explorateur"),
      icon: <ExternalLink size={14} />,
      onClick: () => void window.api.fs.reveal(path)
    },
    {
      label: t('Propriétés du dossier'),
      icon: <Info size={14} />,
      onClick: () => window.api.apps.properties(path)
    }
  ]
}

/** Menu contextuel d'un élément (fichier/dossier), sélection multiple incluse. */
export function buildItemMenu(entry: DirEntry, ctx: MenuCtx): MenuEntry[] {
  const { path, selected, selectedSet, repo, statusByPath } = ctx
  const git = statusByPath[pathKey(entry.path)]
  const apps = useAppsStore.getState().apps
  // Cible des opérations groupées : la sélection si l'élément en fait partie.
  const targets = selectedSet.has(entry.path) && selected.length > 1 ? selected : [entry.path]
  const n = targets.length

  // Intégrations d'applications : regroupées en sous-menus pour garder le menu
  // court (retour utilisateur : liste trop longue, façon shell Windows).
  const appEntries: MenuEntry[] = []
  if (entry.kind === 'file') {
    const ext = extOf(entry.name)
    const openWith: MenuEntry[] = []
    if (apps.vscode)
      openWith.push({
        label: t('VS Code'),
        icon: <Code2 size={14} />,
        onClick: () => window.api.apps.openWith('vscode', targets)
      })
    if (apps.notepadpp)
      openWith.push({
        label: t('Notepad++'),
        icon: <PenLine size={14} />,
        onClick: () => window.api.apps.openWith('notepadpp', targets)
      })
    for (const exe of useOpenWithStore.getState().get(ext)) {
      openWith.push({
        label: programName(exe),
        icon: <AppWindow size={14} />,
        onClick: () => window.api.apps.openPathWith(exe, targets)
      })
    }
    if (openWith.length) openWith.push({ type: 'sep' })
    openWith.push({
      label: t('Choisir un programme…'),
      icon: <AppWindow size={14} />,
      onClick: async () => {
        const exe = await window.api.apps.pickProgram()
        if (!exe) return
        window.api.apps.openPathWith(exe, targets)
        if (ext) useOpenWithStore.getState().add(ext, exe)
      }
    })
    openWith.push({
      // Boîte « Ouvrir avec » du système : toutes les applications du registre.
      label: t('Applications Windows…'),
      icon: <AppWindow size={14} />,
      onClick: () => window.api.apps.openAsDialog(entry.path)
    })
    appEntries.push({ label: t('Ouvrir avec'), icon: <AppWindow size={14} />, children: openWith })
  } else if (apps.vscode) {
    appEntries.push({
      label: t('Ouvrir avec VS Code'),
      icon: <Code2 size={14} />,
      onClick: () => window.api.apps.openWith('vscode', targets)
    })
  }
  if (apps.sevenzip) {
    const sz: MenuEntry[] = [
      {
        label: tn(n, 'Compresser en .zip', 'Compresser ({n}) en .zip'),
        icon: <FileArchive size={14} />,
        onClick: () => void window.api.apps.archive(targets)
      }
    ]
    if (entry.kind === 'file' && ARCHIVE_EXT.has(extOf(entry.name)))
      sz.push({
        label: t('Extraire ici'),
        icon: <FileDown size={14} />,
        onClick: () => void window.api.apps.extract(entry.path)
      })
    appEntries.push({ label: t('7-Zip'), icon: <FileArchive size={14} />, children: sz })
  }

  // Commandes personnalisées (exécutées dans le terminal intégré, jetons substitués).
  const custom = useCustomCommandsStore
    .getState()
    .commands.filter((c) => c.target === 'both' || c.target === (entry.kind === 'directory' ? 'directory' : 'file'))
  if (custom.length) {
    appEntries.push({
      label: t('Commandes'),
      icon: <TerminalSquare size={14} />,
      children: custom.map((c) => ({
        label: c.name,
        icon: <TerminalSquare size={14} />,
        onClick: () => {
          const isDir = entry.kind === 'directory'
          useUiStore.getState().setTerminalOpen(true)
          void useTerminalStore.getState().openTaskTab({
            cwd: cwdFor(entry.path, isDir),
            title: c.name,
            command: substituteTokens(c.command, entry.path, isDir)
          })
        }
      }))
    })
  }

  const entries: MenuEntry[] = [
    { label: t('Ouvrir'), icon: <FolderOpen size={14} />, onClick: () => ctx.onActivate(entry) },
    {
      label: t("Ouvrir dans l'explorateur"),
      icon: <ExternalLink size={14} />,
      onClick: () => void window.api.fs.reveal(entry.path)
    },
    ...(entry.kind === 'directory'
      ? [
          {
            label: t('Ouvrir un terminal ici'),
            icon: <TerminalSquare size={14} />,
            onClick: () => ctx.openTerminalHere(entry.path)
          } as MenuEntry,
          {
            label: t("Analyser l'espace disque"),
            icon: <PieChart size={14} />,
            onClick: () => useUiStore.getState().setDiskUsage(entry.path)
          } as MenuEntry,
          {
            label: t('Créer des dossiers… (en lot)'),
            icon: <FolderPlus size={14} />,
            onClick: () => useUiStore.getState().setFolderCreator(true, entry.path)
          } as MenuEntry
        ]
      : []),
    ...(entry.kind === 'file' && ARCHIVE_EXT.has(extOf(entry.name))
      ? [
          {
            label: t("Parcourir l'archive"),
            icon: <FileArchive size={14} />,
            onClick: () => useUiStore.getState().setArchive(entry.path)
          } as MenuEntry
        ]
      : []),
    {
      label: t('Créer un raccourci'),
      icon: <Link2 size={14} />,
      onClick: () => void window.api.fs.createShortcut(entry.path).then(ctx.refreshAfter)
    },
    ...(appEntries.length ? [{ type: 'sep' } as MenuEntry, ...appEntries] : []),
    { type: 'sep' },
    {
      label: t('Copier le chemin'),
      icon: <Copy size={14} />,
      onClick: () => void navigator.clipboard.writeText(entry.path)
    },
    {
      label: t('Copier le nom'),
      icon: <Copy size={14} />,
      onClick: () => void navigator.clipboard.writeText(entry.name)
    },
    { type: 'sep' },
    n > 1
      ? {
          label: t('Renommer en masse ({n})…', { n }),
          icon: <Pencil size={14} />,
          onClick: () => ctx.setBulkPaths(targets)
        }
      : { label: t('Renommer'), icon: <Pencil size={14} />, onClick: () => ctx.setRenaming(entry.path) },
    {
      label: tn(n, 'Couper', 'Couper ({n})'),
      icon: <Scissors size={14} />,
      onClick: () => clipFiles(targets, 'cut')
    },
    {
      label: tn(n, 'Copier', 'Copier ({n})'),
      icon: <ClipboardCopy size={14} />,
      onClick: () => clipFiles(targets, 'copy')
    },
    ...(entry.kind === 'directory'
      ? [
          {
            label: t('Coller dans le dossier'),
            icon: <ClipboardPaste size={14} />,
            onClick: () => void pasteInto(entry.path)
          } as MenuEntry
        ]
      : []),
    ...(useShelfStore.getState().enabled
      ? [
          {
            label: tn(n, "Mettre sur l'étagère", "Mettre sur l'étagère ({n})"),
            icon: <Layers size={14} />,
            onClick: () => useShelfStore.getState().add(targets)
          } as MenuEntry
        ]
      : []),
    buildSelectSubmenu(ctx, entry),
    {
      label: t('Renommer'),
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
              ? t('Retirer des favoris')
              : t('Ajouter aux favoris'),
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

  if (repo) {
    entries.push({ type: 'sep' })
    entries.push({
      label: t('Historique Git'),
      icon: <History size={14} />,
      onClick: () => useUiStore.getState().setFileHistory(entry.path)
    })
  }

  if (repo && git && git.category !== 'ignored') {
    entries.push({
      label: t('Indexer'),
      icon: <Plus size={14} />,
      onClick: () => void window.api.git.stage(path, [entry.path]).then(ctx.refreshAfter)
    })
    entries.push({
      label: t('Désindexer'),
      icon: <Minus size={14} />,
      disabled: !git.staged,
      onClick: () => void window.api.git.unstage(path, [entry.path]).then(ctx.refreshAfter)
    })
    if (git.category !== 'untracked') {
      entries.push({
        label: t('Annuler les modifications'),
        icon: <Undo2 size={14} />,
        danger: true,
        onClick: () => {
          if (
            window.confirm(
              t('Annuler les modifications de « {name} » ? Action irréversible.', { name: entry.name })
            )
          ) {
            void window.api.git.discard(path, entry.path).then(ctx.refreshAfter)
          }
        }
      })
    }
  }

  entries.push({ type: 'sep' })
  entries.push({
    label: tn(n, 'Supprimer (corbeille)', 'Supprimer ({n}) → corbeille'),
    icon: <Trash2 size={14} />,
    danger: true,
    onClick: () => void ctx.trashPaths(targets)
  })
  entries.push({
    label: t('Propriétés'),
    icon: <Info size={14} />,
    onClick: () => window.api.apps.properties(entry.path)
  })
  return entries
}
