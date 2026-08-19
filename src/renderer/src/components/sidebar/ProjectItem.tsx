import { FolderGit2, Settings2, X } from 'lucide-react'
import type { GitProject } from '@shared/types'
import LaunchButtons from './LaunchButtons'
import { t } from '../../i18n'

/** Dépôt de la section Projets : nom + branche + lancements (⚙) + retrait. */
export default function ProjectItem(props: {
  project: GitProject
  active?: boolean
  onClick: () => void
  onConfig: (e: React.MouseEvent) => void
  onHide: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}): JSX.Element {
  const { project } = props
  return (
    <div
      onContextMenu={props.onContextMenu}
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
        title={t('Configurer les lancements')}
        className="hidden h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg group-hover:grid"
      >
        <Settings2 size={13} />
      </button>
      <LaunchButtons root={project.root} onConfigure={props.onConfig} />
      <button
        onClick={props.onHide}
        title={t('Retirer de la liste — le dossier n’est pas supprimé ; il revient si vous rouvrez son dossier')}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  )
}
