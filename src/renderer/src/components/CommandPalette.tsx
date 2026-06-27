import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Home,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Star,
  Eye,
  Filter,
  TerminalSquare,
  Plus,
  Palette,
  PanelRight,
  Sun,
  Moon,
  SunMoon,
  ArrowDownToLine,
  ArrowUpFromLine,
  FolderGit2,
  Columns2,
  LayoutGrid,
  Rocket,
  Play,
  Search,
  AppWindow,
  DownloadCloud,
  PieChart
} from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { useWorkspaceStore } from '../state/useWorkspaceStore'
import { useRunnerStore } from '../state/useRunnerStore'
import { useUpdateStore } from '../state/useUpdateStore'
import { useGitStore } from '../state/useGitStore'
import { useSearchStore } from '../state/useSearchStore'
import { useTerminalStore } from '../state/useTerminalStore'
import { useAppearanceStore } from '../state/useAppearanceStore'
import type { GitProject } from '@shared/types'

interface Command {
  id: string
  title: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

/** Score flou : sous-chaîne (meilleur) puis sous-séquence, sinon -1 (exclu). */
function score(query: string, text: string): number {
  if (!query) return 1
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = t.indexOf(q)
  if (idx >= 0) return 100 - idx
  let ti = 0
  for (const ch of q) {
    ti = t.indexOf(ch, ti)
    if (ti === -1) return -1
    ti++
  }
  return 10
}

/**
 * Palette de commandes (Ctrl+Maj+P / Ctrl+P) : recherche floue d'actions
 * (navigation, vue, panneaux, Git, thème) et de projets, navigation clavier.
 */
export default function CommandPalette(): JSX.Element | null {
  const open = useUiStore((s) => s.paletteOpen)
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)

  // Valeurs réactives utilisées pour les libellés (états basculables).
  const path = useNavStore((s) => activePane(s).path)
  const parent = useNavStore((s) => activePane(s).parent)
  const paneCount = useNavStore((s) => s.panes.length)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const runnerTasks = useRunnerStore((s) => s.tasks)
  const showHidden = useNavStore((s) => s.showHidden)
  const hideGitIgnored = useNavStore((s) => s.hideGitIgnored)
  const terminalOpen = useUiStore((s) => s.terminalOpen)
  const repo = useGitStore((s) => s.repo)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [projects, setProjects] = useState<GitProject[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // (Ré)initialise à l'ouverture et récupère les projets pour la navigation.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(0)
    inputRef.current?.focus()
    let alive = true
    window.api.git
      .projects()
      .then((p) => alive && setProjects(p))
      .catch(() => alive && setProjects([]))
    return () => {
      alive = false
    }
  }, [open])

  const close = (): void => setPaletteOpen(false)
  const runAndClose = (fn: () => void): void => {
    close()
    fn()
  }

  const commands = useMemo<Command[]>(() => {
    const nav = useNavStore.getState
    const ui = useUiStore.getState
    const list: Command[] = [
      { id: 'quickaccess', title: 'Accès rapide', icon: <Star size={15} />, run: () => {
        useSearchStore.getState().close()
        nav().showQuickAccess()
      } },
      { id: 'home', title: "Aller à l'accueil", icon: <Home size={15} />, run: () => nav().goHome() },
      { id: 'parent', title: 'Dossier parent', icon: <ArrowUp size={15} />, run: () => nav().goParent(), hint: parent ? undefined : 'racine' },
      { id: 'back', title: 'Précédent', icon: <ArrowLeft size={15} />, run: () => nav().goBack() },
      { id: 'forward', title: 'Suivant', icon: <ArrowRight size={15} />, run: () => nav().goForward() },
      { id: 'refresh', title: 'Rafraîchir', icon: <RotateCw size={14} />, run: () => nav().refresh() },
      {
        id: 'hidden',
        title: showHidden ? 'Masquer les éléments cachés' : 'Afficher les éléments cachés',
        icon: <Eye size={15} />,
        run: () => nav().toggleHidden()
      },
      {
        id: 'gitignored',
        title: hideGitIgnored ? 'Afficher les fichiers ignorés (.gitignore)' : 'Masquer les fichiers ignorés (.gitignore)',
        icon: <Filter size={15} />,
        run: () => nav().toggleGitIgnored()
      },
      {
        id: 'terminal',
        title: terminalOpen ? 'Masquer le terminal' : 'Afficher le terminal',
        icon: <TerminalSquare size={15} />,
        run: () => ui().toggleTerminal()
      },
      {
        id: 'newterminal',
        title: 'Nouveau terminal',
        icon: <Plus size={15} />,
        run: () => {
          ui().setTerminalOpen(true)
          void useTerminalStore.getState().openTab()
        }
      },
      { id: 'launcher', title: 'Lanceur', icon: <Rocket size={15} />, run: () => nav().showLauncher() },
      { id: 'new-window', title: 'Nouvelle fenêtre', hint: 'Ctrl+Maj+N', icon: <AppWindow size={15} />, run: () => void window.api.window.new() },
      { id: 'go-to-file', title: 'Aller à un fichier…', hint: 'Ctrl+E', icon: <Search size={15} />, run: () => ui().setFileFinder(true) },
      { id: 'disk-usage', title: 'Espace disque (dossier courant)', icon: <PieChart size={15} />, run: () => ui().setDiskUsage(path) },
      { id: 'check-update', title: 'Vérifier les mises à jour', icon: <DownloadCloud size={15} />, run: () => useUpdateStore.getState().check() },
      { id: 'split', title: 'Diviser — nouveau volet', icon: <Columns2 size={15} />, run: () => void nav().addPane() },
      { id: 'preview', title: "Panneau d'aperçu", icon: <PanelRight size={15} />, run: () => ui().togglePreview() },
      { id: 'appearance', title: "Panneau d'apparence", icon: <Palette size={15} />, run: () => ui().toggleAppearance() },
      { id: 'theme-light', title: 'Thème : clair', icon: <Sun size={15} />, run: () => useAppearanceStore.getState().update({ theme: 'light' }) },
      { id: 'theme-dark', title: 'Thème : sombre', icon: <Moon size={15} />, run: () => useAppearanceStore.getState().update({ theme: 'dark' }) },
      { id: 'theme-auto', title: 'Thème : auto', icon: <SunMoon size={15} />, run: () => useAppearanceStore.getState().update({ theme: 'auto' }) }
    ]

    if (paneCount > 1) {
      list.push({
        id: 'close-pane',
        title: 'Fermer le volet actif',
        icon: <Columns2 size={15} />,
        run: () => nav().closePane(useNavStore.getState().activeId)
      })
    }

    if (repo) {
      const refreshGit = async (): Promise<void> => {
        await useGitStore.getState().refresh(path)
        nav().refresh()
      }
      list.push({
        id: 'git-view',
        title: 'Git : vue détaillée (fichiers + diff)',
        icon: <FolderGit2 size={15} />,
        run: () => {
          useSearchStore.getState().close()
          ui().setGitView(true)
        }
      })
      list.push({
        id: 'git-pull',
        title: 'Git : Pull',
        hint: repo.behind > 0 ? `↓${repo.behind}` : undefined,
        icon: <ArrowDownToLine size={15} />,
        run: () => void window.api.git.pull(path).then(refreshGit)
      })
      list.push({
        id: 'git-push',
        title: 'Git : Push',
        hint: repo.ahead > 0 ? `↑${repo.ahead}` : undefined,
        icon: <ArrowUpFromLine size={15} />,
        run: () => void window.api.git.push(path).then(refreshGit)
      })
    }

    for (const t of runnerTasks) {
      list.push({
        id: `run-${t.id}`,
        title: `Lancer : ${t.name}`,
        icon: <Play size={15} />,
        run: () => void useRunnerStore.getState().runTask(t.id)
      })
    }

    for (const name of Object.keys(workspaces)) {
      list.push({
        id: `ws-${name}`,
        title: `Espace de travail : ${name}`,
        icon: <LayoutGrid size={15} />,
        run: () => void useWorkspaceStore.getState().load(name)
      })
    }

    for (const p of projects) {
      list.push({
        id: `proj-${p.root}`,
        title: `Projet : ${p.name}`,
        hint: p.branch,
        icon: <FolderGit2 size={15} />,
        run: () => nav().navigate(p.root)
      })
    }

    return list
  }, [path, parent, paneCount, workspaces, runnerTasks, showHidden, hideGitIgnored, terminalOpen, repo, projects])

  const filtered = useMemo(() => {
    return commands
      .map((c, i) => ({ c, s: score(query, c.title), i }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.c)
  }, [commands, query])

  // Garde la sélection dans les bornes et visible.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, filtered.length - 1)))
  }, [filtered.length])
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected, filtered.length])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selected]
      if (cmd) runAndClose(cmd.run)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center pt-[12vh]" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[70vh] w-[min(620px,92vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Tapez une commande…"
            spellCheck={false}
            className="w-full bg-transparent py-3 text-[14px] text-fg outline-none placeholder:text-fg-muted"
          />
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-fg-muted">Aucune commande</div>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.id}
                data-selected={i === selected}
                onMouseMove={() => setSelected(i)}
                onClick={() => runAndClose(c.run)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] ${
                  i === selected ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover'
                }`}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center">{c.icon}</span>
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                {c.hint && <span className="shrink-0 text-[11px] text-fg-muted tabular-nums">{c.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
