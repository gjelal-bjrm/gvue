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
  Check,
  Ban,
  Copy,
  ExternalLink,
  Code2,
  History
} from 'lucide-react'
import { useGitStore } from '../state/useGitStore'
import { useUiStore } from '../state/useUiStore'
import { useAppsStore } from '../state/useAppsStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { pathKey } from '../lib/format'
import ContextMenu, { type MenuEntry } from './ContextMenu'
import type { GitActionResult, GitFileChange } from '@shared/types'
import DiffView from './git/DiffView'
import { badge } from './git/badge'
import GitHistory from './git/GitHistory'

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

  const apps = useAppsStore((s) => s.apps)
  const [selPath, setSelPath] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [diff, setDiff] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GitActionResult | null>(null)
  const [branchMenu, setBranchMenu] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const [tab, setTab] = useState<'changes' | 'history'>('changes')

  const root = repo?.root ?? path

  const staged = useMemo(() => files.filter((f) => f.staged), [files])
  const unstaged = useMemo(() => files.filter((f) => !f.staged), [files])
  // Ordre d'affichage (indexés puis modifications), pour la sélection par plage.
  const order = useMemo(() => [...staged, ...unstaged], [staged, unstaged])
  const selectedFiles = useMemo(
    () => order.filter((f) => sel.has(pathKey(f.path))),
    [order, sel]
  )
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

  const relOf = (p: string): string =>
    repo && p.startsWith(repo.root + '/') ? p.slice(repo.root.length + 1) : p

  // Sélection : clic = simple, Ctrl = bascule, Maj = plage. selPath = diff affiché.
  const onRowClick = (e: React.MouseEvent, f: GitFileChange): void => {
    const key = pathKey(f.path)
    if (e.ctrlKey || e.metaKey) {
      setSel((prev) => {
        const n = new Set(prev)
        n.has(key) ? n.delete(key) : n.add(key)
        return n
      })
    } else if (e.shiftKey && selPath) {
      const a = order.findIndex((x) => pathKey(x.path) === pathKey(selPath))
      const b = order.findIndex((x) => pathKey(x.path) === key)
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        setSel(new Set(order.slice(lo, hi + 1).map((x) => pathKey(x.path))))
      }
    } else {
      setSel(new Set([key]))
    }
    setSelPath(f.path)
  }

  const onRowContext = (e: React.MouseEvent, f: GitFileChange): void => {
    e.preventDefault()
    const key = pathKey(f.path)
    if (!sel.has(key)) {
      setSel(new Set([key]))
      setSelPath(f.path)
    }
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const discardTargets = (targets: GitFileChange[]): void =>
    void act(async () => {
      for (const f of targets) {
        if (f.category === 'untracked') {
          try {
            await window.api.fs.trash(f.path)
          } catch {
            /* ignore */
          }
        } else await window.api.git.discard(root, f.path)
      }
      return { ok: true, output: 'OK' }
    })

  const buildMenu = (): MenuEntry[] => {
    const targets = selectedFiles
    if (!targets.length) return []
    const n = targets.length
    const paths = targets.map((f) => f.path)
    const rels = targets.map((f) => relOf(f.path))
    const folders = [
      ...new Set(
        rels
          .map((r) => {
            const i = r.lastIndexOf('/')
            return i >= 0 ? r.slice(0, i) + '/' : ''
          })
          .filter(Boolean)
      )
    ]
    const exts = [
      ...new Set(
        targets
          .map((f) => {
            const i = f.path.lastIndexOf('.')
            const s = f.path.lastIndexOf('/')
            return i > s ? f.path.slice(i) : ''
          })
          .filter(Boolean)
      )
    ]
    const suffix = n > 1 ? ` (${n})` : ''
    const entries: MenuEntry[] = []
    if (targets.some((f) => !f.staged))
      entries.push({
        label: `Indexer${suffix}`,
        icon: <Plus size={14} />,
        onClick: () =>
          void act(async () => {
            for (const f of targets) if (!f.staged) await window.api.git.stage(root, f.path)
            return { ok: true, output: 'OK' }
          })
      })
    if (targets.some((f) => f.staged))
      entries.push({
        label: `Désindexer${suffix}`,
        icon: <Minus size={14} />,
        onClick: () =>
          void act(async () => {
            for (const f of targets) if (f.staged) await window.api.git.unstage(root, f.path)
            return { ok: true, output: 'OK' }
          })
      })
    entries.push({
      label: `Annuler les modifications${suffix}…`,
      icon: <Undo2 size={14} />,
      danger: true,
      onClick: () => discardTargets(targets)
    })
    entries.push({ type: 'sep' })
    entries.push({
      label: n > 1 ? `Ignorer ces ${n} fichiers (.gitignore)` : 'Ignorer ce fichier (.gitignore)',
      icon: <Ban size={14} />,
      onClick: () => void act(() => window.api.git.ignore(root, rels))
    })
    if (folders.length)
      entries.push({
        label: folders.length > 1 ? 'Ignorer ces dossiers (.gitignore)' : 'Ignorer ce dossier (.gitignore)',
        icon: <Ban size={14} />,
        onClick: () => void act(() => window.api.git.ignore(root, folders))
      })
    if (exts.length)
      entries.push({
        label:
          exts.length === 1
            ? `Ignorer tous les ${exts[0]} (.gitignore)`
            : `Ignorer ${exts.map((e) => '*' + e).join(', ')}`,
        icon: <Ban size={14} />,
        onClick: () => void act(() => window.api.git.ignore(root, exts.map((e) => '*' + e)))
      })
    entries.push({ type: 'sep' })
    entries.push({
      label: 'Copier le chemin',
      icon: <Copy size={14} />,
      onClick: () => void navigator.clipboard?.writeText(paths.join('\n'))
    })
    entries.push({
      label: 'Copier le chemin relatif',
      icon: <Copy size={14} />,
      onClick: () => void navigator.clipboard?.writeText(rels.join('\n'))
    })
    entries.push({ type: 'sep' })
    entries.push({
      label: "Révéler dans l'explorateur",
      icon: <ExternalLink size={14} />,
      onClick: () => void window.api.fs.reveal(paths[0])
    })
    if (apps.vscode)
      entries.push({
        label: 'Ouvrir avec VS Code',
        icon: <Code2 size={14} />,
        onClick: () => window.api.apps.openWith('vscode', paths)
      })
    entries.push({
      label: 'Ouvrir (programme par défaut)',
      icon: <ExternalLink size={14} />,
      onClick: () => {
        for (const p of paths) void window.api.fs.open(p)
      }
    })
    return entries
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
    const rel = relOf(f.path)
    const isSel = sel.has(pathKey(f.path))
    const isLead = selPath != null && pathKey(f.path) === pathKey(selPath)
    return (
      <div
        key={f.path}
        onClick={(e) => onRowClick(e, f)}
        onContextMenu={(e) => onRowContext(e, f)}
        className={`group flex cursor-pointer items-center gap-1.5 rounded-app px-1.5 py-1 ${
          isSel ? 'bg-accent-soft' : 'hover:bg-bg-hover'
        } ${isLead ? 'ring-1 ring-inset ring-accent' : ''}`}
      >
        <input
          type="checkbox"
          checked={f.staged}
          onClick={(e) => e.stopPropagation()}
          onChange={() =>
            void act(() =>
              f.staged ? window.api.git.unstage(root, f.path) : window.api.git.stage(root, f.path)
            )
          }
          title={f.staged ? 'Sera commité (cliquer pour désindexer)' : 'Cocher pour indexer'}
          className="shrink-0 accent-[var(--accent)]"
        />
        <span className={`w-3 shrink-0 text-center font-mono text-[11px] font-bold ${b.cls}`}>
          {b.letter}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[12px] ${isSel ? 'text-accent' : 'text-fg-secondary'}`} title={rel}>
          {rel}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            discardTargets([f])
          }}
          title="Annuler les modifications (destructif)"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted opacity-0 hover:bg-bg-hover hover:text-danger-fg group-hover:opacity-100"
        >
          <Undo2 size={12} />
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

      {/* Onglets façon GitHub Desktop : Modifications / Historique */}
      <div className="flex shrink-0 items-center border-b border-border px-2">
        <button
          onClick={() => setTab('changes')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[12px] ${
            tab === 'changes'
              ? 'border-accent text-fg'
              : 'border-transparent text-fg-muted hover:text-fg-secondary'
          }`}
        >
          <GitCommit size={14} /> Modifications
          {files.length > 0 && <span className="text-fg-muted">({files.length})</span>}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[12px] ${
            tab === 'history'
              ? 'border-accent text-fg'
              : 'border-transparent text-fg-muted hover:text-fg-secondary'
          }`}
        >
          <History size={14} /> Historique
        </button>
      </div>

      {tab === 'history' ? (
        <GitHistory root={root} />
      ) : (
      <PanelGroup autoSaveId="gvue:git" direction="horizontal" className="min-h-0 flex-1">
        {/* Colonne gauche : fichiers + commit */}
        <Panel defaultSize={34} minSize={22}>
          <div className="flex h-full flex-col border-r border-border">
            {files.length > 0 && (
              <label className="flex shrink-0 items-center gap-2 border-b border-border px-2.5 py-1.5 text-[12px] text-fg-secondary">
                <input
                  type="checkbox"
                  checked={staged.length === files.length}
                  ref={(el) => {
                    if (el) el.indeterminate = staged.length > 0 && staged.length < files.length
                  }}
                  onChange={() =>
                    void act(() =>
                      staged.length === files.length
                        ? window.api.git.unstageAll(root)
                        : window.api.git.stageAll(root)
                    )
                  }
                  className="accent-[var(--accent)]"
                />
                <span>
                  {files.length} fichier{files.length > 1 ? 's' : ''} modifié
                  {files.length > 1 ? 's' : ''}
                  <span className="text-fg-muted"> · {staged.length} indexé{staged.length > 1 ? 's' : ''}</span>
                </span>
              </label>
            )}
            <div className="min-h-0 flex-1 overflow-auto p-1.5">
              {files.length === 0 ? (
                <p className="px-1 py-3 text-center text-[12px] text-fg-muted">Aucun changement.</p>
              ) : (
                order.map(fileRow)
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
                  <DiffView diff={diff} />
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
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} entries={buildMenu()} onClose={() => setMenu(null)} />
      )}
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

