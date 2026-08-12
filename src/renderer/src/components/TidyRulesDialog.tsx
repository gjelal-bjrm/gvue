import { useEffect, useState } from 'react'
import { Sparkles, X, Plus } from 'lucide-react'
import type { TidyConfig } from '@shared/types'
import { useUiStore } from '../state/useUiStore'
import { parseExtensions } from '../lib/tidyText'
import { t } from '../i18n'

/**
 * Dialogue des règles du rangement automatique — ouvert depuis le bandeau du
 * dossier surveillé, l'item Téléchargements de la sidebar ou les Paramètres.
 * Comme le manager SSH : une pop-up dédiée, pas un détour par les Paramètres.
 * Chaque changement est persisté aussitôt (le main reconfigure le watcher).
 */
export default function TidyRulesDialog(): JSX.Element | null {
  const open = useUiStore((s) => s.tidyRulesOpen)
  const close = (): void => useUiStore.getState().setTidyRules(false)
  const [tidy, setTidy] = useState<TidyConfig | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    void window.api.config
      .get('tidy')
      .then((v) => alive && setTidy(v ?? { enabled: false, watchDir: '', rules: [] }))
      .catch(() => alive && setTidy({ enabled: false, watchDir: '', rules: [] }))
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !tidy) return null

  const save = (next: TidyConfig): void => {
    setTidy(next)
    void window.api.config.set('tidy', next)
  }
  const patchRule = (i: number, patch: Partial<TidyConfig['rules'][number]>): void =>
    save({ ...tidy, rules: tidy.rules.map((x, j) => (j === i ? { ...x, ...patch } : x)) })

  const field =
    'w-full rounded-app border border-border bg-bg-tertiary px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 flex max-h-[86vh] w-[min(540px,92vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles size={15} className={tidy.enabled ? 'text-accent' : 'text-fg-muted'} />
          <span className="text-[13px] font-medium text-fg">
            {t('Rangement auto des téléchargements')}
          </span>
          <button
            onClick={() => save({ ...tidy, enabled: !tidy.enabled })}
            className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] ${
              tidy.enabled
                ? 'bg-accent-soft text-accent'
                : 'border border-border text-fg-muted hover:bg-bg-hover hover:text-fg'
            }`}
          >
            {tidy.enabled ? t('Activé') : t('Désactivé')}
          </button>
          <button
            onClick={close}
            title={t('Fermer (Échap)')}
            className="grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-fg">{t('Dossier surveillé')}</span>
            <input
              value={tidy.watchDir}
              onChange={(e) => save({ ...tidy, watchDir: e.target.value })}
              placeholder={t('Vide = dossier Téléchargements')}
              spellCheck={false}
              className={`${field} font-mono text-[11px]`}
            />
          </label>

          <span className="mt-1 text-[12px] text-fg">{t('Règles (la première qui correspond gagne)')}</span>
          {tidy.rules.length === 0 && (
            <p className="rounded-app border border-dashed border-border px-3 py-3 text-center text-[11px] text-fg-muted">
              {t('Aucune règle — ajoutez-en une pour que le rangement agisse.')}
            </p>
          )}
          {tidy.rules.map((r, i) => (
            <div key={r.id} className="flex flex-col gap-1.5 rounded-app border border-border bg-bg p-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  title={t('Règle active')}
                  onChange={(e) => patchRule(i, { enabled: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <input
                  defaultValue={r.extensions.join(', ')}
                  onBlur={(e) => patchRule(i, { extensions: parseExtensions(e.target.value) })}
                  placeholder={t('pdf, zip — vide = tous')}
                  spellCheck={false}
                  className={`min-w-0 flex-1 ${field}`}
                />
                <button
                  onClick={() => save({ ...tidy, rules: tidy.rules.filter((_, j) => j !== i) })}
                  title={t('Supprimer cette règle')}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg"
                >
                  <X size={13} />
                </button>
              </div>
              <input
                value={r.destDir}
                onChange={(e) => patchRule(i, { destDir: e.target.value })}
                placeholder={t('Destination — ex. D:\\Documents\\Factures')}
                spellCheck={false}
                className={`${field} font-mono text-[11px]`}
              />
              <input
                value={r.subfolder ?? ''}
                onChange={(e) => patchRule(i, { subfolder: e.target.value })}
                placeholder={t('Sous-dossier (facultatif) — gabarits {date}, {ext}')}
                spellCheck={false}
                className={`${field} font-mono text-[11px]`}
              />
            </div>
          ))}
          <button
            onClick={() =>
              save({
                ...tidy,
                rules: [
                  ...tidy.rules,
                  { id: `rule-${Date.now()}`, enabled: true, extensions: [], destDir: '', subfolder: '' }
                ]
              })
            }
            className="flex items-center gap-1.5 self-start rounded-app border border-border px-2.5 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
          >
            <Plus size={12} /> {t('Ajouter une règle')}
          </button>
        </div>

        <p className="shrink-0 border-t border-border px-4 py-2.5 text-[11px] text-fg-muted">
          {t('Jamais un téléchargement en cours ; chaque déplacement est annulable (Ctrl+Z). Exemple : « pdf » → D:\\Docs, sous-dossier {date} → D:\\Docs\\2026-08\\facture.pdf.')}
        </p>
      </div>
    </div>
  )
}
