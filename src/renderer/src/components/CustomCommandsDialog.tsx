import { useState } from 'react'
import { TerminalSquare, X, Plus, Trash2, Pencil, HelpCircle, MousePointerClick } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useCustomCommandsStore } from '../state/useCustomCommandsStore'
import type { CustomCommand } from '@shared/types'
import { t } from '../i18n'

const TARGET_LABEL: Record<CustomCommand['target'], string> = {
  file: 'Fichiers',
  directory: 'Dossiers',
  both: 'Les deux'
}

/**
 * Jetons disponibles, pour le tableau d'aide — construits en fonction (et non
 * en constante de module) pour que `t()` s'exécute APRÈS `initLang()`, une
 * fois la langue effective connue.
 */
function tokens(): [string, string, string][] {
  return [
    ['{path}', t('Chemin complet'), 'C:\\Dev\\app\\src\\main.ts'],
    ['{dir}', t("Dossier d'exécution"), 'C:\\Dev\\app\\src'],
    ['{name}', t('Nom avec extension'), 'main.ts'],
    ['{stem}', t('Nom sans extension'), 'main'],
    ['{ext}', t('Extension sans point'), 'ts']
  ]
}

/** Exemples prêts à l'emploi : un clic pré-remplit le formulaire (même raison : fonction, pas constante). */
function examples(): (CustomCommand & { hint: string })[] {
  return [
    {
      id: 'ex1',
      name: t('Ouvrir dans VS Code'),
      command: 'code "{path}"',
      target: 'both',
      hint: t('Ouvre le fichier ou le dossier dans VS Code.')
    },
    {
      id: 'ex2',
      name: t('Historique du fichier'),
      command: 'git log --oneline -10 -- "{name}"',
      target: 'file',
      hint: t('Les 10 derniers commits qui touchent ce fichier.')
    },
    {
      id: 'ex3',
      name: t('npm install ici'),
      command: 'npm install',
      target: 'directory',
      hint: t('Installe les dépendances dans le dossier cliqué.')
    },
    {
      id: 'ex4',
      name: t('Convertir en MP4'),
      command: 'ffmpeg -i "{path}" "{stem}.mp4"',
      target: 'file',
      hint: t('Conversion vidéo à côté de l’original (nécessite ffmpeg).')
    },
    {
      id: 'ex5',
      name: t('Taille du dossier'),
      command: 'du -sh . 2>nul || powershell -c "(gci -r | measure Length -Sum).Sum / 1MB"',
      target: 'directory',
      hint: t('Affiche la taille totale du dossier dans le terminal.')
    }
  ]
}

/**
 * Gestionnaire des commandes personnalisées : actions ajoutées au menu
 * contextuel (« Commandes ▸ »), exécutées dans le terminal intégré, dans le
 * dossier de l'élément cliqué, avec substitution des jetons.
 */
export default function CustomCommandsDialog(): JSX.Element | null {
  const open = useUiStore((s) => s.customCmdOpen)
  const commands = useCustomCommandsStore((s) => s.commands)
  const save = useCustomCommandsStore((s) => s.save)

  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [target, setTarget] = useState<CustomCommand['target']>('both')
  const [showHelp, setShowHelp] = useState(false)

  if (!open) return null
  const TOKENS = tokens()
  const EXAMPLES = examples()
  const close = (): void => useUiStore.getState().setCustomCmd(false)
  const helpVisible = showHelp || commands.length === 0

  const reset = (): void => {
    setEditing(null)
    setName('')
    setCommand('')
    setTarget('both')
  }

  const submit = (): void => {
    const n = name.trim()
    const c = command.trim()
    if (!n || !c) return
    if (editing) {
      save(commands.map((x) => (x.id === editing ? { ...x, name: n, command: c, target } : x)))
    } else {
      save([...commands, { id: `cmd-${Date.now().toString(36)}`, name: n, command: c, target }])
    }
    reset()
  }

  const edit = (c: CustomCommand): void => {
    setEditing(c.id)
    setName(c.name)
    setCommand(c.command)
    setTarget(c.target)
  }

  const useExample = (ex: CustomCommand): void => {
    setEditing(null)
    setName(ex.name)
    setCommand(ex.command)
    setTarget(ex.target)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[86vh] w-[min(720px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <TerminalSquare size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">{t('Commandes personnalisées')}</span>
          <button
            onClick={() => setShowHelp((v) => !v)}
            title={t('Comment ça marche ?')}
            className={`grid h-6 w-6 place-items-center rounded hover:bg-bg-hover ${
              helpVisible ? 'text-accent' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <HelpCircle size={14} />
          </button>
          <button
            onClick={close}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-[12px]">
          {/* Tutoriel (toujours affiché tant qu'il n'y a aucune commande) */}
          {helpVisible && (
            <div className="mb-4 rounded-app border border-border bg-bg p-3">
              <p className="mb-2 font-medium text-fg">{t('Comment ça marche ?')}</p>
              <ol className="mb-3 list-inside list-decimal space-y-1 text-fg-secondary">
                <li>
                  {t('Définis un')} <b>{t('nom')}</b>
                  {t(', une')} <b>{t('commande shell')}</b> {t('et sa')} <b>{t('cible')}</b>{' '}
                  {t('(fichiers, dossiers, ou les deux) ci-dessous.')}
                </li>
                <li>
                  {t('Fais un')} <b>{t('clic droit')}</b>{' '}
                  {t('sur un fichier/dossier → sous-menu')}{' '}
                  <b>{t('« Commandes ▸ »')}</b> {t('→ ta commande.')}
                </li>
                <li>
                  {t("Elle s'exécute dans le")} <b>{t('terminal intégré')}</b>
                  {t(", dans le dossier de l'élément (le parent pour un fichier, le dossier lui-même sinon), avec les jetons remplacés.")}
                </li>
              </ol>
              <p className="mb-1 font-medium text-fg">{t('Jetons disponibles')}</p>
              <div className="mb-2 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <tbody>
                    {TOKENS.map(([tok, desc, ex]) => (
                      <tr key={tok} className="border-b border-border/60 last:border-0">
                        <td className="py-1 pr-3 font-mono text-accent">{tok}</td>
                        <td className="py-1 pr-3 text-fg-secondary">{desc}</td>
                        <td className="py-1 font-mono text-fg-muted">{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-fg-muted">
                {t('Astuce : entoure les jetons de guillemets —')} <code>code "{'{path}'}"</code>{' '}
                {t("— pour les chemins contenant des espaces. Les commandes « cmd /c … » s'exécutent automatiquement dans cmd.")}
              </p>
            </div>
          )}

          {/* Exemples cliquables */}
          {helpVisible && (
            <div className="mb-4">
              <p className="mb-1.5 flex items-center gap-1.5 font-medium text-fg">
                <MousePointerClick size={13} className="text-accent" />
                {t('Exemples — un clic pré-remplit le formulaire')}
              </p>
              <div className="flex flex-col gap-1">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => useExample(ex)}
                    title={ex.hint}
                    className="flex items-center gap-2 rounded-app border border-border bg-bg px-2 py-1.5 text-left hover:border-accent hover:bg-bg-hover"
                  >
                    <span className="w-40 shrink-0 truncate text-fg">{ex.name}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-muted">
                      {ex.command}
                    </span>
                    <span className="shrink-0 rounded border border-border px-1.5 text-[10px] text-fg-muted">
                      {t(TARGET_LABEL[ex.target])}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Commandes existantes */}
          {commands.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <p className="mb-1 font-medium text-fg">{t('Tes commandes')}</p>
              {commands.map((c) => (
                <div key={c.id} className="group flex items-center gap-2 rounded-app px-2 py-1.5 hover:bg-bg-hover">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{c.name}</span>
                    <span className="block truncate font-mono text-[11px] text-fg-muted" title={c.command}>
                      {c.command}
                    </span>
                  </span>
                  <span className="shrink-0 rounded border border-border px-1.5 text-[10px] text-fg-muted">
                    {t(TARGET_LABEL[c.target])}
                  </span>
                  <button
                    onClick={() => edit(c)}
                    title={t('Modifier')}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      save(commands.filter((x) => x.id !== c.id))
                      if (editing === c.id) reset()
                    }}
                    title={t('Supprimer')}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulaire ajout / édition */}
        <div className="shrink-0 space-y-2 border-t border-border px-4 py-3 text-[12px]">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Nom (ex. Ouvrir dans VS Code)')}
              spellCheck={false}
              className="w-48 rounded-app border border-border bg-bg px-2 py-1.5 text-fg outline-none placeholder:text-fg-muted focus:border-accent"
            />
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as CustomCommand['target'])}
              className="rounded-app border border-border bg-bg px-2 py-1.5 text-fg outline-none focus:border-accent"
            >
              <option value="both">{t('Fichiers et dossiers')}</option>
              <option value="file">{t('Fichiers seulement')}</option>
              <option value="directory">{t('Dossiers seulement')}</option>
            </select>
          </div>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder={t('Commande — ex. code "{path}"')}
            spellCheck={false}
            className="w-full rounded-app border border-border bg-bg px-2 py-1.5 font-mono text-fg outline-none placeholder:text-fg-muted focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
              {t('Jetons :')} <code>{'{path}'}</code> · <code>{'{dir}'}</code> ·{' '}
              <code>{'{name}'}</code> · <code>{'{stem}'}</code> · <code>{'{ext}'}</code>{' '}
              {t('— détails via')}{' '}
              <HelpCircle size={11} className="inline" />
            </p>
            {editing && (
              <button onClick={reset} className="shrink-0 rounded-app px-2 py-1 text-fg-secondary hover:bg-bg-hover">
                {t("Annuler l'édition")}
              </button>
            )}
            <button
              onClick={submit}
              disabled={!name.trim() || !command.trim()}
              className="flex shrink-0 items-center gap-1 rounded-app bg-accent px-2.5 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              <Plus size={13} /> {editing ? t('Enregistrer') : t('Ajouter')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
