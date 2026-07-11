import { useEffect, useMemo, useState } from 'react'
import {
  Home,
  Monitor,
  Download,
  FileText,
  Star,
  FolderGit2,
  Rocket,
  ChevronRight,
  ChevronDown,
  Tag
} from 'lucide-react'
import { useNavStore, activePane } from '../state/useNavStore'
import { useSearchStore } from '../state/useSearchStore'
import { useFavoritesStore } from '../state/useFavoritesStore'
import { useRunnerStore, projKey } from '../state/useRunnerStore'
import { useSidebarStore } from '../state/useSidebarStore'
import type { GitProject, RunnerTask } from '@shared/types'
import { pathKey, baseName } from '../lib/format'
import FolderTree from './FolderTree'
import ContextMenu from './ContextMenu'
import { buildFolderMenu } from '../lib/folderMenu'
import Item from './sidebar/Item'
import Section from './sidebar/Section'
import LaunchRow from './sidebar/LaunchRow'
import FavoriteItem from './sidebar/FavoriteItem'
import ProjectItem from './sidebar/ProjectItem'
import LaunchConfigDialog from './sidebar/LaunchConfigDialog'

/**
 * Sidebar : lanceur, accès rapide, lecteurs, favoris et projets — orchestration
 * seule, les sous-composants vivent dans ./sidebar/.
 * - Le bouton ▶ d'un projet exécute une commande définie (⚙ pour la définir).
 * - Sous « Lanceur », une liste repliable de tous les lancements, regroupés
 *   par projet ou par catégorie.
 */
export default function Sidebar(): JSX.Element {
  const locations = useNavStore((s) => s.locations)
  const navigate = useNavStore((s) => s.navigate)
  const showQuickAccess = useNavStore((s) => s.showQuickAccess)
  const showLauncher = useNavStore((s) => s.showLauncher)
  const path = useNavStore((s) => activePane(s).path)
  const quickAccess = useNavStore((s) => activePane(s).quickAccess)
  const launcher = useNavStore((s) => activePane(s).launcher)
  const closeSearch = useSearchStore((s) => s.close)
  const favorites = useFavoritesStore((s) => s.favorites)
  const removeFavorite = useFavoritesStore((s) => s.remove)

  const order = useSidebarStore((s) => s.order)
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed)
  const reorder = useSidebarStore((s) => s.reorder)
  const initSidebar = useSidebarStore((s) => s.init)

  const tasks = useRunnerStore((s) => s.tasks)
  const running = useRunnerStore((s) => s.running)
  const projectLaunch = useRunnerStore((s) => s.projectLaunch)
  const runProject = useRunnerStore((s) => s.runProject)
  const stopProject = useRunnerStore((s) => s.stopProject)
  const runTask = useRunnerStore((s) => s.runTask)
  const stopTask = useRunnerStore((s) => s.stopTask)

  const [projects, setProjects] = useState<GitProject[]>([])
  const [launchOpen, setLaunchOpen] = useState(false)
  const [groupAxis, setGroupAxis] = useState<'project' | 'category'>('project')
  const [config, setConfig] = useState<{ root: string; name: string } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; dir: string } | null>(null)

  // Ouvre le menu contextuel de dossier (Ce PC, favoris, projets).
  const openCtx = (e: React.MouseEvent, dir: string): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, dir })
  }

  // Charge l'ordre et le repli des sections (persistés).
  useEffect(() => {
    void initSidebar()
  }, [initSidebar])

  // Recharge la liste des dépôts à chaque navigation (un dépôt fraîchement
  // visité y apparaît). La mémorisation se fait côté main au git:status.
  useEffect(() => {
    let alive = true
    window.api.git
      .projects()
      .then((p) => alive && setProjects(p))
      .catch(() => alive && setProjects([]))
    return () => {
      alive = false
    }
  }, [path])

  const home = locations?.home ?? ''
  // Un dossier n'est « actif » que lorsqu'on l'affiche (pas sur la page Accès rapide).
  const isActive = (p: string): boolean => !quickAccess && path === p

  const openQuickAccess = (): void => {
    closeSearch()
    showQuickAccess()
  }

  const openLauncher = (): void => {
    closeSearch()
    showLauncher()
  }

  // Clic sur ▶ d'un projet : arrête si en cours, lance si défini, sinon configure.
  const onProjectPlay = (e: React.MouseEvent, p: GitProject): void => {
    e.stopPropagation()
    if (running[projKey(p.root)]) stopProject(p.root)
    else if (projectLaunch[p.root]) void runProject(p.root, p.name)
    else setConfig({ root: p.root, name: p.name })
  }

  // Regroupe les lancements selon l'axe choisi (projet ou catégorie).
  const groups = useMemo(() => {
    const map = new Map<string, RunnerTask[]>()
    for (const t of tasks) {
      const label =
        groupAxis === 'project'
          ? t.project
            ? baseName(t.project)
            : 'Sans projet'
          : t.category || 'Sans catégorie'
      const arr = map.get(label)
      if (arr) arr.push(t)
      else map.set(label, [t])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tasks, groupAxis])

  // Contenu de chaque section réordonnable (clé → titre + corps).
  const sections: Record<string, { title: string; body: React.ReactNode }> = {
    thispc: {
      title: 'Ce PC',
      body: (
        <>
          {home && (
            <Item
              icon={Home}
              label="Accueil"
              active={isActive(home)}
              onClick={() => navigate(home)}
              onContextMenu={(e) => openCtx(e, home)}
            />
          )}
          {locations?.desktop && (
            <Item
              icon={Monitor}
              label="Bureau"
              active={isActive(locations.desktop)}
              onClick={() => navigate(locations.desktop)}
              onContextMenu={(e) => openCtx(e, locations.desktop)}
            />
          )}
          {locations?.downloads && (
            <Item
              icon={Download}
              label="Téléchargements"
              active={isActive(locations.downloads)}
              onClick={() => navigate(locations.downloads)}
              onContextMenu={(e) => openCtx(e, locations.downloads)}
            />
          )}
          {locations?.documents && (
            <Item
              icon={FileText}
              label="Documents"
              active={isActive(locations.documents)}
              onClick={() => navigate(locations.documents)}
              onContextMenu={(e) => openCtx(e, locations.documents)}
            />
          )}
        </>
      )
    },
    drives: {
      title: 'Lecteurs',
      body: <FolderTree />
    },
    favorites: {
      title: 'Favoris',
      body:
        favorites.length === 0 ? (
          <p className="px-2 text-[12px] text-fg-muted">
            Aucun favori — clic droit sur un dossier → « Ajouter aux favoris ».
          </p>
        ) : (
          favorites.map((f) => (
            <FavoriteItem
              key={f}
              path={f}
              active={isActive(f)}
              onOpen={() => navigate(f)}
              onRemove={() => removeFavorite(f)}
              onContextMenu={(e) => openCtx(e, f)}
            />
          ))
        )
    },
    projects: {
      title: 'Projets',
      body:
        projects.length === 0 ? (
          <p className="px-2 text-[12px] text-fg-muted">Visitez un dépôt Git pour le voir ici.</p>
        ) : (
          projects.map((p) => (
            <ProjectItem
              key={p.root}
              project={p}
              active={!quickAccess && !launcher && pathKey(path) === pathKey(p.root)}
              running={!!running[projKey(p.root)]}
              configured={!!projectLaunch[p.root]}
              onClick={() => navigate(p.root)}
              onPlay={(e) => onProjectPlay(e, p)}
              onConfig={(e) => {
                e.stopPropagation()
                setConfig({ root: p.root, name: p.name })
              }}
              onContextMenu={(e) => openCtx(e, p.root)}
            />
          ))
        )
    }
  }

  return (
    <nav className="flex h-full w-full flex-col gap-5 overflow-y-auto bg-bg-secondary p-2.5 text-[13px]">
      <div className="flex flex-col gap-0.5">
        <Item icon={Rocket} label="Lanceur" active={launcher} onClick={openLauncher} />

        {/* Liste repliable des lancements, regroupés par projet/catégorie. */}
        {tasks.length > 0 && (
          <div className="flex flex-col">
            <div className="flex items-center">
              <button
                onClick={() => setLaunchOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-1 rounded-app px-2 py-[var(--row-pad)] text-left text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
              >
                {launchOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span className="truncate">Lancements</span>
                <span className="text-[11px] text-fg-muted">({tasks.length})</span>
              </button>
              {launchOpen && (
                <button
                  onClick={() => setGroupAxis((a) => (a === 'project' ? 'category' : 'project'))}
                  title="Changer le regroupement (projet / catégorie)"
                  className="mr-1 flex shrink-0 items-center gap-1 rounded-app px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-bg-hover hover:text-fg"
                >
                  {groupAxis === 'project' ? <FolderGit2 size={11} /> : <Tag size={11} />}
                  {groupAxis === 'project' ? 'Projet' : 'Cat.'}
                </button>
              )}
            </div>

            {launchOpen && (
              <div className="flex flex-col gap-1 pb-1 pl-3">
                {groups.map(([label, items]) => (
                  <div key={label} className="flex flex-col">
                    <div className="px-1 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                      {label}
                    </div>
                    {items.map((t) => (
                      <LaunchRow
                        key={t.id}
                        task={t}
                        running={!!running[t.id]}
                        onRun={() => void runTask(t.id)}
                        onStop={() => stopTask(t.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Item icon={Star} label="Accès rapide" active={quickAccess} onClick={openQuickAccess} />
      </div>

      {order.map((key) => {
        const sec = sections[key]
        if (!sec) return null
        return (
          <Section
            key={key}
            sectionKey={key}
            title={sec.title}
            collapsed={!!collapsed[key]}
            onToggle={() => toggleCollapsed(key)}
            onReorder={(from) => reorder(from, key)}
          >
            {sec.body}
          </Section>
        )
      })}

      {config && (
        <LaunchConfigDialog
          root={config.root}
          name={config.name}
          onClose={() => setConfig(null)}
        />
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={buildFolderMenu(menu.dir)}
          onClose={() => setMenu(null)}
        />
      )}
    </nav>
  )
}
