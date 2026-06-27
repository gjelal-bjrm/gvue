import { useState } from 'react'
import { GitBranch, GitCommit, ArrowUp, ArrowDown, Loader2, PanelsTopLeft } from 'lucide-react'
import { useGitStore } from '../state/useGitStore'
import { useUiStore } from '../state/useUiStore'
import { useSearchStore } from '../state/useSearchStore'
import { useNavStore, activePane } from '../state/useNavStore'
import type { GitActionResult } from '@shared/types'

/**
 * Indicateur Git de la barre d'état : branche + avance/retard, cliquable pour
 * ouvrir un panneau d'actions (commit tout, pull, push). Ne s'affiche que dans
 * un dépôt. Après chaque action réussie, statut Git et liste sont rafraîchis.
 */
export default function GitWidget(): JSX.Element | null {
  const repo = useGitStore((s) => s.repo)
  const statusByPath = useGitStore((s) => s.statusByPath)
  const path = useNavStore((s) => activePane(s).path)

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GitActionResult | null>(null)

  if (!repo) return null

  const changes = Object.values(statusByPath).filter((f) => f.category !== 'ignored').length

  const refreshAll = async (): Promise<void> => {
    await useGitStore.getState().refresh(path)
    useNavStore.getState().refresh()
  }

  const act = async (fn: () => Promise<GitActionResult>, onOk?: () => void): Promise<void> => {
    setBusy(true)
    setResult(null)
    const r = await fn()
    setResult(r)
    setBusy(false)
    if (r.ok) {
      onOk?.()
      await refreshAll()
    }
  }

  const doCommit = (): Promise<void> =>
    act(
      () => window.api.git.commit(path, message.trim()),
      () => setMessage('')
    )
  const doPull = (): Promise<void> => act(() => window.api.git.pull(path))
  const doPush = (): Promise<void> => act(() => window.api.git.push(path))

  return (
    <span className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Actions Git"
        className={`flex shrink-0 items-center gap-1 rounded px-1 hover:bg-bg-hover ${
          open ? 'text-fg' : 'text-fg-secondary'
        }`}
      >
        <GitBranch size={13} className="text-accent" />
        {repo.branch}
        {repo.ahead > 0 && <span className="text-fg-muted">↑{repo.ahead}</span>}
        {repo.behind > 0 && <span className="text-fg-muted">↓{repo.behind}</span>}
        {changes > 0 && <span className="text-warning-fg">●</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-1.5 w-72 rounded-app border border-border bg-bg-secondary p-2.5 text-[12px] shadow-lg">
            <div className="mb-2 flex items-center gap-1.5 text-fg-secondary">
              <GitBranch size={13} className="text-accent" />
              <span className="font-medium text-fg">{repo.branch}</span>
              <span className="text-fg-muted">
                · {changes} changement{changes > 1 ? 's' : ''}
              </span>
            </div>

            <button
              onClick={() => {
                setOpen(false)
                useSearchStore.getState().close()
                useUiStore.getState().setGitView(true)
              }}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-app border border-border px-2 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
            >
              <PanelsTopLeft size={14} />
              Vue détaillée (fichiers + diff)
            </button>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message de commit…"
              spellCheck={false}
              rows={2}
              className="mb-1.5 w-full resize-none rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
            />

            <button
              onClick={() => void doCommit()}
              disabled={busy || !message.trim() || changes === 0}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              <GitCommit size={14} />
              Commit tout{changes > 0 ? ` (${changes})` : ''}
            </button>

            <div className="flex gap-1.5">
              <ActionBtn onClick={() => void doPull()} disabled={busy} label="Pull">
                <ArrowDown size={13} />
                Pull{repo.behind > 0 ? ` ${repo.behind}` : ''}
              </ActionBtn>
              <ActionBtn onClick={() => void doPush()} disabled={busy} label="Push">
                <ArrowUp size={13} />
                Push{repo.ahead > 0 ? ` ${repo.ahead}` : ''}
              </ActionBtn>
            </div>

            {busy && (
              <div className="mt-2 flex items-center gap-1.5 text-fg-muted">
                <Loader2 size={13} className="animate-spin" />
                En cours…
              </div>
            )}
            {!busy && result && (
              <pre
                className={`mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-app border px-2 py-1.5 text-[11px] ${
                  result.ok
                    ? 'border-border bg-bg text-fg-secondary'
                    : 'border-danger-fg bg-danger-bg text-danger-fg'
                }`}
              >
                {result.output}
              </pre>
            )}
          </div>
        </>
      )}
    </span>
  )
}

function ActionBtn(props: {
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
      className="flex flex-1 items-center justify-center gap-1.5 rounded-app border border-border px-2 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
    >
      {props.children}
    </button>
  )
}
