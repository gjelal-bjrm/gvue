import { FolderGit2, Play, Square, Settings2, X } from 'lucide-react'
import type { GitProject } from '@shared/types'
import { t } from '../../i18n'

/** Dépôt de la section Projets : nom + branche + ▶ configurable (⚙) + retrait. */
export default function ProjectItem(props: {
  project: GitProject
  active?: boolean
  running: boolean
  configured: boolean
  onClick: () => void
  onPlay: (e: React.MouseEvent) => void
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
        title={t('Définir la commande du ▶')}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
      >
        <Settings2 size={13} />
      </button>
      <button
        onClick={props.onPlay}
        title={
          props.running ? t('Arrêter') : props.configured ? t('Lancer le projet') : t('Définir puis lancer')
        }
        className={`grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-bg-hover ${
          props.running
            ? 'text-danger-fg'
            : 'text-fg-muted opacity-0 hover:text-success-fg group-hover:opacity-100'
        }`}
      >
        {props.running ? <Square size={12} /> : <Play size={13} />}
      </button>
      <button
        onClick={props.onHide}
        title={t('Retirer de la liste (revient en rouvrant le dossier)')}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  )
}
