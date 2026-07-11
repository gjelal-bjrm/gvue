import { useState } from 'react'
import { TerminalSquare, X, Plus, Trash2, Pencil } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useCustomCommandsStore } from '../state/useCustomCommandsStore'
import type { CustomCommand } from '@shared/types'

const TARGET_LABEL: Record<CustomCommand['target'], string> = {
  file: 'Fichiers',
  directory: 'Dossiers',
  both: 'Les deux'
}

/**
 * Gestionnaire des commandes personnalisées : actions ajoutées au menu
 * contextuel (« Commandes ▸ »), exécutées dans le terminal intégré, avec
 * jetons {path} {dir} {name} {stem} {ext}.
 */
export default function CustomCommandsDialog(): JSX.Element | null {
  const open = useUiStore((s) => s.customCmdOpen)
  const commands = useCustomCommandsStore((s) => s.commands)
  const save = useCustomCommandsStore((s) => s.save)

  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [target, setTarget] = useState<CustomCommand['target']>('both')

  if (!open) return null
  const close = (): void => useUiStore.getState().setCustomCmd(false)

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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[82vh] w-[min(640px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <TerminalSquare size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">Commandes personnalisées</span>
          <button
            onClick={close}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-2 text-[12px]">
          {commands.length === 0 ? (
            <p className="py-3 text-center text-fg-muted">
              Aucune commande — ajoute la première ci-dessous. Elle apparaîtra dans le menu
              contextuel (« Commandes ▸ ») et s'exécutera dans le terminal intégré.
            </p>
          ) : (
            commands.map((c) => (
              <div key={c.id} className="group flex items-center gap-2 rounded-app px-2 py-1.5 hover:bg-bg-hover">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fg">{c.name}</span>
                  <span className="block truncate font-mono text-[11px] text-fg-muted" title={c.command}>
                    {c.command}
                  </span>
                </span>
                <span className="shrink-0 rounded border border-border px-1.5 text-[10px] text-fg-muted">
                  {TARGET_LABEL[c.target]}
                </span>
                <button
                  onClick={() => edit(c)}
                  title="Modifier"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => {
                    save(commands.filter((x) => x.id !== c.id))
                    if (editing === c.id) reset()
                  }}
                  title="Supprimer"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Formulaire ajout / édition */}
        <div className="shrink-0 space-y-2 border-t border-border px-4 py-3 text-[12px]">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom (ex. Ouvrir dans WSL)"
              spellCheck={false}
              className="w-48 rounded-app border border-border bg-bg px-2 py-1.5 text-fg outline-none placeholder:text-fg-muted focus:border-accent"
            />
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as CustomCommand['target'])}
              className="rounded-app border border-border bg-bg px-2 py-1.5 text-fg outline-none focus:border-accent"
            >
              <option value="both">Fichiers et dossiers</option>
              <option value="file">Fichiers seulement</option>
              <option value="directory">Dossiers seulement</option>
            </select>
          </div>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder='Commande — ex. code "{path}"  ·  git log --oneline -- "{name}"'
            spellCheck={false}
            className="w-full rounded-app border border-border bg-bg px-2 py-1.5 font-mono text-fg outline-none placeholder:text-fg-muted focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
              Jetons : <code>{'{path}'}</code> chemin · <code>{'{dir}'}</code> dossier ·{' '}
              <code>{'{name}'}</code> nom · <code>{'{stem}'}</code> sans ext. ·{' '}
              <code>{'{ext}'}</code> ext. — guillemets à mettre dans le modèle.
            </p>
            {editing && (
              <button onClick={reset} className="shrink-0 rounded-app px-2 py-1 text-fg-secondary hover:bg-bg-hover">
                Annuler l'édition
              </button>
            )}
            <button
              onClick={submit}
              disabled={!name.trim() || !command.trim()}
              className="flex shrink-0 items-center gap-1 rounded-app bg-accent px-2.5 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              <Plus size={13} /> {editing ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
