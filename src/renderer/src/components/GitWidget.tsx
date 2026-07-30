import { useState } from 'react'
import {
  GitBranch,
  GitCommit,
  ArrowUp,
  ArrowDown,
  Loader2,
  PanelsTopLeft
} from 'lucide-react'
import { useGitStore } from '../state/useGitStore'
import { useUiStore } from '../state/useUiStore'
import { useSearchStore } from '../state/useSearchStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { badge } from './git/badge'
import type { GitActionResult } from '@shared/types'

// Nombre de fichiers montrés dans l'aperçu de la vue simple.
const PREVIEW_MAX = 6

/**
 * Indicateur Git de la barre d'état : branche + avance/retard, cliquable pour
 * ouvrir la vue simple — aperçu des fichiers modifiés, commit rapide,
 * pull/push, et accès mis en avant au panneau Git complet (Ctrl+G).
 */
export default function GitWidget(): JSX.Element | null {
  const repo = useGitStore((s) => s.repo)
  const files = useGitStore((s) => s.files)
  const path = useNavStore((s) => activePane(s).path)

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GitActionResult | null>(null)

  if (!repo) return null

  const changes = files.length
  const relOf = (p: string): string =>
    p.startsWith(repo.root + '/') ? p.slice(repo.root.length + 1) : p

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

  const openDetailed = (): void => {
    setOpen(false)
    useSearchStore.getState().close()
    useUiStore.getState().setGitView(true)
  }

  return (
    <span className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Git — vue simple (clic) · panneau complet : Ctrl+G"
        className={`flex shrink-0 items-center gap-1 rounded px-1 hover:bg-bg-hover ${
          open ? 'text-fg' : 'text-fg-secondary'
        }`}
      >
        <GitBranch size={13} className="text-accent" />
        {repo.branch}
        {repo.ahead > 0 && <span className="text-fg-muted">↑{repo.ahead}</span>}
        {repo.behind > 0 && <span className="text-fg-muted">↓{repo.behind}</span>}
        {changes > 0 && (
          <span className="rounded-full bg-accent-soft px-1 text-[10px] font-medium leading-[14px] text-accent">
            {changes}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-1.5 w-80 rounded-app border border-border bg-bg-secondary p-2.5 text-[12px] shadow-lg">
            {/* En-tête : branche + état de synchro en clair */}
            <div className="mb-2 flex items-center gap-1.5 text-fg-secondary">
              <GitBranch size={13} className="shrink-0 text-accent" />
              <span className="min-w-0 truncate font-medium text-fg">{repo.branch}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                {repo.ahead > 0 && (
                  <span
                    title={`${repo.ahead} commit${repo.ahead > 1 ? 's' : ''} à pousser`}
                    className="flex items-center gap-0.5 rounded-full border border-border px-1.5 text-[11px] text-fg-secondary"
                  >
                    <ArrowUp size={10} /> {repo.ahead}
                  </span>
                )}
                {repo.behind > 0 && (
                  <span
                    title={`${repo.behind} commit${repo.behind > 1 ? 's' : ''} à récupérer`}
                    className="flex items-center gap-0.5 rounded-full border border-border px-1.5 text-[11px] text-fg-secondary"
                  >
                    <ArrowDown size={10} /> {repo.behind}
                  </span>
                )}
                {repo.ahead === 0 && repo.behind === 0 && (
                  <span className="text-[11px] text-fg-muted">à jour</span>
                )}
              </span>
            </div>

            {/* Aperçu des fichiers modifiés */}
            {changes > 0 ? (
              <div className="mb-2 rounded-app border border-border bg-bg p-1">
                {files.slice(0, PREVIEW_MAX).map((f) => {
                  const b = badge(f.category)
                  return (
                    <div key={f.path} className="flex items-center gap-1.5 px-1 py-0.5">
                      <span className={`w-3 shrink-0 text-center font-mono text-[11px] font-bold ${b.cls}`}>
                        {b.letter}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-fg-secondary" title={relOf(f.path)}>
                        {relOf(f.path)}
                      </span>
                      {f.staged && <span className="shrink-0 text-[10px] text-accent">indexé</span>}
                    </div>
                  )
                })}
                {changes > PREVIEW_MAX && (
                  <button
                    onClick={openDetailed}
                    className="w-full px-1 py-0.5 text-left text-[11px] text-fg-muted hover:text-accent"
                  >
                    … et {changes - PREVIEW_MAX} autre{changes - PREVIEW_MAX > 1 ? 's' : ''} — tout voir
                  </button>
                )}
              </div>
            ) : (
              <p className="mb-2 rounded-app border border-border bg-bg px-2 py-1.5 text-[11px] text-fg-muted">
                Aucune modification en attente.
              </p>
            )}

            {/* Accès mis en avant au panneau complet */}
            <button
              onClick={openDetailed}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
            >
              <PanelsTopLeft size={14} />
              Ouvrir le panneau Git
              <kbd className="rounded bg-white/20 px-1 text-[10px] font-normal">Ctrl+G</kbd>
            </button>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message de commit…"
              spellCheck={false}
              rows={2}
              className="mb-1.5 w-full resize-none rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
            />

            <div className="flex gap-1.5">
              <ActionBtn
                onClick={() => void doCommit()}
                disabled={busy || !message.trim() || changes === 0}
                label="Commiter toutes les modifications"
              >
                <GitCommit size={13} />
                Commit tout{changes > 0 ? ` (${changes})` : ''}
              </ActionBtn>
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
      className="flex flex-1 items-center justify-center gap-1 rounded-app border border-border px-1.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
    >
      {props.children}
    </button>
  )
}
