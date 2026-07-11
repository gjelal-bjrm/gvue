import { Play, Square } from 'lucide-react'
import type { RunnerTask } from '@shared/types'

/** Ligne d'un lancement dans la liste repliable (Play/Stop au survol). */
export default function LaunchRow(props: {
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
