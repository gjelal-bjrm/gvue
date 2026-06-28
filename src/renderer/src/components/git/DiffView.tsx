interface DiffRow {
  kind: 'hunk' | 'add' | 'del' | 'ctx' | 'meta'
  oldNo?: number
  newNo?: number
  text: string
}

/** Parse un diff unifié en lignes avec numéros (ancien/nouveau) — façon GitHub Desktop. */
function parseDiff(diff: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldNo = 0
  let newNo = 0
  const lines = diff.split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  for (const raw of lines) {
    if (raw.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
      if (m) {
        oldNo = parseInt(m[1], 10)
        newNo = parseInt(m[2], 10)
      }
      rows.push({ kind: 'hunk', text: raw })
      continue
    }
    if (
      raw.startsWith('diff ') ||
      raw.startsWith('index ') ||
      raw.startsWith('+++ ') ||
      raw.startsWith('--- ') ||
      raw.startsWith('new file') ||
      raw.startsWith('deleted file') ||
      raw.startsWith('similarity ') ||
      raw.startsWith('rename ') ||
      raw.startsWith('old mode') ||
      raw.startsWith('new mode')
    ) {
      continue // bruit d'en-tête git
    }
    if (raw.startsWith('\\')) {
      rows.push({ kind: 'meta', text: raw })
      continue
    }
    if (raw.startsWith('+')) {
      rows.push({ kind: 'add', newNo, text: raw.slice(1) })
      newNo++
    } else if (raw.startsWith('-')) {
      rows.push({ kind: 'del', oldNo, text: raw.slice(1) })
      oldNo++
    } else {
      const t = raw.startsWith(' ') ? raw.slice(1) : raw
      rows.push({ kind: 'ctx', oldNo, newNo, text: t })
      oldNo++
      newNo++
    }
  }
  return rows
}

const ADD_BG = 'rgba(46,160,67,0.18)'
const DEL_BG = 'rgba(248,81,73,0.18)'
const HUNK_BG = 'rgba(110,118,129,0.16)'

/** Rendu du diff façon GitHub Desktop : numéros de ligne + fonds vert/rouge. */
export default function DiffView({ diff }: { diff: string }): JSX.Element {
  const rows = parseDiff(diff)
  let maxNo = 0
  for (const r of rows) maxNo = Math.max(maxNo, r.oldNo ?? 0, r.newNo ?? 0)
  const gw = `${String(maxNo).length + 1}ch`
  return (
    <div className="font-mono text-[12px] leading-[1.5]">
      {rows.map((r, i) => {
        if (r.kind === 'hunk') {
          return (
            <div key={i} className="flex text-accent" style={{ backgroundColor: HUNK_BG }}>
              <span className="shrink-0 select-none" style={{ width: gw }} />
              <span className="shrink-0 select-none" style={{ width: gw }} />
              <span className="whitespace-pre-wrap break-all px-2">{r.text}</span>
            </div>
          )
        }
        if (r.kind === 'meta') {
          return (
            <div key={i} className="px-2 text-fg-muted">
              {r.text}
            </div>
          )
        }
        const bg = r.kind === 'add' ? ADD_BG : r.kind === 'del' ? DEL_BG : undefined
        const marker = r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ' '
        const markerCls =
          r.kind === 'add' ? 'text-success-fg' : r.kind === 'del' ? 'text-danger-fg' : 'text-fg-muted'
        return (
          <div key={i} className="flex" style={{ backgroundColor: bg }}>
            <span
              className="shrink-0 select-none border-r border-border px-1 text-right text-fg-muted tabular-nums"
              style={{ width: gw }}
            >
              {r.oldNo ?? ''}
            </span>
            <span
              className="shrink-0 select-none border-r border-border px-1 text-right text-fg-muted tabular-nums"
              style={{ width: gw }}
            >
              {r.newNo ?? ''}
            </span>
            <span className={`shrink-0 select-none px-1 ${markerCls}`}>{marker}</span>
            <span className="whitespace-pre-wrap break-all pr-2 text-fg">{r.text || ' '}</span>
          </div>
        )
      })}
    </div>
  )
}
