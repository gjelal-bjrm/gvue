import { Server, TerminalSquare, FolderOpen, Network, Pencil, X } from 'lucide-react'
import type { SshHost } from '@shared/types'
import { sshSubtitle, describeForward } from '../../lib/ssh'
import { t } from '../../i18n'

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
  /** Présents seulement pour les hôtes manuels (ceux du ssh_config sont en lecture seule). */
  onEdit?: (e: React.MouseEvent) => void
  onRemove?: (e: React.MouseEvent) => void
}): JSX.Element {
  const { host } = props
  const subtitle = sshSubtitle(host)
  const configLine = t('{name} — défini dans ~/.ssh/config', { name: host.name })
  return (
    <div className="group flex items-center gap-1 rounded-app pr-1 text-fg-secondary hover:bg-bg-hover hover:text-fg">
      <button
        onClick={props.onConnect}
        // L'infobulle COMMENCE par le nom complet : même tronqué à l'écran,
        // le survol le donne en entier (demande utilisateur).
        title={
          `${host.name}\n` +
          (subtitle && subtitle !== host.name ? `${subtitle}\n` : '') +
          (host.source === 'config' ? `${configLine}\n` : '') +
          `${t('Clic : terminal SSH')} · ${t('Boutons (au survol) : ▸ terminal · 📂 fichiers (SFTP)')}`
        }
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1 text-left"
      >
        <Server size={16} className="shrink-0" />
        {/* Deux lignes (comme le manager) : le nom garde TOUTE la largeur,
            la cible passe dessous — fini le sous-titre qui vole 45 %. */}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate">{host.name}</span>
            {host.forwards && host.forwards.length > 0 && (
              <span
                title={t('Tunnels : {list}', {
                  list: host.forwards.map(describeForward).join(' · ')
                })}
                className="shrink-0 text-fg-muted"
              >
                <Network size={12} />
              </span>
            )}
          </span>
          {subtitle && subtitle !== host.name && (
            <span className="block truncate text-[10px] leading-tight text-fg-muted">
              {subtitle}
            </span>
          )}
        </span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onConnect()
        }}
        title={t('Ouvrir un terminal SSH')}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-accent group-hover:opacity-100"
      >
        <TerminalSquare size={13} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onBrowse()
        }}
        title={t('Parcourir les fichiers (SFTP)')}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-accent group-hover:opacity-100"
      >
        <FolderOpen size={13} />
      </button>
      {props.onEdit && (
        <button
          onClick={props.onEdit}
          title={t('Modifier (hôte, tunnels, mot de passe…)')}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
        >
          <Pencil size={12} />
        </button>
      )}
      {props.onRemove && (
        <button
          onClick={props.onRemove}
          title={t('Retirer ce serveur')}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
