import { useEffect, useState } from 'react'
import { Home, Monitor, Download, FileText, HardDrive, Star, FolderGit2, X, Rocket, Play } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavStore, activePane } from '../state/useNavStore'
import { useSearchStore } from '../state/useSearchStore'
import { useFavoritesStore } from '../state/useFavoritesStore'
import { useUiStore } from '../state/useUiStore'
import { useTerminalStore } from '../state/useTerminalStore'
import type { GitProject } from '@shared/types'
import { pathKey, baseName } from '../lib/format'
import ContextMenu, { type MenuEntry } from './ContextMenu'

/**
 * Sidebar : accès rapide, lecteurs, favoris et projets.
 * Les favoris viennent d'electron-store ; la détection auto des projets Git
 * (icônes branche) arrive en phase 6 — section affichée en aperçu d'ici là.
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
  const [projects, setProjects] = useState<GitProject[]>([])
  const [runMenu, setRunMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)

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

  // Bouton Play d'un projet : propose ses scripts package.json → terminal.
  const onProjectPlay = async (e: React.MouseEvent, project: GitProject): Promise<void> => {
    e.stopPropagation()
    const scripts = await window.api.fs.packageScripts(project.root)
    const entries: MenuEntry[] = scripts.length
      ? scripts.map((s) => ({
          label: `npm run ${s}`,
          icon: <Play size={14} />,
          onClick: () => {
            useUiStore.getState().setTerminalOpen(true)
            void useTerminalStore
              .getState()
              .openTaskTab({ cwd: project.root, title: `${project.name}: ${s}`, command: `npm run ${s}` })
          }
        }))
      : [{ label: 'Aucun script package.json', disabled: true, onClick: () => {} }]
    setRunMenu({ x: e.clientX, y: e.clientY, entries })
  }

  return (
    <nav className="flex h-full w-full flex-col gap-5 overflow-y-auto bg-bg-secondary p-2.5 text-[13px]">
      <div className="flex flex-col gap-0.5">
        <Item icon={Rocket} label="Lanceur" active={launcher} onClick={openLauncher} />
        <Item icon={Star} label="Accès rapide" active={quickAccess} onClick={openQuickAccess} />
      </div>

      <Section title="Ce PC">
        {home && (
          <Item icon={Home} label="Accueil" active={isActive(home)} onClick={() => navigate(home)} />
        )}
        {locations?.desktop && (
          <Item
            icon={Monitor}
            label="Bureau"
            active={isActive(locations.desktop)}
            onClick={() => navigate(locations.desktop)}
          />
        )}
        {locations?.downloads && (
          <Item
            icon={Download}
            label="Téléchargements"
            active={isActive(locations.downloads)}
            onClick={() => navigate(locations.downloads)}
          />
        )}
        {locations?.documents && (
          <Item
            icon={FileText}
            label="Documents"
            active={isActive(locations.documents)}
            onClick={() => navigate(locations.documents)}
          />
        )}
      </Section>

      <Section title="Lecteurs">
        {locations?.drives.map((d) => (
          <Item
            key={d.path}
            icon={HardDrive}
            label={d.label}
            active={isActive(d.path)}
            onClick={() => navigate(d.path)}
          />
        ))}
      </Section>

      <Section title="Favoris">
        {favorites.length === 0 ? (
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
            />
          ))
        )}
      </Section>

      <Section title="Projets">
        {projects.length === 0 ? (
          <p className="px-2 text-[12px] text-fg-muted">Visitez un dépôt Git pour le voir ici.</p>
        ) : (
          projects.map((p) => (
            <ProjectItem
              key={p.root}
              project={p}
              active={!quickAccess && !launcher && pathKey(path) === pathKey(p.root)}
              onClick={() => navigate(p.root)}
              onPlay={(e) => void onProjectPlay(e, p)}
            />
          ))
        )}
      </Section>

      {runMenu && (
        <ContextMenu x={runMenu.x} y={runMenu.y} entries={runMenu.entries} onClose={() => setRunMenu(null)} />
      )}
    </nav>
  )
}

function Section(props: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
        {props.title}
      </div>
      {props.children}
    </div>
  )
}

function FavoriteItem(props: {
  path: string
  active?: boolean
  onOpen: () => void
  onRemove: () => void
}): JSX.Element {
  return (
    <div
      className={`group flex items-center gap-1 rounded-app pr-1 ${
        props.active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
      }`}
    >
      <button
        onClick={props.onOpen}
        title={props.path}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-[var(--row-pad)] text-left"
      >
        <Star size={16} className="shrink-0" />
        <span className="truncate">{baseName(props.path)}</span>
      </button>
      <button
        onClick={props.onRemove}
        title="Retirer des favoris"
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  )
}

function ProjectItem(props: {
  project: GitProject
  active?: boolean
  onClick: () => void
  onPlay: (e: React.MouseEvent) => void
}): JSX.Element {
  const { project } = props
  return (
    <div
      className={`group flex items-center gap-1 rounded-app pr-1 ${
        props.active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
      }`}
    >
      <button
        onClick={props.onClick}
        title={`${project.root} · ${project.branch}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-[var(--row-pad)] text-left"
      >
        <FolderGit2 size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-fg-muted">
          {project.dirty && <span className="text-warning-fg">●</span>}
          {project.branch}
        </span>
      </button>
      <button
        onClick={props.onPlay}
        title="Lancer un script du projet"
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-success-fg group-hover:opacity-100"
      >
        <Play size={13} />
      </button>
    </div>
  )
}

function Item(props: {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
}): JSX.Element {
  const { icon: Icon } = props
  return (
    <button
      onClick={props.onClick}
      title={props.label}
      className={`flex items-center gap-2.5 rounded-app px-2 py-[var(--row-pad)] text-left transition-colors ${
        props.active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{props.label}</span>
    </button>
  )
}
