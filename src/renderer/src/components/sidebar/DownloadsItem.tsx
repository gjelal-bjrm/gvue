import { Download, Sparkles, Settings2 } from 'lucide-react'
import { useUiStore } from '../../state/useUiStore'
import { useTidyStore } from '../../state/useTidyStore'
import { t } from '../../i18n'

/**
 * Entrée « Téléchargements » de la sidebar — même apparence que Item, plus
 * les raccourcis du rangement auto au survol : bascule directe et accès aux
 * règles (demande utilisateur : piloter la fonction depuis le dossier).
 * Un point accent signale en permanence que le rangement est actif.
 */
export default function DownloadsItem(props: {
  active?: boolean
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}): JSX.Element {
  // Store partagé : même état que le bandeau, le dialogue et les Paramètres.
  const tidy = useTidyStore((s) => s.tidy)

  const toggle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!tidy) return
    useTidyStore.getState().setEnabled(!tidy.enabled)
  }

  return (
    <button
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
      title={t('Téléchargements')}
      className={`group flex items-center gap-2.5 rounded-app px-2 py-[var(--row-pad)] text-left transition-colors ${
        props.active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
      }`}
    >
      <span className="relative shrink-0">
        <Download size={16} />
        {tidy?.enabled && (
          // Point vert = fonctionne vraiment ; AMBRE = activé mais aucune
          // règle complète (destination manquante) : rien ne sera rangé.
          <span
            title={
              tidy.rules.some((r) => r.enabled && r.destDir.trim())
                ? t('Rangement auto actif')
                : t('Rangement auto activé mais sans règle complète — ouvrez les règles')
            }
            className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${
              tidy.rules.some((r) => r.enabled && r.destDir.trim()) ? 'bg-accent' : 'bg-warning-fg'
            }`}
          />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{t('Téléchargements')}</span>

      {tidy && (
        <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <span
            role="button"
            onClick={toggle}
            title={tidy.enabled ? t('Désactiver le rangement auto') : t('Activer le rangement auto')}
            className={`grid h-6 w-6 place-items-center rounded hover:bg-bg-hover ${
              tidy.enabled ? 'text-accent' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Sparkles size={13} />
          </span>
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              useUiStore.getState().setTidyRules(true)
            }}
            title={t('Règles de rangement…')}
            className="grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <Settings2 size={13} />
          </span>
        </span>
      )}
    </button>
  )
}
