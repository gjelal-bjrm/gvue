import { useState } from 'react'
import { LayoutGrid, Save, Trash2, SaveAll, Check } from 'lucide-react'
import { useWorkspaceStore } from '../state/useWorkspaceStore'

/**
 * Bouton + popover des espaces de travail : liste (charger / supprimer) et
 * enregistrement de la disposition courante sous un nom.
 */
export default function WorkspaceMenu(): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const save = useWorkspaceStore((s) => s.save)
  const load = useWorkspaceStore((s) => s.load)
  const remove = useWorkspaceStore((s) => s.remove)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  const names = Object.keys(workspaces)
  // Réenregistre la disposition actuelle dans un espace existant (écrase).
  const onOverwrite = (n: string): void => {
    save(n)
    setSaved(n)
    setTimeout(() => setSaved((s) => (s === n ? null : s)), 1200)
  }
  const onSave = (): void => {
    if (!name.trim()) return
    save(name)
    setName('')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Espaces de travail"
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-app transition-colors hover:bg-bg-hover ${
          open ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:text-fg'
        }`}
      >
        <LayoutGrid size={17} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-app border border-border bg-bg-secondary p-2 text-[12px] shadow-lg">
            <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
              Espaces de travail
            </div>
            {names.length === 0 ? (
              <p className="px-1 py-1.5 text-fg-muted">
                Aucun. Enregistrez votre disposition actuelle ci-dessous.
              </p>
            ) : (
              <div className="mb-2 flex max-h-64 flex-col overflow-auto">
                {names.map((n) => (
                  <div key={n} className="group flex items-center gap-1 rounded-app pr-1 hover:bg-bg-hover">
                    <button
                      onClick={() => {
                        void load(n)
                        setOpen(false)
                      }}
                      title={`Charger « ${n} »`}
                      className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-fg-secondary hover:text-fg"
                    >
                      {n}
                    </button>
                    <button
                      onClick={() => onOverwrite(n)}
                      title="Réenregistrer (écraser avec la disposition actuelle)"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-accent group-hover:opacity-100"
                    >
                      {saved === n ? <Check size={13} className="text-accent" /> : <SaveAll size={13} />}
                    </button>
                    <button
                      onClick={() => remove(n)}
                      title="Supprimer cet espace"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5 border-t border-border pt-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave()
                }}
                placeholder="Nom de l'espace…"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
              />
              <button
                onClick={onSave}
                disabled={!name.trim()}
                title="Enregistrer la disposition actuelle"
                className="flex shrink-0 items-center rounded-app bg-accent px-2.5 text-white hover:opacity-90 disabled:opacity-40"
              >
                <Save size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
