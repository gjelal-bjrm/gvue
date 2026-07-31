import { Star, X, Play, Square, Settings2 } from 'lucide-react'
import { baseName } from '../../lib/format'
import { t } from '../../i18n'

/**
 * Favori de la sidebar (ouvrir au clic, retirer au survol). Comme les projets,
 * il porte un ▶ pour exécuter une commande définie (⚙ pour la définir / la
 * changer) — utile pour un dossier de projet mis en favori.
 */
export default function FavoriteItem(props: {
  path: string
  active?: boolean
  running: boolean
  configured: boolean
  onOpen: () => void
  onRemove: () => void
  onPlay: (e: React.MouseEvent) => void
  onConfig: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}): JSX.Element {
  return (
    <div
      onContextMenu={props.onContextMenu}
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
        <span className="min-w-0 flex-1 truncate">{baseName(props.path)}</span>
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
        title={props.running ? t('Arrêter') : props.configured ? t('Lancer') : t('Définir puis lancer')}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-bg-hover ${
          props.running
            ? 'text-danger-fg'
            : 'text-fg-muted opacity-0 hover:text-success-fg group-hover:opacity-100'
        }`}
      >
        {props.running ? <Square size={12} /> : <Play size={13} />}
      </button>
      <button
        onClick={props.onRemove}
        title={t('Retirer des favoris')}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  )
}
