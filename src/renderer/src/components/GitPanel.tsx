import { useEffect, useMemo, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import {
  GitBranch,
  GitCommit,
  Plus,
  Minus,
  Undo2,
  Loader2,
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
import GitHistory from './git/GitHistory'
import BranchBar from './git/BranchBar'
import CommitBox from './git/CommitBox'
import ChangedFileRow from './git/ChangedFileRow'

/**
 * Vue Git détaillée (façon GitHub Desktop), affichée à la place des volets —
 * orchestration seule : la barre de branche, la zone de commit et les lignes de
 * fichiers vivent dans ./git/. Onglets Modifications / Historique.
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
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GitActionResult | null>(null)
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

  // Commit des fichiers indexés ; renvoie vrai si accepté (CommitBox vide alors son champ).
  const commit = async (message: string): Promise<boolean> => {
    setBusy(true)
    setResult(null)
    const r = await window.api.git.commitStaged(root, message)
    setResult(r)
    setBusy(false)
    if (r.ok) await refreshAll()
    return r.ok
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

  return (
    <div className="flex h-full flex-col bg-bg">
      <BranchBar
        repo={repo}
        branches={branches}
        busy={busy}
        onCheckout={(b) => void act(() => window.api.git.checkout(root, b))}
        onCreateBranch={(name) => void act(() => window.api.git.createBranch(root, name))}
        onFetch={() => void act(() => window.api.git.fetch(root))}
        onPull={() => void act(() => window.api.git.pull(root))}
        onPush={() => void act(() => window.api.git.push(root))}
        onRefresh={() => void refreshAll()}
        onClose={() => setGitView(false)}
      />

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
                order.map((f) => (
                  <ChangedFileRow
                    key={f.path}
                    file={f}
                    rel={relOf(f.path)}
                    selected={sel.has(pathKey(f.path))}
                    lead={selPath != null && pathKey(f.path) === pathKey(selPath)}
                    onClick={(e) => onRowClick(e, f)}
                    onContextMenu={(e) => onRowContext(e, f)}
                    onToggleStaged={() =>
                      void act(() =>
                        f.staged
                          ? window.api.git.unstage(root, f.path)
                          : window.api.git.stage(root, f.path)
                      )
                    }
                    onDiscard={() => discardTargets([f])}
                  />
                ))
              )}
            </div>

            <CommitBox
              branch={repo.branch}
              stagedCount={staged.length}
              busy={busy}
              error={!busy && result && !result.ok ? result.output : null}
              onCommit={commit}
            />
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
                  {relOf(selected.path)}
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
