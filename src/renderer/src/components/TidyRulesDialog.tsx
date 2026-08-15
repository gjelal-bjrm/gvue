import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Plus, FolderOpen } from 'lucide-react'
import type { TidyConfig } from '@shared/types'
import { useUiStore } from '../state/useUiStore'
import { useNavStore } from '../state/useNavStore'
import { useTidyStore } from '../state/useTidyStore'
import FilePickerDialog from './FilePickerDialog'
import TidyActionsDialog from './TidyActionsDialog'
import { parseExtensions, previewDestination, currentMonth } from '../lib/tidyText'
import { compileNamePattern } from '@shared/name-pattern'
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
  const downloads = useNavStore((s) => s.locations?.downloads ?? '')
  // Store partagé : même état que la sidebar, le bandeau et les Paramètres.
  const tidy = useTidyStore((s) => s.tidy)
  // Index de la règle dont on choisit la destination (sélecteur GVue, pas natif).
  const [pickingFor, setPickingFor] = useState<number | null>(null)
  // Bibliothèque des actions (« Ensuite, que faire du fichier ? »).
  const [actionsOpen, setActionsOpen] = useState(false)

  useEffect(() => {
    if (open) void useTidyStore.getState().load()
  }, [open])

  // Échap ferme la surcouche ouverte (sélecteur ou actions), sinon ce dialogue.
  const pickingRef = useRef<number | null>(null)
  pickingRef.current = pickingFor
  const actionsRef = useRef(false)
  actionsRef.current = actionsOpen
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (pickingRef.current !== null) setPickingFor(null)
      else if (actionsRef.current) setActionsOpen(false)
      else close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !tidy) return null

  const save = (next: TidyConfig): void => useTidyStore.getState().save(next)
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
          {tidy.rules.map((r, i) => {
            const sampleExt = r.extensions[0] || 'pdf'
            const knownSub = ['', '{date}', '{ext}', '{date}/{ext}'].includes(r.subfolder ?? '')
            // Une règle sans destination ne rangera JAMAIS rien : le dire fort.
            const incomplete = r.enabled && !r.destDir.trim()
            // Motif de nom invalide (regex mal formée) : la règle n'attrape rien.
            const badPattern = Boolean(
              r.namePattern?.trim() && !compileNamePattern(r.namePattern, r.nameIsRegex ?? false)
            )
            return (
              <div
                key={r.id}
                className={`flex flex-col gap-2 rounded-app border bg-bg p-2.5 ${
                  incomplete ? 'border-warning-fg' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <label
                    className="flex items-center gap-1.5 text-[11px] text-fg-secondary"
                    title={t('Décochez pour mettre cette règle en pause sans la supprimer')}
                  >
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => patchRule(i, { enabled: e.target.checked })}
                      className="accent-[var(--accent)]"
                    />
                    {t('Règle active')}
                  </label>
                  <button
                    onClick={() => save({ ...tidy, rules: tidy.rules.filter((_, j) => j !== i) })}
                    title={t('Supprimer cette règle')}
                    className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg"
                  >
                    <X size={13} />
                  </button>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-fg-secondary">{t('1. Quels fichiers ranger ?')}</span>
                  <input
                    defaultValue={r.extensions.join(', ')}
                    onBlur={(e) => patchRule(i, { extensions: parseExtensions(e.target.value) })}
                    placeholder={t('Tous les fichiers')}
                    spellCheck={false}
                    className={field}
                  />
                  <span className="text-[10px] text-fg-muted">
                    {t('Tapez les types séparés par des virgules (ex. pdf, jpg, zip). Laissez vide pour ranger tous les fichiers.')}
                  </span>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-[11px] text-fg-secondary">
                    {t('Et selon le nom ? (optionnel)')}
                    <label
                      className="ml-auto flex items-center gap-1 text-[10px] text-fg-muted"
                      title={t('Pour les experts : le motif est lu comme une expression régulière.')}
                    >
                      <input
                        type="checkbox"
                        checked={r.nameIsRegex ?? false}
                        onChange={(e) => patchRule(i, { nameIsRegex: e.target.checked })}
                        className="accent-[var(--accent)]"
                      />
                      {t('expression régulière')}
                    </label>
                  </span>
                  <input
                    defaultValue={r.namePattern ?? ''}
                    onBlur={(e) => patchRule(i, { namePattern: e.target.value.trim() })}
                    placeholder={t('ex. facture (contient) ou mn_* (commence par)')}
                    spellCheck={false}
                    className={`${field} font-mono text-[11px]`}
                  />
                  <span className="text-[10px] text-fg-muted">
                    {t('« facture » = le nom contient facture. « mn_* » = le nom commence par mn_. * remplace n’importe quoi, ? un seul caractère.')}
                  </span>
                </label>
                {badPattern && (
                  <p className="rounded-app bg-warning-bg px-2 py-1.5 text-[11px] text-warning-fg">
                    {t('⚠ Ce motif est invalide : la règle n’attrapera aucun fichier tant qu’il n’est pas corrigé.')}
                  </p>
                )}

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-fg-secondary">{t('2. Dans quel dossier les mettre ?')}</span>
                  <span className="flex items-center gap-1.5">
                    <input
                      value={r.destDir}
                      onChange={(e) => patchRule(i, { destDir: e.target.value })}
                      placeholder={t('Choisissez un dossier avec « Parcourir »')}
                      spellCheck={false}
                      className={`min-w-0 flex-1 ${field} font-mono text-[11px]`}
                    />
                    <button
                      onClick={() => setPickingFor(i)}
                      className="flex shrink-0 items-center gap-1 rounded-app border border-border px-2 py-1.5 text-[11px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
                    >
                      <FolderOpen size={12} /> {t('Parcourir…')}
                    </button>
                  </span>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-fg-secondary">{t('3. Créer un sous-dossier dedans ?')}</span>
                  <select
                    value={knownSub ? (r.subfolder ?? '') : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') patchRule(i, { subfolder: e.target.value })
                    }}
                    className="w-full rounded-app border border-border bg-bg-tertiary px-2 py-1.5 text-[12px] text-fg outline-none focus:border-accent"
                  >
                    <option value="">{t('Non — directement dans le dossier')}</option>
                    <option value="{date}">{t('Oui — un dossier par mois (ex. {sample})', { sample: currentMonth() })}</option>
                    <option value="{ext}">{t('Oui — un dossier par type de fichier (ex. {ext})', { ext: sampleExt })}</option>
                    <option value="{date}/{ext}">{t('Oui — par mois, puis par type')}</option>
                    {!knownSub && <option value="custom">{t('Personnalisé : {tpl}', { tpl: r.subfolder ?? '' })}</option>}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-fg-secondary">
                    {t('4. Ensuite, que faire du fichier ?')}
                  </span>
                  <select
                    value={r.actionId ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '::manage') setActionsOpen(true)
                      else patchRule(i, { actionId: e.target.value || undefined })
                    }}
                    className="w-full rounded-app border border-border bg-bg-tertiary px-2 py-1.5 text-[12px] text-fg outline-none focus:border-accent"
                  >
                    <option value="">{t('Rien de plus — juste le déplacer')}</option>
                    {(tidy.actions ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                    <option value="::manage">{t('➕ Créer ou modifier les actions…')}</option>
                  </select>
                </label>

                {incomplete ? (
                  <p className="rounded-app bg-warning-bg px-2 py-1.5 text-[11px] text-warning-fg">
                    {t('⚠ Cette règle ne fait rien encore : choisissez le dossier de destination (étape 2, bouton « Parcourir… »).')}
                  </p>
                ) : r.destDir.trim() ? (
                  <p className="rounded-app bg-bg-tertiary px-2 py-1.5 text-[11px] text-fg-secondary">
                    {t('Aperçu : « exemple.{ext} » ira dans', { ext: sampleExt })}{' '}
                    <code className="break-all font-mono text-[10px] text-accent">
                      {previewDestination(r.destDir.trim(), r.subfolder ?? '', sampleExt)}
                    </code>
                  </p>
                ) : null}
              </div>
            )
          })}
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
          {t('GVue attend qu’un téléchargement soit terminé avant de ranger le fichier, et Ctrl+Z annule le dernier rangement.')}
        </p>
      </div>

      {/* Bibliothèque des actions, par-dessus ce dialogue. */}
      {actionsOpen && (
        <div onMouseDown={(e) => e.stopPropagation()}>
          <TidyActionsDialog tidy={tidy} save={save} onClose={() => setActionsOpen(false)} />
        </div>
      )}

      {/* Choix de la destination avec l'explorateur de GVue — pas la boîte
          native : c'est le but du programme (demande utilisateur). */}
      {pickingFor !== null && tidy.rules[pickingFor] && (
        // stopPropagation : un clic dans le sélecteur ne doit pas remonter au
        // fond de CE dialogue (qui se fermerait avec).
        <div onMouseDown={(e) => e.stopPropagation()}>
          <FilePickerDialog
            mode="folder"
            initialDir={tidy.rules[pickingFor].destDir.trim() || downloads || tidy.watchDir || 'C:\\'}
            onPick={(dir) => {
              patchRule(pickingFor, { destDir: dir })
              setPickingFor(null)
            }}
            onClose={() => setPickingFor(null)}
          />
        </div>
      )}
    </div>
  )
}
