import { useEffect, useMemo, useState } from 'react'
import {
  Home,
  Monitor,
  Download,
  FileText,
  Star,
  FolderGit2,
  X,
  Rocket,
  Play,
  Square,
  Settings2,
  ChevronRight,
  ChevronDown,
  Tag,
  FileCode,
  FolderOpen,
  GripVertical
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavStore, activePane } from '../state/useNavStore'
import { useSearchStore } from '../state/useSearchStore'
import { useFavoritesStore } from '../state/useFavoritesStore'
import { useRunnerStore, projKey } from '../state/useRunnerStore'
import { useSidebarStore } from '../state/useSidebarStore'
import type { GitProject, RunnerTask } from '@shared/types'
import { pathKey, baseName } from '../lib/format'
import { commandForFile, joinWin } from '../lib/runfile'
import FilePickerDialog from './FilePickerDialog'
import FolderTree from './FolderTree'

/**
 * Sidebar : lanceur, accès rapide, lecteurs, favoris et projets.
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
    </nav>
  )
}

function Section(props: {
  sectionKey: string
  title: string
  collapsed: boolean
  onToggle: () => void
  onReorder: (from: string) => void
  children: React.ReactNode
}): JSX.Element {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const from = e.dataTransfer.getData('application/x-gvue-section')
        if (from) props.onReorder(from)
      }}
      className={`flex flex-col gap-0.5 rounded-app ${over ? 'outline outline-1 outline-accent' : ''}`}
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-gvue-section', props.sectionKey)
          e.dataTransfer.effectAllowed = 'move'
        }}
        className="group flex items-center gap-1 pb-1.5 pl-1 pr-2"
      >
        <button
          onClick={props.onToggle}
          className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted hover:text-fg-secondary"
        >
          {props.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span className="truncate">{props.title}</span>
        </button>
        <GripVertical
          size={13}
          className="shrink-0 cursor-grab text-fg-muted opacity-0 group-hover:opacity-100"
        />
      </div>
      {!props.collapsed && props.children}
    </div>
  )
}

function LaunchRow(props: {
  task: RunnerTask
  running: boolean
  onRun: () => void
  onStop: () => void
}): JSX.Element {
  const { task } = props
  return (
    <div className="group flex items-center gap-1 rounded-app pr-1 text-fg-secondary hover:bg-bg-hover hover:text-fg">
      <span className="flex min-w-0 flex-1 items-center gap-2 px-2 py-[var(--row-pad)]" title={`${task.command} — ${task.cwd}`}>
        <span className="truncate text-[12px]">{task.name}</span>
      </span>
      {props.running ? (
        <button
          onClick={props.onStop}
          title="Arrêter"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-danger-fg hover:bg-bg-hover"
        >
          <Square size={12} />
        </button>
      ) : (
        <button
          onClick={props.onRun}
          title="Lancer"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-success-fg group-hover:opacity-100"
        >
          <Play size={12} />
        </button>
      )}
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
  running: boolean
  configured: boolean
  onClick: () => void
  onPlay: (e: React.MouseEvent) => void
  onConfig: (e: React.MouseEvent) => void
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
        onClick={props.onConfig}
        title="Définir la commande du ▶"
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
      >
        <Settings2 size={13} />
      </button>
      <button
        onClick={props.onPlay}
        title={
          props.running ? 'Arrêter' : props.configured ? 'Lancer le projet' : 'Définir puis lancer'
        }
        className={`grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-bg-hover ${
          props.running
            ? 'text-danger-fg'
            : 'text-fg-muted opacity-0 hover:text-success-fg group-hover:opacity-100'
        }`}
      >
        {props.running ? <Square size={12} /> : <Play size={13} />}
      </button>
    </div>
  )
}

/**
 * Petite boîte de dialogue pour définir la commande exécutée par le ▶ d'un
 * projet (avec raccourcis vers les scripts package.json détectés).
 */
function LaunchConfigDialog(props: { root: string; name: string; onClose: () => void }): JSX.Element {
  const projectLaunch = useRunnerStore((s) => s.projectLaunch)
  const setProjectCommand = useRunnerStore((s) => s.setProjectCommand)
  const runProject = useRunnerStore((s) => s.runProject)

  const [command, setCommand] = useState(projectLaunch[props.root] ?? '')
  const [scripts, setScripts] = useState<string[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    let alive = true
    void Promise.all([
      window.api.fs.packageScripts(props.root),
      window.api.fs.runnableFiles(props.root)
    ]).then(([s, f]) => {
      if (!alive) return
      setScripts(s)
      setFiles(f)
    })
    return () => {
      alive = false
    }
  }, [props.root])

  const save = (run: boolean): void => {
    setProjectCommand(props.root, command)
    if (run && command.trim()) void runProject(props.root, props.name)
    props.onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={props.onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-[min(440px,92vw)] rounded-app border border-border bg-bg-secondary p-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-fg">
          <Play size={14} className="text-accent" />
          Lancement de {props.name}
        </div>
        <p className="mb-3 text-[12px] text-fg-muted">
          Commande exécutée d'un clic sur ▶, dans le dossier du projet.
        </p>

        <div className="flex gap-1.5">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save(true)
              else if (e.key === 'Escape') props.onClose()
            }}
            autoFocus
            spellCheck={false}
            placeholder="ex. npm run dev"
            className="min-w-0 flex-1 rounded-app border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
          />
          <button
            onClick={() => setPicking(true)}
            title="Choisir un fichier à lancer (.bat, .ps1, .exe…)"
            className="flex shrink-0 items-center gap-1 rounded-app border border-border px-2 text-[12px] text-fg-secondary hover:bg-bg-hover"
          >
            <FolderOpen size={13} /> Fichier…
          </button>
        </div>

        {picking && (
          <FilePickerDialog
            initialDir={props.root}
            onPick={(file) => {
              setCommand(commandForFile(file))
              setPicking(false)
            }}
            onClose={() => setPicking(false)}
          />
        )}

        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-fg-muted">Fichiers :</span>
            {files.map((f) => (
              <button
                key={f}
                onClick={() => setCommand(commandForFile(joinWin(props.root, f)))}
                className="flex items-center gap-1 rounded-app border border-border px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-bg-hover"
              >
                <Play size={10} /> {f}
              </button>
            ))}
          </div>
        )}

        {scripts.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-fg-muted">Scripts :</span>
            {scripts.map((s) => (
              <button
                key={s}
                onClick={() => setCommand(`npm run ${s}`)}
                className="flex items-center gap-1 rounded-app border border-border px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-bg-hover"
              >
                <FileCode size={11} /> {s}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          {projectLaunch[props.root] && (
            <button
              onClick={() => {
                setProjectCommand(props.root, '')
                props.onClose()
              }}
              className="mr-auto rounded-app px-2 py-1.5 text-[12px] text-danger-fg hover:bg-bg-hover"
            >
              Effacer
            </button>
          )}
          <button
            onClick={props.onClose}
            className="rounded-app px-2.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
          >
            Annuler
          </button>
          <button
            onClick={() => save(false)}
            disabled={!command.trim()}
            className="rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg hover:bg-bg-hover disabled:opacity-40"
          >
            Enregistrer
          </button>
          <button
            onClick={() => save(true)}
            disabled={!command.trim()}
            className="flex items-center gap-1.5 rounded-app bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <Play size={13} /> Lancer
          </button>
        </div>
      </div>
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
