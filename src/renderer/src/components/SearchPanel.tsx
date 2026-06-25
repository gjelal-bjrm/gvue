import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, X, FolderOpen, AlertTriangle } from 'lucide-react'
import { useSearchStore } from '../state/useSearchStore'
import { useNavStore } from '../state/useNavStore'
import type { SearchMatch } from '@shared/types'
import { baseName, parentPath, relativeTo } from '../lib/format'

/**
 * Panneau de résultats de recherche. Remplace la liste de fichiers quand une
 * recherche est active. Les correspondances sont groupées par fichier et la
 * liste à plat (en-têtes + lignes) est virtualisée pour rester fluide.
 *
 * - Clic sur un en-tête de fichier → ouvre le dossier contenant dans l'explorateur.
 * - Clic sur une ligne → ouvre le fichier avec l'application par défaut.
 */

type Row =
  | { kind: 'file'; file: string; count: number }
  | { kind: 'match'; match: SearchMatch }

const FILE_ROW_H = 30
const MATCH_ROW_H = 24

export default function SearchPanel(): JSX.Element {
  const { matches, searching, done, dir, query, cancel, close } = useSearchStore()
  const navigate = useNavStore((s) => s.navigate)
  const parentRef = useRef<HTMLDivElement>(null)

  // Regroupe par fichier en conservant l'ordre d'apparition.
  const rows = useMemo<Row[]>(() => {
    const order: string[] = []
    const byFile = new Map<string, SearchMatch[]>()
    for (const m of matches) {
      let bucket = byFile.get(m.file)
      if (!bucket) {
        bucket = []
        byFile.set(m.file, bucket)
        order.push(m.file)
      }
      bucket.push(m)
    }
    const out: Row[] = []
    for (const file of order) {
      const bucket = byFile.get(file)!
      out.push({ kind: 'file', file, count: bucket.length })
      for (const m of bucket) out.push({ kind: 'match', match: m })
    }
    return out
  }, [matches])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].kind === 'file' ? FILE_ROW_H : MATCH_ROW_H),
    overscan: 16
  })

  const fileCount = done?.fileCount ?? new Set(matches.map((m) => m.file)).size

  return (
    <div className="flex h-full flex-col bg-bg">
      {/* En-tête */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px]">
          {searching ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-accent" />
          ) : null}
          <span className="shrink-0 font-medium text-fg">
            {matches.length} résultat{matches.length > 1 ? 's' : ''}
          </span>
          {fileCount > 0 && (
            <span className="shrink-0 text-fg-muted">
              · {fileCount} fichier{fileCount > 1 ? 's' : ''}
            </span>
          )}
          {query && (
            <span className="truncate text-fg-muted">
              · « {query} » dans {baseName(dir)}
            </span>
          )}
        </div>
        {searching && (
          <button
            onClick={cancel}
            className="shrink-0 rounded-app border border-border px-2 py-0.5 text-[11px] text-fg-secondary hover:bg-bg-hover"
          >
            Annuler
          </button>
        )}
        <button
          onClick={close}
          title="Fermer la recherche"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-app text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages d'état */}
      {done?.error && (
        <div className="m-3 flex items-start gap-2 rounded-app border border-danger-fg bg-danger-bg p-3 text-[13px] text-danger-fg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{done.error}</span>
        </div>
      )}
      {done?.hitLimit && (
        <div className="mx-3 mt-2 rounded-app border border-warning-fg bg-warning-bg px-3 py-1.5 text-[12px] text-warning-fg">
          Recherche tronquée au plafond de résultats — affinez la requête.
        </div>
      )}

      {/* Résultats */}
      <div ref={parentRef} className="relative flex-1 overflow-auto">
        {!searching && rows.length === 0 && !done?.error && (
          <div className="p-8 text-center text-[13px] text-fg-muted">
            {done ? 'Aucun résultat.' : 'Lancez une recherche depuis la barre d’outils.'}
          </div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index]
            const common = { top: vi.start, height: vi.size }
            return row.kind === 'file' ? (
              <FileHeader
                key={`f:${row.file}`}
                file={row.file}
                count={row.count}
                base={dir}
                {...common}
                onOpenDir={() => navigate(parentPath(row.file))}
              />
            ) : (
              <MatchRow
                key={`m:${row.match.file}:${row.match.line}`}
                match={row.match}
                {...common}
                onOpen={() => void window.api.fs.open(row.match.file)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FileHeader(props: {
  file: string
  count: number
  base: string
  top: number
  height: number
  onOpenDir: () => void
}): JSX.Element {
  return (
    <button
      className="absolute left-0 flex w-full items-center gap-2 border-b border-border bg-bg-secondary px-3 text-left hover:bg-bg-hover"
      style={{ top: props.top, height: props.height }}
      onClick={props.onOpenDir}
      title={`Ouvrir le dossier : ${parentPath(props.file)}`}
    >
      <FolderOpen size={14} className="shrink-0 text-accent" />
      <span className="shrink-0 text-[12px] font-medium text-fg">{baseName(props.file)}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
        {relativeTo(props.base, parentPath(props.file))}
      </span>
      <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[11px] text-accent tabular-nums">
        {props.count}
      </span>
    </button>
  )
}

function MatchRow(props: {
  match: SearchMatch
  top: number
  height: number
  onOpen: () => void
}): JSX.Element {
  const { match } = props
  return (
    <div
      className="absolute left-0 flex w-full cursor-default items-center gap-3 px-3 hover:bg-bg-hover"
      style={{ top: props.top, height: props.height }}
      onDoubleClick={props.onOpen}
      onClick={props.onOpen}
      title="Ouvrir le fichier"
    >
      <span className="w-12 shrink-0 text-right text-[11px] text-fg-muted tabular-nums">
        {match.line}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-secondary">
        {renderHighlighted(match)}
      </span>
    </div>
  )
}

/** Découpe le texte de la ligne en segments normaux / surlignés. */
function renderHighlighted(match: SearchMatch): JSX.Element[] {
  const { text, submatches } = match
  if (submatches.length === 0) return [<span key="0">{text}</span>]
  const out: JSX.Element[] = []
  let cursor = 0
  submatches.forEach((sm, i) => {
    if (sm.start > cursor) out.push(<span key={`p${i}`}>{text.slice(cursor, sm.start)}</span>)
    out.push(
      <mark key={`m${i}`} className="rounded-sm bg-accent-soft text-accent">
        {text.slice(sm.start, sm.end)}
      </mark>
    )
    cursor = sm.end
  })
  if (cursor < text.length) out.push(<span key="tail">{text.slice(cursor)}</span>)
  return out
}
