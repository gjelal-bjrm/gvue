import { useState } from 'react'
import {
  GitBranch,
  ChevronDown,
  Check,
  Plus,
  DownloadCloud,
  ArrowDown,
  ArrowUp,
  RotateCw,
  X
} from 'lucide-react'
import type { GitBranches } from '@shared/types'

/**
 * Barre du haut de la vue Git : sélecteur/créateur de branche, Fetch/Pull/Push,
 * rafraîchir et fermer. L'état du menu déroulant vit ici.
 */
export default function BranchBar(props: {
  repo: { branch: string; ahead: number; behind: number }
  branches: GitBranches
  busy: boolean
  onCheckout: (branch: string) => void
  onCreateBranch: (name: string) => void
  onFetch: () => void
  onPull: () => void
  onPush: () => void
  onRefresh: () => void
  onClose: () => void
}): JSX.Element {
  const { repo, branches } = props
  const [branchMenu, setBranchMenu] = useState(false)
  const [newBranch, setNewBranch] = useState('')

  const createBranch = (): void => {
    const name = newBranch.trim()
    if (!name) return
    setBranchMenu(false)
    setNewBranch('')
    props.onCreateBranch(name)
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
      <div className="relative">
        <button
          onClick={() => setBranchMenu((o) => !o)}
          className="flex items-center gap-1.5 rounded-app border border-border px-2 py-1 text-[12px] text-fg hover:bg-bg-hover"
          title="Changer de branche"
        >
          <GitBranch size={14} className="text-accent" />
          <span className="max-w-[180px] truncate">{repo.branch}</span>
          <ChevronDown size={12} className="text-fg-muted" />
        </button>
        {branchMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setBranchMenu(false)} />
            <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-app border border-border bg-bg-secondary p-1 shadow-lg">
              <div className="max-h-60 overflow-auto">
                {branches.all.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      setBranchMenu(false)
                      if (b !== branches.current) props.onCheckout(b)
                    }}
                    className={`flex w-full items-center gap-1.5 rounded-app px-2 py-1.5 text-left text-[12px] hover:bg-bg-hover ${
                      b === branches.current ? 'text-accent' : 'text-fg-secondary'
                    }`}
                  >
                    <GitBranch size={12} />
                    <span className="min-w-0 flex-1 truncate">{b}</span>
                    {b === branches.current && <Check size={12} />}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex gap-1 border-t border-border pt-1">
                <input
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createBranch()
                  }}
                  placeholder="Nouvelle branche…"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-app border border-border bg-bg px-2 py-1 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
                />
                <button
                  onClick={createBranch}
                  title="Créer la branche"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-app bg-accent text-white hover:opacity-90"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <HeaderBtn onClick={props.onFetch} disabled={props.busy} label="Fetch">
        <DownloadCloud size={14} /> Fetch
      </HeaderBtn>
      <HeaderBtn onClick={props.onPull} disabled={props.busy} label="Pull">
        <ArrowDown size={14} /> Pull{repo.behind > 0 ? ` ${repo.behind}` : ''}
      </HeaderBtn>
      <HeaderBtn onClick={props.onPush} disabled={props.busy} label="Push">
        <ArrowUp size={14} /> Push{repo.ahead > 0 ? ` ${repo.ahead}` : ''}
      </HeaderBtn>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={props.onRefresh}
          title="Rafraîchir"
          className="grid h-7 w-7 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <RotateCw size={14} />
        </button>
        <button
          onClick={props.onClose}
          title="Fermer la vue Git"
          className="grid h-7 w-7 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

function HeaderBtn(props: {
  onClick: () => void
  disabled?: boolean
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.label}
      className="flex items-center gap-1 rounded-app border border-border px-2 py-1 text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg disabled:opacity-40"
    >
      {props.children}
    </button>
  )
}
