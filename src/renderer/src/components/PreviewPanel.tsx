import { useEffect, useState } from 'react'
import { Eye, X, ExternalLink, FolderOpen, FileQuestion, Loader2 } from 'lucide-react'
import { useNavStore, activePane } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'
import type { PreviewData } from '@shared/types'
import { formatSize, formatDate } from '../lib/format'

/**
 * Panneau d'aperçu (façon Quick Look) : affiche le contenu du fichier
 * sélectionné sans l'ouvrir. Image, JSON coloré, Markdown rendu, texte/code,
 * ou carte d'infos pour les binaires. Sans dépendance (coloration JSON et rendu
 * Markdown faits maison, sans injection de HTML brut).
 */
export default function PreviewPanel(): JSX.Element {
  const selectedPath = useNavStore((s) => activePane(s).selectedPath)
  const closePanel = useUiStore((s) => s.togglePreview)
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedPath) {
      setData(null)
      setError(null)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    window.api.fs
      .preview(selectedPath)
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedPath])

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-bg-secondary">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Eye size={15} className="shrink-0 text-accent" />
          <span className="truncate text-[13px] font-medium text-fg">{data?.name ?? 'Aperçu'}</span>
        </div>
        <button
          onClick={closePanel}
          title="Fermer l'aperçu"
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!selectedPath && (
          <div className="grid h-full place-items-center p-6 text-center text-[13px] text-fg-muted">
            Sélectionnez un fichier pour l’aperçu.
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 p-4 text-[13px] text-fg-muted">
            <Loader2 size={14} className="animate-spin" /> Chargement…
          </div>
        )}
        {error && <div className="m-3 rounded-app border border-danger-fg bg-danger-bg p-3 text-[12px] text-danger-fg">{error}</div>}
        {!loading && !error && data && <PreviewBody data={data} />}
      </div>
    </aside>
  )
}

function PreviewBody({ data }: { data: PreviewData }): JSX.Element {
  if (data.kind === 'image') {
    return (
      <div className="grid min-h-full place-items-center bg-[repeating-conic-gradient(var(--bg-tertiary)_0_25%,transparent_0_50%)] [background-size:18px_18px] p-3">
        <img src={data.content} alt={data.name} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (data.kind === 'binary') {
    return <InfoCard data={data} />
  }

  // text / code / json / markdown
  return (
    <div className="p-3">
      {data.truncated && (
        <div className="mb-2 rounded-app border border-warning-fg bg-warning-bg px-2.5 py-1 text-[11px] text-warning-fg">
          Aperçu partiel (fichier volumineux).
        </div>
      )}
      {data.kind === 'markdown' ? (
        <div className="text-[13px] leading-relaxed text-fg">{renderMarkdown(data.content ?? '')}</div>
      ) : (
        <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-fg-secondary">
          {data.kind === 'json' ? highlightJson(data.content ?? '') : data.content}
        </pre>
      )}
    </div>
  )
}

function InfoCard({ data }: { data: PreviewData }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <FileQuestion size={36} className="text-fg-muted" />
      <div className="text-[13px] font-medium text-fg">{data.name}</div>
      {data.note && <div className="text-[12px] text-fg-muted">{data.note}</div>}
      <div className="text-[12px] text-fg-muted">
        {formatSize(data.size, 'file')} · {formatDate(data.modifiedMs)}
      </div>
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => void window.api.fs.open(data.path)}
          className="flex items-center gap-1.5 rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
        >
          <ExternalLink size={13} /> Ouvrir
        </button>
        <button
          onClick={() => void window.api.fs.reveal(data.path)}
          className="flex items-center gap-1.5 rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
        >
          <FolderOpen size={13} /> Révéler
        </button>
      </div>
    </div>
  )
}

/* ----- Coloration JSON (sans dépendance) ----- */

function highlightJson(src: string): React.ReactNode[] {
  let text = src
  try {
    text = JSON.stringify(JSON.parse(src), null, 2)
  } catch {
    /* JSON invalide : on affiche le texte brut */
  }
  const re = /"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  const out: React.ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    let color = 'var(--fg)'
    if (tok.startsWith('"')) {
      // Clé si suivie (espaces ignorés) d'un « : ».
      const after = text.slice(re.lastIndex).match(/^\s*:/)
      color = after ? 'var(--info-fg)' : 'var(--success-fg)'
    } else if (tok === 'true' || tok === 'false' || tok === 'null') {
      color = 'var(--accent)'
    } else {
      color = 'var(--warning-fg)'
    }
    out.push(
      <span key={key++} style={{ color }}>
        {tok}
      </span>
    )
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/* ----- Rendu Markdown minimal (sans dépendance, sans HTML brut) ----- */

function renderInline(text: string, kp: string): React.ReactNode[] {
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={kp + i} className="rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[12px] text-accent">
          {tok.slice(1, -1)}
        </code>
      )
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={kp + i}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={kp + i}>{tok.slice(1, -1)}</em>)
    } else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)
      if (mm) nodes.push(<span key={kp + i} className="text-accent underline" title={mm[2]}>{mm[1]}</span>)
    }
    i++
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function heading(level: number, children: React.ReactNode, key: number): JSX.Element {
  const lvl = Math.min(level, 6)
  const size = ['text-[18px]', 'text-[16px]', 'text-[15px]', 'text-[14px]', 'text-[13px]', 'text-[13px]'][lvl - 1]
  const c = `mb-2 mt-3 font-semibold text-fg ${size}`
  switch (lvl) {
    case 1:
      return <h1 key={key} className={c}>{children}</h1>
    case 2:
      return <h2 key={key} className={c}>{children}</h2>
    case 3:
      return <h3 key={key} className={c}>{children}</h3>
    case 4:
      return <h4 key={key} className={c}>{children}</h4>
    case 5:
      return <h5 key={key} className={c}>{children}</h5>
    default:
      return <h6 key={key} className={c}>{children}</h6>
  }
}

function isSpecial(line: string): boolean {
  return (
    line.startsWith('#') ||
    line.startsWith('```') ||
    line.startsWith('>') ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())
  )
}

function renderMarkdown(src: string): React.ReactNode[] {
  const lines = src.split(/\r?\n/)
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // saute la clôture
      blocks.push(
        <pre key={key++} className="my-2 overflow-auto rounded-app bg-bg-tertiary p-2.5 font-mono text-[12px] text-fg-secondary">
          {buf.join('\n')}
        </pre>
      )
      continue
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push(heading(h[1].length, renderInline(h[2], `h${key}`), key++))
      i++
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-3 border-border" />)
      i++
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++} className="my-2 ml-5 list-disc space-y-0.5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `li${key}-${j}`)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={key++} className="my-2 ml-5 list-decimal space-y-0.5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ol${key}-${j}`)}</li>
          ))}
        </ol>
      )
      continue
    }

    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push(
        <blockquote key={key++} className="my-2 border-l-2 border-accent pl-3 text-fg-secondary">
          {renderInline(buf.join(' '), `bq${key}`)}
        </blockquote>
      )
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isSpecial(lines[i])) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++} className="my-2">
        {renderInline(para.join(' '), `p${key}`)}
      </p>
    )
  }
  return blocks
}
