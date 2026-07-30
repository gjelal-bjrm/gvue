import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { SshHost } from '@shared/types'

/** Petit formulaire inline d'ajout d'un serveur SSH manuel. */
export default function ServerAddForm(props: {
  onAdd: (host: SshHost) => void
  onClose: () => void
}): JSX.Element {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [port, setPort] = useState('')

  const submit = (): void => {
    // Cible « user@hôte » ou « hôte » ; le libellé retombe sur l'hôte si vide.
    const t = target.trim()
    if (!t) return
    const at = t.indexOf('@')
    const user = at > 0 ? t.slice(0, at) : undefined
    const hostName = at > 0 ? t.slice(at + 1) : t
    if (!hostName) return
    const p = Number(port)
    props.onAdd({
      name: name.trim() || hostName,
      source: 'manual',
      hostName,
      user,
      port: Number.isInteger(p) && p > 0 && p < 65536 ? p : undefined
    })
    props.onClose()
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') submit()
    if (e.key === 'Escape') props.onClose()
  }

  const field =
    'w-full rounded-app border border-border bg-bg px-2 py-1 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent'

  return (
    <div className="mx-1 mb-1 flex flex-col gap-1 rounded-app border border-accent bg-bg p-1.5">
      <input
        autoFocus
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        onKeyDown={onKey}
        placeholder="user@serveur.exemple.com"
        spellCheck={false}
        className={field}
      />
      <div className="flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKey}
          placeholder="Libellé (optionnel)"
          spellCheck={false}
          className={field}
        />
        <input
          value={port}
          onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
          onKeyDown={onKey}
          placeholder="22"
          spellCheck={false}
          className={`${field} w-14 shrink-0 text-center`}
        />
      </div>
      <div className="flex gap-1">
        <button
          onClick={submit}
          disabled={!target.trim()}
          className="flex flex-1 items-center justify-center gap-1 rounded-app bg-accent px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          <Check size={12} /> Ajouter
        </button>
        <button
          onClick={props.onClose}
          className="flex flex-1 items-center justify-center gap-1 rounded-app border border-border px-2 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover"
        >
          <X size={12} /> Annuler
        </button>
      </div>
    </div>
  )
}
