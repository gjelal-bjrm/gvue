import { Server, TerminalSquare, X } from 'lucide-react'
import type { SshHost } from '@shared/types'
import { sshSubtitle } from '../../lib/ssh'

/** Serveur SSH de la sidebar : nom + cible, clic → terminal intégré. */
export default function ServerItem(props: {
  host: SshHost
  onConnect: () => void
  /** Présent seulement pour les hôtes manuels (ceux du ssh_config sont en lecture seule). */
  onRemove?: (e: React.MouseEvent) => void
}): JSX.Element {
  const { host } = props
  const subtitle = sshSubtitle(host)
  return (
    <div className="group flex items-center gap-1 rounded-app pr-1 text-fg-secondary hover:bg-bg-hover hover:text-fg">
      <button
        onClick={props.onConnect}
        title={
          host.source === 'config'
            ? `${host.name} — défini dans ~/.ssh/config\nClic : ouvrir un terminal SSH`
            : `Clic : ouvrir un terminal SSH vers ${subtitle || host.name}`
        }
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-[var(--row-pad)] text-left"
      >
        <Server size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{host.name}</span>
        {subtitle && subtitle !== host.name && (
          <span className="max-w-[45%] shrink-0 truncate text-[11px] text-fg-muted">{subtitle}</span>
        )}
      </button>
      <TerminalSquare
        size={13}
        className="shrink-0 text-fg-muted opacity-0 group-hover:opacity-100"
      />
      {props.onRemove && (
        <button
          onClick={props.onRemove}
          title="Retirer ce serveur"
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
