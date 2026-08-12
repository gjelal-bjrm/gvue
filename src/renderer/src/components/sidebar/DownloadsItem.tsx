import { useEffect, useState } from 'react'
import { Download, Sparkles, Settings2 } from 'lucide-react'
import type { TidyConfig } from '@shared/types'
import { useUiStore } from '../../state/useUiStore'
import { readTidy, setTidyEnabled } from '../../lib/tidyConfig'
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
  // Rechargé aussi à la fermeture du dialogue des règles (état à jour).
  const rulesOpen = useUiStore((s) => s.tidyRulesOpen)
  const [tidy, setTidy] = useState<TidyConfig | null>(null)

  useEffect(() => {
    let alive = true
    void readTidy().then((v) => alive && setTidy(v))
    return () => {
      alive = false
    }
  }, [rulesOpen])

  // Bascule sur l'état FRAIS (jamais l'objet local, qui peut être périmé et
  // écraserait les règles éditées ailleurs — le watcher ne démarrait pas).
  const toggle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!tidy) return
    void setTidyEnabled(!tidy.enabled).then(setTidy)
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
          <span
            title={t('Rangement auto actif')}
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent"
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
