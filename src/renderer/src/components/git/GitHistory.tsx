import { useEffect, useMemo, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import {
  GitCommit as GitCommitIcon,
  GitBranch,
  Loader2,
  Copy,
  Search,
  Tag,
  Cloud,
  X
} from 'lucide-react'
import type { GitCommit, GitFileChange } from '@shared/types'
import { pathKey } from '../../lib/format'
import { computeGraph, laneColor, parseRefs, relativeDate, type GraphRow } from '../../lib/gitGraph'
import DiffView from './DiffView'
import { badge } from './badge'
import { t, tn } from '../../i18n'

// Géométrie du graphe : hauteur de rangée fixe pour aligner lignes et points.
const ROW_H = 44
const COL_W = 12
const MAX_LANES = 10

/**
 * Vue « Historique » avec graphe des branches (façon GitKraken) : graphe +
 * commits à gauche, fichiers du commit au milieu, diff à droite. Filtre,
 * bascule « toutes les branches » et pagination « charger plus ».
 */
export default function GitHistory({ root }: { root: string }): JSX.Element {
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [limit, setLimit] = useState(200)
  const [allBranches, setAllBranches] = useState(true)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [selHash, setSelHash] = useState<string | null>(null)
  const [files, setFiles] = useState<GitFileChange[]>([])
  const [selFile, setSelFile] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  const [loadingFiles, setLoadingFiles] = useState(false)

  // Charge l'historique à l'ouverture et quand dépôt/limite/branches changent.
  useEffect(() => {
    let alive = true
    if (!root) {
      setCommits([])
      return
    }
    setLoading(true)
    void window.api.git.log(root, limit, allBranches).then((c) => {
      if (!alive) return
      setCommits(c)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [root, limit, allBranches])

  // Le graphe se calcule sur la liste complète (le filtre ne casse pas les lignes).
  const graph = useMemo(() => computeGraph(commits), [commits])
  const gutterLanes = useMemo(
    () => Math.min(MAX_LANES, graph.reduce((m, r) => Math.max(m, r.width), 1)),
    [graph]
  )
  const now = useMemo(() => Date.now(), [commits])

  const q = filter.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!q) return commits.map((c, i) => ({ c, row: graph[i] }))
    return commits
      .map((c, i) => ({ c, row: graph[i] }))
      .filter(
        ({ c }) =>
          c.subject.toLowerCase().includes(q) ||
          c.author.toLowerCase().includes(q) ||
          c.shortHash.startsWith(q)
      )
  }, [commits, graph, q])

  const loadDiff = async (hash: string, file: string): Promise<void> => {
    setSelFile(file)
    setDiff(await window.api.git.commitDiff(root, hash, file))
  }

  const selectCommit = async (hash: string): Promise<void> => {
    setSelHash(hash)
    setSelFile(null)
    setDiff('')
    setLoadingFiles(true)
    const fs = await window.api.git.commitFiles(root, hash)
    setLoadingFiles(false)
    setFiles(fs)
    if (fs.length) void loadDiff(hash, fs[0].path)
  }

  const relOf = (p: string): string => (p.startsWith(root + '/') ? p.slice(root.length + 1) : p)
  const selCommit = commits.find((c) => c.hash === selHash) ?? null

  return (
    <PanelGroup autoSaveId="gvue:git-history" direction="horizontal" className="min-h-0 flex-1">
      {/* Graphe + liste des commits */}
      <Panel defaultSize={38} minSize={24}>
        <div className="flex h-full flex-col border-r border-border">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1.5">
            <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-app border border-border bg-bg-tertiary px-2">
              <Search size={13} className="shrink-0 text-fg-muted" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('Filtrer (message, auteur, hash)…')}
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-muted"
              />
              {filter && (
                <button
                  onClick={() => setFilter('')}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              onClick={() => setAllBranches((v) => !v)}
              title={
                allBranches
                  ? t('Afficher uniquement la branche courante')
                  : t('Afficher toutes les branches (graphe complet)')
              }
              className={`flex h-7 shrink-0 items-center gap-1 rounded-app border px-1.5 text-[11px] ${
                allBranches
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border text-fg-muted hover:bg-bg-hover hover:text-fg'
              }`}
            >
              <GitBranch size={12} /> {t('Toutes')}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {loading && commits.length === 0 ? (
              <p className="flex items-center justify-center gap-1.5 px-3 py-4 text-[12px] text-fg-muted">
                <Loader2 size={13} className="animate-spin" /> {t('Chargement…')}
              </p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-3 text-center text-[12px] text-fg-muted">
                {q ? t('Aucun commit ne correspond au filtre.') : t('Aucun commit.')}
              </p>
            ) : (
              visible.map(({ c, row }) => (
                <CommitRow
                  key={c.hash}
                  commit={c}
                  row={q ? null : row}
                  lanes={gutterLanes}
                  now={now}
                  selected={c.hash === selHash}
                  onClick={() => void selectCommit(c.hash)}
                />
              ))
            )}
            {!q && commits.length >= limit && (
              <button
                onClick={() => setLimit((n) => n + 300)}
                disabled={loading}
                className="my-1.5 block w-full py-1.5 text-center text-[12px] text-accent hover:bg-bg-hover disabled:opacity-50"
              >
                {loading ? t('Chargement…') : t('Charger plus de commits')}
              </button>
            )}
          </div>
        </div>
      </Panel>

      <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

      {/* Fichiers du commit sélectionné */}
      <Panel defaultSize={26} minSize={16}>
        <div className="flex h-full flex-col border-r border-border">
          {selCommit ? (
            <>
              <div className="shrink-0 border-b border-border px-3 py-2">
                <div className="mb-1 flex items-start gap-1.5">
                  <GitCommitIcon size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span className="min-w-0 break-words text-[12px] text-fg">{selCommit.subject}</span>
                </div>
                <div className="flex items-center gap-1.5 pl-[22px] text-[11px] text-fg-muted">
                  <span className="min-w-0 flex-1 truncate">
                    {selCommit.author} · {selCommit.date}
                  </span>
                  <button
                    onClick={() => void navigator.clipboard?.writeText(selCommit.hash)}
                    title={t('Copier le hash complet')}
                    className="flex shrink-0 items-center gap-1 rounded px-1 font-mono hover:bg-bg-hover hover:text-fg"
                  >
                    {selCommit.shortHash} <Copy size={11} />
                  </button>
                </div>
                {selCommit.refs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-[22px]">
                    <RefChips refs={selCommit.refs} max={6} />
                  </div>
                )}
              </div>
              <div className="shrink-0 px-3 py-1 text-[11px] uppercase tracking-wider text-fg-muted">
                {loadingFiles ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" /> {t('Chargement…')}
                  </span>
                ) : (
                  tn(files.length, '{n} fichier modifié', '{n} fichiers modifiés')
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-1.5">
                {files.map((f) => {
                  const b = badge(f.category)
                  const isSel = selFile != null && pathKey(f.path) === pathKey(selFile)
                  return (
                    <button
                      key={f.path}
                      onClick={() => void loadDiff(selCommit.hash, f.path)}
                      className={`flex w-full items-center gap-1.5 rounded-app px-1.5 py-1 text-left ${
                        isSel ? 'bg-accent-soft ring-1 ring-inset ring-accent' : 'hover:bg-bg-hover'
                      }`}
                    >
                      <span className={`w-3 shrink-0 text-center font-mono text-[11px] font-bold ${b.cls}`}>
                        {b.letter}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[12px] ${isSel ? 'text-accent' : 'text-fg-secondary'}`}
                        title={relOf(f.path)}
                      >
                        {relOf(f.path)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-fg-muted">
              {t('Sélectionnez un commit pour voir ses fichiers.')}
            </div>
          )}
        </div>
      </Panel>

      <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

      {/* Diff du fichier sélectionné */}
      <Panel minSize={26}>
        <div className="flex h-full flex-col">
          {!selFile ? (
            <div className="flex h-full items-center justify-center text-[12px] text-fg-muted">
              {selCommit ? t('Sélectionnez un fichier pour voir le diff.') : ''}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <div className="mb-1.5 truncate px-1 font-mono text-[11px] text-fg-muted">
                {relOf(selFile)}
              </div>
              {diff ? (
                <DiffView diff={diff} />
              ) : (
                <p className="px-1 text-[12px] text-fg-muted">
                  {t('Pas de diff textuel (fichier binaire, vide, ou renommage sans modification).')}
                </p>
              )}
            </div>
          )}
        </div>
      </Panel>
    </PanelGroup>
  )
}

/** Une rangée : graphe (si non filtré) + message, refs, auteur et date relative. */
function CommitRow(props: {
  commit: GitCommit
  /** Rangée de graphe, ou null quand un filtre est actif (lignes discontinues). */
  row: GraphRow | null
  lanes: number
  now: number
  selected: boolean
  onClick: () => void
}): JSX.Element {
  const { commit: c, row, lanes, selected } = props
  return (
    <button
      onClick={props.onClick}
      style={{ height: ROW_H }}
      className={`flex w-full items-center gap-1 border-b border-border/60 pr-2 text-left ${
        selected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
      }`}
    >
      {row ? (
        <GraphGutter row={row} lanes={lanes} />
      ) : (
        <span className="grid shrink-0 place-items-center" style={{ width: COL_W * 2 }}>
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: laneColor(0) }} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1">
          {c.refs.length > 0 && <RefChips refs={c.refs} max={2} />}
          <span
            className={`min-w-0 truncate text-[12px] ${selected ? 'text-accent' : 'text-fg'}`}
            title={c.subject}
          >
            {c.subject}
          </span>
        </span>
        <span className="flex w-full items-center gap-1.5 text-[11px] text-fg-muted">
          <span className="min-w-0 flex-1 truncate">{c.author}</span>
          <span className="shrink-0" title={c.date}>
            {relativeDate(c.ts, props.now)}
          </span>
          <span className="shrink-0 font-mono">{c.shortHash}</span>
        </span>
      </span>
    </button>
  )
}

/** Gouttière SVG d'une rangée : lignes qui passent, entrent et sortent du point. */
function GraphGutter({ row, lanes }: { row: GraphRow; lanes: number }): JSX.Element {
  const w = lanes * COL_W
  const x = (i: number): number => Math.min(i, lanes - 1) * COL_W + COL_W / 2
  const cx = x(row.lane)
  const mid = ROW_H / 2
  return (
    <svg width={w} height={ROW_H} className="shrink-0" aria-hidden>
      {row.passes.map((i) => (
        <line key={`p${i}`} x1={x(i)} y1={0} x2={x(i)} y2={ROW_H} stroke={laneColor(i)} strokeWidth={2} />
      ))}
      {row.intoDot.map((i) => (
        <path
          key={`i${i}`}
          d={`M ${x(i)} 0 C ${x(i)} ${mid * 0.7}, ${cx} ${mid * 0.4}, ${cx} ${mid}`}
          stroke={laneColor(i)}
          strokeWidth={2}
          fill="none"
        />
      ))}
      {row.outOfDot.map((i) => (
        <path
          key={`o${i}`}
          d={`M ${cx} ${mid} C ${cx} ${mid + mid * 0.6}, ${x(i)} ${mid + mid * 0.3}, ${x(i)} ${ROW_H}`}
          stroke={laneColor(i)}
          strokeWidth={2}
          fill="none"
        />
      ))}
      <circle cx={cx} cy={mid} r={3.5} fill={laneColor(row.lane)} />
    </svg>
  )
}

/** Puces de décorations : branche courante (pleine), branches, remotes, tags. */
function RefChips({ refs, max }: { refs: string[]; max: number }): JSX.Element {
  const d = parseRefs(refs)
  const chips: JSX.Element[] = []
  for (const b of d.branches) {
    chips.push(
      <span
        key={`b${b}`}
        title={d.head && chips.length === 0 ? `${b} (HEAD)` : b}
        className={`flex max-w-[110px] shrink-0 items-center gap-0.5 truncate rounded-full px-1.5 text-[10px] leading-[16px] ${
          d.head ? 'bg-accent font-medium text-white' : 'border border-accent text-accent'
        }`}
      >
        <GitBranch size={9} className="shrink-0" />
        <span className="truncate">{b}</span>
      </span>
    )
  }
  for (const r of d.remotes) {
    chips.push(
      <span
        key={`r${r}`}
        title={r}
        className="flex max-w-[110px] shrink-0 items-center gap-0.5 truncate rounded-full border border-border px-1.5 text-[10px] leading-[16px] text-fg-muted"
      >
        <Cloud size={9} className="shrink-0" />
        <span className="truncate">{r}</span>
      </span>
    )
  }
  for (const t of d.tags) {
    chips.push(
      <span
        key={`t${t}`}
        title={t}
        className="flex max-w-[110px] shrink-0 items-center gap-0.5 truncate rounded-full border border-warning-fg px-1.5 text-[10px] leading-[16px] text-warning-fg"
      >
        <Tag size={9} className="shrink-0" />
        <span className="truncate">{t}</span>
      </span>
    )
  }
  const shown = chips.slice(0, max)
  const extra = chips.length - shown.length
  return (
    <>
      {shown}
      {extra > 0 && (
        <span className="shrink-0 rounded-full border border-border px-1 text-[10px] leading-[16px] text-fg-muted">
          +{extra}
        </span>
      )}
    </>
  )
}
