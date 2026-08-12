import { Sparkles, Settings2 } from 'lucide-react'
import { useNavStore } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'
import { useTidyStore } from '../state/useTidyStore'
import { pathKey } from '../lib/format'
import { t, tn } from '../i18n'

/**
 * Bandeau « Rangement auto » affiché UNIQUEMENT dans le dossier surveillé
 * (Téléchargements par défaut) : activer/désactiver et ouvrir les règles sans
 * passer par les Paramètres — la fonctionnalité se pilote là où elle agit.
 */
export default function TidyBanner(props: { dir: string }): JSX.Element | null {
  const downloads = useNavStore((s) => s.locations?.downloads ?? '')
  // Store partagé : basculer depuis la sidebar, le tray ou les Paramètres
  // met ce bandeau à jour instantanément (fini les copies désynchronisées).
  const tidy = useTidyStore((s) => s.tidy)

  if (!tidy) return null
  const watched = tidy.watchDir.trim() || downloads
  if (!watched || pathKey(props.dir) !== pathKey(watched)) return null

  const toggle = (): void => {
    useTidyStore.getState().setEnabled(!tidy.enabled)
  }
  const activeRules = tidy.rules.filter((r) => r.enabled && r.destDir.trim()).length
  // Activé mais aucune règle COMPLÈTE : le rangement ne fait rien — le dire
  // en avertissement cliquable, pas en pastille rassurante.
  const broken = tidy.enabled && activeRules === 0

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-bg-secondary px-3 py-1.5 text-[11px]">
      <Sparkles size={13} className={tidy.enabled ? (broken ? 'text-warning-fg' : 'text-accent') : 'text-fg-muted'} />
      <span className="text-fg-secondary">{t('Rangement auto')}</span>
      <button
        onClick={() => useUiStore.getState().setTidyRules(true)}
        className={`rounded-full px-1.5 leading-[16px] ${
          broken
            ? 'bg-warning-bg text-warning-fg'
            : tidy.enabled
              ? 'bg-accent-soft text-accent'
              : 'border border-border text-fg-muted'
        }`}
      >
        {tidy.enabled
          ? broken
            ? tidy.rules.length > 0
              ? t('actif — règle incomplète, cliquez ici')
              : t('actif — aucune règle, cliquez ici')
            : tn(activeRules, 'actif · {n} règle', 'actif · {n} règles')
          : t('désactivé')}
      </button>
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
          onClick={() => useUiStore.getState().setTidyRules(true)}
          title={t('Modifier les règles de rangement')}
          className="flex items-center gap-1 rounded-app border border-border px-2 py-0.5 text-fg-secondary hover:bg-bg-hover hover:text-fg"
        >
          <Settings2 size={11} /> {t('Règles…')}
        </button>
      </span>
    </div>
  )
}
