import { useEffect, useState } from 'react'
import { Wand2, X, Plus, Copy, FolderOpen, RefreshCw } from 'lucide-react'
import type { TidyAction, TidyConfig } from '@shared/types'
import { renderNameTemplate } from '@shared/tidy-actions'
import { t } from '../i18n'

/**
 * Bibliothèque des actions de rangement — ce qu'une règle fait du fichier
 * APRÈS l'avoir déplacé (renommer selon un modèle, attribuer des noms depuis
 * une liste…). Ouverte depuis le menu « Ensuite » d'une règle. Les actions
 * sont des données de l'utilisateur : éditables, duplicables, supprimables.
 */
interface Props {
  tidy: TidyConfig
  save: (next: TidyConfig) => void
  onClose: () => void
}

export default function TidyActionsDialog({ tidy, save, onClose }: Props): JSX.Element {
  const actions = tidy.actions ?? []
  // Contenu du dossier « Mes scripts » (créé + exemples au premier appel).
  const [scripts, setScripts] = useState<string[]>([])
  const loadScripts = (): void => {
    void window.api.tidy.listScripts?.().then((r) => setScripts(r.scripts))
  }
  useEffect(loadScripts, [])
  const patch = (i: number, p: Partial<TidyAction>): void =>
    save({ ...tidy, actions: actions.map((a, j) => (j === i ? { ...a, ...p } : a)) })
  const remove = (i: number): void =>
    save({
      ...tidy,
      actions: actions.filter((_, j) => j !== i),
      // Les règles qui pointaient sur l'action supprimée redeviennent « Rien de plus ».
      rules: tidy.rules.map((r) => (r.actionId === actions[i].id ? { ...r, actionId: undefined } : r))
    })
  const duplicate = (i: number): void => {
    const src = actions[i]
    const copy: TidyAction = {
      ...src,
      id: `action-${Date.now()}`,
      label: t('{label} (copie)', { label: src.label })
    }
    save({ ...tidy, actions: [...actions.slice(0, i + 1), copy, ...actions.slice(i + 1)] })
  }

  const field =
    'w-full rounded-app border border-border bg-bg-tertiary px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 flex max-h-[86vh] w-[min(520px,90vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Wand2 size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">{t('Actions de rangement')}</span>
          <button
            onClick={onClose}
            title={t('Fermer (Échap)')}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
          <p className="text-[11px] text-fg-muted">
            {t('Une action décrit quoi faire du fichier une fois rangé. Choisissez-la ensuite dans une règle, à l’étape « Ensuite ».')}
          </p>
          {actions.length === 0 && (
            <p className="rounded-app border border-dashed border-border px-3 py-3 text-center text-[11px] text-fg-muted">
              {t('Aucune action — ajoutez-en une ci-dessous.')}
            </p>
          )}
          {actions.map((a, i) => {
            const remaining = (a.names ?? []).map((n) => n.trim()).filter(Boolean).length
            return (
              <div key={a.id} className="flex flex-col gap-2 rounded-app border border-border bg-bg p-2.5">
                <div className="flex items-center gap-1.5">
                  <input
                    value={a.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                    placeholder={t('Nom de l’action')}
                    spellCheck={false}
                    className={`${field} flex-1 font-medium`}
                  />
                  <button
                    onClick={() => duplicate(i)}
                    title={t('Dupliquer cette action')}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    title={t('Supprimer cette action')}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg"
                  >
                    <X size={13} />
                  </button>
                </div>

                <select
                  value={a.kind}
                  onChange={(e) => patch(i, { kind: e.target.value as TidyAction['kind'] })}
                  className="w-full rounded-app border border-border bg-bg-tertiary px-2 py-1.5 text-[12px] text-fg outline-none focus:border-accent"
                >
                  <option value="rename">{t('Renommer selon un modèle')}</option>
                  <option value="nameList">{t('Attribuer des noms depuis une liste')}</option>
                  <option value="script">{t('Exécuter un script (dossier Mes scripts)')}</option>
                </select>

                {a.kind === 'rename' && (
                  <label className="flex flex-col gap-1">
                    <input
                      value={a.template ?? ''}
                      onChange={(e) => patch(i, { template: e.target.value })}
                      placeholder={t('ex. fichier_{n} ou {date} - {nom}')}
                      spellCheck={false}
                      className={`${field} font-mono text-[11px]`}
                    />
                    <span className="text-[10px] text-fg-muted">
                      {t('{n} = numéro qui augmente tout seul, {date} = date du jour, {nom} = nom d’origine. L’extension est conservée.')}
                    </span>
                    {a.template?.trim() ? (
                      <span className="rounded-app bg-bg-tertiary px-2 py-1.5 text-[11px] text-fg-secondary">
                        {t('Aperçu :')}{' '}
                        <code className="font-mono text-[10px] text-accent">
                          exemple.pdf →{' '}
                          {renderNameTemplate(a.template, 'exemple.pdf', a.counter ?? 1, new Date()) ||
                            'exemple'}
                          .pdf
                        </code>
                      </span>
                    ) : null}
                    {a.template?.includes('{n}') && (
                      <span className="flex items-center gap-1.5 text-[10px] text-fg-muted">
                        {t('Prochain numéro :')}
                        <input
                          type="number"
                          min={0}
                          value={a.counter ?? 1}
                          onChange={(e) => patch(i, { counter: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-16 rounded-app border border-border bg-bg-tertiary px-1.5 py-0.5 text-[11px] text-fg outline-none focus:border-accent"
                        />
                      </span>
                    )}
                  </label>
                )}

                {a.kind === 'script' && (
                  <label className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5">
                      <select
                        value={a.script ?? ''}
                        onChange={(e) => patch(i, { script: e.target.value || undefined })}
                        className="min-w-0 flex-1 rounded-app border border-border bg-bg-tertiary px-2 py-1.5 text-[12px] text-fg outline-none focus:border-accent"
                      >
                        <option value="">{t('Choisissez un script…')}</option>
                        {scripts.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        {a.script && !scripts.includes(a.script) && (
                          <option value={a.script}>{t('{name} (introuvable)', { name: a.script })}</option>
                        )}
                      </select>
                      <button
                        onClick={loadScripts}
                        title={t('Relire le dossier')}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-app border border-border text-fg-muted hover:bg-bg-hover hover:text-fg"
                      >
                        <RefreshCw size={12} />
                      </button>
                      <button
                        onClick={() => void window.api.tidy.openScripts?.()}
                        title={t('Ouvrir le dossier Mes scripts')}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-app border border-border text-fg-muted hover:bg-bg-hover hover:text-fg"
                      >
                        <FolderOpen size={12} />
                      </button>
                    </span>
                    <span className="text-[10px] text-fg-muted">
                      {t('Le script reçoit le chemin du fichier rangé. Déposez vos scripts (.ps1, .bat, .cmd, .sh, .js, .py) dans Documents\\GVue\\Scripts — des exemples commentés vous y attendent.')}
                    </span>
                    {a.script && !scripts.includes(a.script) && (
                      <span className="rounded-app bg-warning-bg px-2 py-1.5 text-[11px] text-warning-fg">
                        {t('⚠ Ce script n’existe plus dans le dossier : l’action ne fera rien.')}
                      </span>
                    )}
                  </label>
                )}

                {a.kind === 'nameList' && (
                  <label className="flex flex-col gap-1">
                    <textarea
                      defaultValue={(a.names ?? []).join('\n')}
                      onBlur={(e) =>
                        patch(i, { names: e.target.value.split('\n').map((n) => n.trim()).filter(Boolean) })
                      }
                      placeholder={t('Un nom par ligne — le premier sert au prochain fichier rangé.')}
                      spellCheck={false}
                      rows={5}
                      className={`${field} resize-y font-mono text-[11px]`}
                    />
                    <span className="text-[10px] text-fg-muted">
                      {t('Chaque fichier rangé prend le nom du haut de la liste, qui est ensuite retiré. Sans extension, celle du fichier est conservée. Restants : {n}.', { n: String(remaining) })}
                    </span>
                  </label>
                )}
              </div>
            )
          })}
          <button
            onClick={() =>
              save({
                ...tidy,
                actions: [
                  ...actions,
                  {
                    id: `action-${Date.now()}`,
                    label: t('Nouvelle action'),
                    kind: 'rename',
                    template: 'fichier_{n}',
                    counter: 1
                  }
                ]
              })
            }
            className="flex items-center gap-1.5 self-start rounded-app border border-border px-2.5 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
          >
            <Plus size={12} /> {t('Ajouter une action')}
          </button>
        </div>
      </div>
    </div>
  )
}
