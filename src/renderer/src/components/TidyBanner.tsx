import { useEffect, useState } from 'react'
import { Sparkles, Settings2 } from 'lucide-react'
import type { TidyConfig } from '@shared/types'
import { useNavStore } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'
import { pathKey } from '../lib/format'
import { t, tn } from '../i18n'

/**
 * Bandeau « Rangement auto » affiché UNIQUEMENT dans le dossier surveillé
 * (Téléchargements par défaut) : activer/désactiver et ouvrir les règles sans
 * passer par les Paramètres — la fonctionnalité se pilote là où elle agit.
 */
export default function TidyBanner(props: { dir: string }): JSX.Element | null {
  const downloads = useNavStore((s) => s.locations?.downloads ?? '')
  const [tidy, setTidy] = useState<TidyConfig | null>(null)

  // Recharge à chaque retour dans le dossier (la config a pu changer via les
  // Paramètres ou le tray — pas de canal réactif, la relecture suffit ici).
  useEffect(() => {
    let alive = true
    void window.api.config
      .get('tidy')
      .then((v) => alive && setTidy(v ?? { enabled: false, watchDir: '', rules: [] }))
      .catch(() => alive && setTidy(null))
    return () => {
      alive = false
    }
  }, [props.dir])

  if (!tidy) return null
  const watched = tidy.watchDir.trim() || downloads
  if (!watched || pathKey(props.dir) !== pathKey(watched)) return null

  const toggle = (): void => {
    const next = { ...tidy, enabled: !tidy.enabled }
    setTidy(next)
    void window.api.config.set('tidy', next)
  }
  const activeRules = tidy.rules.filter((r) => r.enabled && r.destDir.trim()).length

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-bg-secondary px-3 py-1.5 text-[11px]">
      <Sparkles size={13} className={tidy.enabled ? 'text-accent' : 'text-fg-muted'} />
      <span className="text-fg-secondary">{t('Rangement auto')}</span>
      <span
        className={`rounded-full px-1.5 leading-[16px] ${
          tidy.enabled ? 'bg-accent-soft text-accent' : 'border border-border text-fg-muted'
        }`}
      >
        {tidy.enabled
          ? activeRules > 0
            ? tn(activeRules, 'actif · {n} règle', 'actif · {n} règles')
            : t('actif — aucune règle')
          : t('désactivé')}
      </span>
      <span className="ml-auto flex items-center gap-1">
        <button
          onClick={toggle}
          className={`rounded-app px-2 py-0.5 ${
            tidy.enabled
              ? 'border border-border text-fg-secondary hover:bg-bg-hover'
              : 'bg-accent font-medium text-white hover:opacity-90'
          }`}
        >
          {tidy.enabled ? t('Désactiver') : t('Activer')}
        </button>
        <button
          onClick={() => useUiStore.getState().openSettings('general')}
          title={t('Modifier les règles de rangement')}
          className="flex items-center gap-1 rounded-app border border-border px-2 py-0.5 text-fg-secondary hover:bg-bg-hover hover:text-fg"
        >
          <Settings2 size={11} /> {t('Règles…')}
        </button>
      </span>
    </div>
  )
}
