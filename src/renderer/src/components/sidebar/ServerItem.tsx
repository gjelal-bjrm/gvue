import { Server, TerminalSquare, FolderOpen, Network, X } from 'lucide-react'
import type { SshHost } from '@shared/types'
import { sshSubtitle, describeForward } from '../../lib/ssh'

/**
 * Serveur SSH de la sidebar. Clic sur le nom OU sur l'icône terminal →
 * terminal SSH intégré ; icône dossier → explorateur SFTP. Les deux icônes
 * sont de vrais boutons (l'icône terminal était décorative auparavant :
 * cliquer dessus ne faisait rien, ce qui donnait l'impression que seul le
 * SFTP fonctionnait).
 */
export default function ServerItem(props: {
  host: SshHost
  onConnect: () => void
  onBrowse: () => void
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
          (host.source === 'config' ? `${host.name} — défini dans ~/.ssh/config\n` : '') +
          `Clic : terminal SSH${subtitle ? ` vers ${subtitle}` : ''}\n` +
          `Boutons (au survol) : ▸ terminal · 📂 fichiers (SFTP)`
        }
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-[var(--row-pad)] text-left"
      >
        <Server size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{host.name}</span>
        {host.forwards && host.forwards.length > 0 && (
          <span
            title={`Tunnels : ${host.forwards.map(describeForward).join(' · ')}`}
            className="shrink-0 text-fg-muted"
          >
            <Network size={12} />
          </span>
        )}
        {subtitle && subtitle !== host.name && (
          <span className="max-w-[45%] shrink-0 truncate text-[11px] text-fg-muted">{subtitle}</span>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onConnect()
        }}
        title="Ouvrir un terminal SSH"
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-accent group-hover:opacity-100"
      >
        <TerminalSquare size={13} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onBrowse()
        }}
        title="Parcourir les fichiers (SFTP)"
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-accent group-hover:opacity-100"
      >
        <FolderOpen size={13} />
      </button>
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
