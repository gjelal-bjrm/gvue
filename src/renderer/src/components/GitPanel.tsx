import { useEffect, useMemo, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import {
  GitBranch,
  GitCommit,
  ArrowUp,
  ArrowDown,
  RotateCw,
  DownloadCloud,
  Plus,
  Minus,
  Undo2,
  X,
  ChevronDown,
  Loader2,
  Check
} from 'lucide-react'
import { useGitStore } from '../state/useGitStore'
import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { pathKey } from '../lib/format'
import type { GitActionResult, GitCategory, GitFileChange } from '@shared/types'

/** Lettre + couleur du statut d'un fichier (façon GitHub Desktop). */
function badge(cat: GitCategory): { letter: string; cls: string } {
  switch (cat) {
    case 'added':
      return { letter: 'A', cls: 'text-success-fg' }
    case 'untracked':
      return { letter: 'U', cls: 'text-success-fg' }
    case 'deleted':
      return { letter: 'D', cls: 'text-danger-fg' }
    case 'renamed':
      return { letter: 'R', cls: 'text-accent' }
    case 'conflict':
      return { letter: '!', cls: 'text-danger-fg' }
    default:
      return { letter: 'M', cls: 'text-warning-fg' }
  }
}

/** Classe de couleur d'une ligne de diff unifié. */
function diffLineClass(line: string): string {
  if (line.startsWith('@@')) return 'text-accent'
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-fg-muted'
  if (line.startsWith('diff ') || line.startsWith('index ')) return 'text-fg-muted'
  if (line.startsWith('+')) return 'text-success-fg'
  if (line.startsWith('-')) return 'text-danger-fg'
  return 'text-fg-secondary'
}

/**
 * Vue Git détaillée (façon GitHub Desktop), affichée à la place des volets :
 * barre de branche (changer / créer / fetch / pull / push), liste des fichiers
 * (indexés / modifications) avec statut coloré et indexation par fichier, diff
 * coloré du fichier sélectionné, et zone de commit.
 */
export default function GitPanel(): JSX.Element {
  const repo = useGitStore((s) => s.repo)
  const files = useGitStore((s) => s.files)
  const branches = useGitStore((s) => s.branches)
  const setGitView = useUiStore((s) => s.setGitView)
  const path = useNavStore((s) => activePane(s).path)

  const [selPath, setSelPath] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GitActionResult | null>(null)
  const [branchMenu, setBranchMenu] = useState(false)
  const [newBranch, setNewBranch] = useState('')

  const root = repo?.root ?? path

  const staged = useMemo(() => files.filter((f) => f.staged), [files])
  const unstaged = useMemo(() => files.filter((f) => !f.staged), [files])
  const selected = useMemo(
    () => (selPath ? files.find((f) => pathKey(f.path) === pathKey(selPath)) ?? null : null),
    [files, selPath]
  )

  const loadDiff = async (file: GitFileChange | null): Promise<void> => {
    if (!file) {
      setDiff('')
      return
    }
    const text = await window.api.git.diff(root, file.path, {
      staged: file.staged,
      untracked: file.category === 'untracked'
    })
    setDiff(text)
  }

  // Charge les branches à l'ouverture / au changement de dépôt.
  useEffect(() => {
    if (root) void useGitStore.getState().loadBranches(root)
  }, [root])

  // Recharge le diff quand la sélection ou la liste change.
  useEffect(() => {
    void loadDiff(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selPath, selected?.staged, selected?.category, files])

  const refreshAll = async (): Promise<void> => {
    await useGitStore.getState().refresh(path)
    await useGitStore.getState().loadBranches(root)
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

  if (!repo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <GitBranch size={28} className="text-fg-muted" />
        <p className="text-[13px] text-fg-secondary">Ce dossier n'est pas un dépôt Git.</p>
        <button
          onClick={() => setGitView(false)}
          className="rounded-app border border-border px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
        >
          Fermer la vue Git
        </button>
      </div>
    )
  }

  const fileRow = (f: GitFileChange): JSX.Element => {
    const b = badge(f.category)
    const rel = f.path.startsWith(repo.root + '/') ? f.path.slice(repo.root.length + 1) : f.path
    const isSel = selPath != null && pathKey(f.path) === pathKey(selPath)
    return (
      <div
        key={f.path}
        onClick={() => setSelPath(f.path)}
        className={`group flex cursor-pointer items-center gap-1.5 rounded-app px-1.5 py-1 ${
          isSel ? 'bg-accent-soft' : 'hover:bg-bg-hover'
        }`}
      >
        <span className={`w-3 shrink-0 text-center font-mono text-[11px] font-bold ${b.cls}`}>
          {b.letter}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[12px] ${isSel ? 'text-accent' : 'text-fg-secondary'}`} title={rel}>
          {rel}
        </span>
        {f.category !== 'untracked' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              void act(() => window.api.git.discard(root, f.path))
            }}
            title="Annuler les modifications (destructif)"
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
          >
            <Undo2 size={12} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            void act(() =>
              f.staged
                ? window.api.git.unstage(root, f.path)
                : window.api.git.stage(root, f.path)
            )
          }}
          title={f.staged ? 'Désindexer' : 'Indexer'}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
        >
          {f.staged ? <Minus size={12} /> : <Plus size={12} />}
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      {/* Barre de branche */}
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
                        if (b !== branches.current) void act(() => window.api.git.checkout(root, b))
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
                      if (e.key === 'Enter' && newBranch.trim()) {
                        setBranchMenu(false)
                        const name = newBranch.trim()
                        setNewBranch('')
                        void act(() => window.api.git.createBranch(root, name))
                      }
                    }}
                    placeholder="Nouvelle branche…"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-app border border-border bg-bg px-2 py-1 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
                  />
                  <button
                    onClick={() => {
                      const name = newBranch.trim()
                      if (!name) return
                      setBranchMenu(false)
                      setNewBranch('')
                      void act(() => window.api.git.createBranch(root, name))
                    }}
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

        <HeaderBtn onClick={() => void act(() => window.api.git.fetch(root))} disabled={busy} label="Fetch">
          <DownloadCloud size={14} /> Fetch
        </HeaderBtn>
        <HeaderBtn onClick={() => void act(() => window.api.git.pull(root))} disabled={busy} label="Pull">
          <ArrowDown size={14} /> Pull{repo.behind > 0 ? ` ${repo.behind}` : ''}
        </HeaderBtn>
        <HeaderBtn onClick={() => void act(() => window.api.git.push(root))} disabled={busy} label="Push">
          <ArrowUp size={14} /> Push{repo.ahead > 0 ? ` ${repo.ahead}` : ''}
        </HeaderBtn>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => void refreshAll()}
            title="Rafraîchir"
            className="grid h-7 w-7 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <RotateCw size={14} />
          </button>
          <button
            onClick={() => setGitView(false)}
            title="Fermer la vue Git"
            className="grid h-7 w-7 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <PanelGroup autoSaveId="gvue:git" direction="horizontal" className="min-h-0 flex-1">
        {/* Colonne gauche : fichiers + commit */}
        <Panel defaultSize={34} minSize={22}>
          <div className="flex h-full flex-col border-r border-border">
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {files.length === 0 ? (
                <p className="px-1 py-3 text-center text-[12px] text-fg-muted">Aucun changement.</p>
              ) : (
                <>
                  {staged.length > 0 && (
                    <Section
                      title={`Indexés (${staged.length})`}
                      action={
                        <SmallBtn onClick={() => void act(() => window.api.git.unstageAll(root))}>
                          Tout désindexer
                        </SmallBtn>
                      }
                    >
                      {staged.map(fileRow)}
                    </Section>
                  )}
                  <Section
                    title={`Modifications (${unstaged.length})`}
                    action={
                      unstaged.length > 0 ? (
                        <SmallBtn onClick={() => void act(() => window.api.git.stageAll(root))}>
                          Tout indexer
                        </SmallBtn>
                      ) : null
                    }
                  >
                    {unstaged.map(fileRow)}
                  </Section>
                </>
              )}
            </div>

            {/* Zone de commit */}
            <div className="shrink-0 border-t border-border p-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message de commit…"
                spellCheck={false}
                rows={2}
                className="mb-1.5 w-full resize-none rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
              />
              <button
                onClick={() =>
                  void act(
                    () => window.api.git.commitStaged(root, message.trim()),
                    () => setMessage('')
                  )
                }
                disabled={busy || !message.trim() || staged.length === 0}
                className="flex w-full items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <GitCommit size={14} />
                Commit{staged.length > 0 ? ` (${staged.length})` : ''} sur {repo.branch}
              </button>
              {!busy && result && !result.ok && (
                <pre className="mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-app border border-danger-fg bg-danger-bg px-2 py-1 text-[11px] text-danger-fg">
                  {result.output}
                </pre>
              )}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

        {/* Colonne droite : diff */}
        <Panel minSize={30}>
          <div className="flex h-full flex-col">
            {busy && (
              <div className="flex items-center gap-1.5 border-b border-border px-3 py-1 text-[11px] text-fg-muted">
                <Loader2 size={12} className="animate-spin" /> En cours…
              </div>
            )}
            {!selected ? (
              <div className="flex h-full items-center justify-center text-[12px] text-fg-muted">
                Sélectionnez un fichier pour voir le diff.
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto p-2">
                <div className="mb-1.5 truncate px-1 font-mono text-[11px] text-fg-muted">
                  {selected.path.startsWith(repo.root + '/')
                    ? selected.path.slice(repo.root.length + 1)
                    : selected.path}
                </div>
                {diff ? (
                  <pre className="font-mono text-[12px] leading-[1.45]">
                    {diff.split('\n').map((line, i) => (
                      <div key={i} className={`whitespace-pre-wrap break-all ${diffLineClass(line)}`}>
                        {line || ' '}
                      </div>
                    ))}
                  </pre>
                ) : (
                  <p className="px-1 text-[12px] text-fg-muted">
                    Pas de diff textuel (fichier binaire, vide, ou identique à l'index).
                  </p>
                )}
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>
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

function Section(props: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
          {props.title}
        </span>
        {props.action}
      </div>
      <div className="flex flex-col">{props.children}</div>
    </div>
  )
}

function SmallBtn(props: { onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      className="rounded px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-bg-hover hover:text-fg"
    >
      {props.children}
    </button>
  )
}
