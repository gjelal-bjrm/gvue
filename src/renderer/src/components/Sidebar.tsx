import { useEffect, useState } from 'react'
import { Home, Monitor, Download, FileText, HardDrive, Star, FolderGit2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavStore } from '../state/useNavStore'
import { useSearchStore } from '../state/useSearchStore'
import type { GitProject } from '@shared/types'
import { pathKey } from '../lib/format'

/**
 * Sidebar : accès rapide, lecteurs, favoris et projets.
 * Les favoris viennent d'electron-store ; la détection auto des projets Git
 * (icônes branche) arrive en phase 6 — section affichée en aperçu d'ici là.
 */
export default function Sidebar(): JSX.Element {
  const { locations, path, navigate, quickAccess, showQuickAccess } = useNavStore()
  const closeSearch = useSearchStore((s) => s.close)
  const [favorites, setFavorites] = useState<string[]>([])
  const [projects, setProjects] = useState<GitProject[]>([])

  useEffect(() => {
    window.api.config.get('favorites').then(setFavorites).catch(() => setFavorites([]))
  }, [])

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

  return (
    <nav className="flex h-full w-full flex-col gap-5 overflow-y-auto bg-bg-secondary p-2.5 text-[13px]">
      <div className="flex flex-col gap-0.5">
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
          <p className="px-2 text-[12px] text-fg-muted">Aucun favori</p>
        ) : (
          favorites.map((f) => (
            <Item
              key={f}
              icon={Star}
              label={f.split(/[\\/]/).filter(Boolean).pop() ?? f}
              active={isActive(f)}
              onClick={() => navigate(f)}
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
              active={!quickAccess && pathKey(path) === pathKey(p.root)}
              onClick={() => navigate(p.root)}
            />
          ))
        )}
      </Section>
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

function ProjectItem(props: {
  project: GitProject
  active?: boolean
  onClick: () => void
}): JSX.Element {
  const { project } = props
  return (
    <button
      onClick={props.onClick}
      title={`${project.root} · ${project.branch}`}
      className={`flex items-center gap-2.5 rounded-app px-2 py-[var(--row-pad)] text-left transition-colors ${
        props.active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
      }`}
    >
      <FolderGit2 size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{project.name}</span>
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-fg-muted">
        {project.dirty && <span className="text-warning-fg">●</span>}
        {project.branch}
      </span>
    </button>
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
