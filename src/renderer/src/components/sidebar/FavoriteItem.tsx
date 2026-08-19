import { Star, X, Settings2 } from 'lucide-react'
import { baseName } from '../../lib/format'
import LaunchButtons from './LaunchButtons'
import { t } from '../../i18n'

/**
 * Favori de la sidebar (ouvrir au clic, retirer au survol). Comme les projets,
 * il porte les boutons de lancement configurés (⚙ pour les définir) — utile
 * pour un dossier de projet mis en favori.
 */
export default function FavoriteItem(props: {
  path: string
  active?: boolean
  onOpen: () => void
  onRemove: () => void
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
        title={t('Configurer les lancements')}
        className="hidden h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg group-hover:grid"
      >
        <Settings2 size={13} />
      </button>
      <LaunchButtons root={props.path} onConfigure={props.onConfig} />
      <button
        onClick={props.onRemove}
        title={t('Retirer des favoris')}
        className="hidden h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg group-hover:grid"
      >
        <X size={12} />
      </button>
    </div>
  )
}
