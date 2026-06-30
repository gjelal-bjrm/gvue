import { useMemo, useState } from 'react'
import { FolderPlus, X, AlertTriangle } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { baseName } from '../lib/format'

/** Nettoie un segment de nom de dossier (caractères interdits Windows retirés). */
function cleanSeg(s: string): string {
  return s.replace(/[<>:"/\|?*]/g, "").replace(/[. ]+$/g, "").trim()
}

/** Date du jour formatée. */
function today(fmt: string): string {
  const d = new Date()
  const Y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  if (fmt === 'DD-MM-YYYY') return `${D}-${M}-${Y}`
  if (fmt === 'YYYYMMDD') return `${Y}${M}${D}`
  return `${Y}-${M}-${D}`
}

/**
 * Création de dossiers en lot : un motif avec jetons ({n} numéro, {name} depuis
 * une liste, {date}, {i}) étendu en plusieurs dossiers, plus une sous-structure
 * (sous-dossiers relatifs) répliquée dans chacun. Création récursive (mkdir -p).
 */
export default function FolderCreator(): JSX.Element | null {
  const open = useUiStore((s) => s.folderCreatorOpen)
  const setOpen = useUiStore((s) => s.setFolderCreator)
  const targetBase = useUiStore((s) => s.folderCreatorBase)
  const activeDir = useNavStore((s) => activePane(s).path)
  // Dossier cible : celui passé au clic droit, sinon le volet actif.
  const baseDir = targetBase ?? activeDir
  const [template, setTemplate] = useState('Dossier-{n}')
  const [names, setNames] = useState('')
  const [count, setCount] = useState(5)
  const [start, setStart] = useState(1)
  const [pad, setPad] = useState(2)
  const [dateFmt, setDateFmt] = useState('YYYY-MM-DD')
  const [subs, setSubs] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const rels = useMemo(() => {
    const nameLines = names.split('\n').map((s) => s.trim()).filter(Boolean)
    const n = nameLines.length > 0 ? nameLines.length : Math.max(0, Math.min(1000, count))
    const subLines = subs
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) =>
        s
          .replace(/\\+/g, '/')
          .split('/')
          .map(cleanSeg)
          .filter(Boolean)
          .join('/')
      )
      .filter(Boolean)
    const date = today(dateFmt)
    const out: string[] = []
    const seen = new Set<string>()
    for (let i = 0; i < n; i++) {
      const num = String(start + i).padStart(Math.max(1, pad), '0')
      const folder = cleanSeg(
        template
          .replaceAll('{n}', num)
          .replaceAll('{name}', nameLines[i] ?? '')
          .replaceAll('{date}', date)
          .replaceAll('{i}', String(i + 1))
      )
      if (!folder) continue
      const paths = subLines.length ? [folder, ...subLines.map((s) => `${folder}/${s}`)] : [folder]
      for (const p of paths) {
        if (!seen.has(p)) {
          seen.add(p)
          out.push(p)
        }
      }
    }
    return out
  }, [template, names, count, start, pad, dateFmt, subs])

  const topCount = useMemo(() => new Set(rels.map((r) => r.split('/')[0])).size, [rels])

  if (!open) return null

  const close = (): void => setOpen(false)

  const create = async (): Promise<void> => {
    if (rels.length === 0) return
    setBusy(true)
    setResult(null)
    const r = await window.api.fs.makeDirs(baseDir, rels)
    setBusy(false)
    if (r.errors.length) {
      setResult(`${r.created} créé(s), ${r.errors.length} erreur(s) : ${r.errors[0]}`)
    } else {
      useNavStore.getState().refreshAll()
      close()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[82vh] w-[min(760px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <FolderPlus size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">
            Créer des dossiers dans {baseName(baseDir) || baseDir}
          </span>
          <button
            onClick={close}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Réglages */}
          <div className="w-1/2 shrink-0 space-y-3 overflow-auto border-r border-border p-4 text-[12px]">
            <Field label="Motif du nom">
              <Input value={template} onChange={setTemplate} placeholder="ex. Projet-{n} ou {date}_{name}" />
              <p className="mt-1 text-[11px] text-fg-muted">
                Jetons : <code>{'{n}'}</code> numéro · <code>{'{name}'}</code> liste ·{' '}
                <code>{'{date}'}</code> · <code>{'{i}'}</code> index
              </p>
            </Field>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-fg-muted">
                Nombre
                <NumInput value={count} onChange={setCount} disabled={names.trim().length > 0} />
              </label>
              <label className="flex flex-col gap-1 text-fg-muted">
                Début {'{n}'}
                <NumInput value={start} onChange={setStart} />
              </label>
              <label className="flex flex-col gap-1 text-fg-muted">
                Chiffres
                <NumInput value={pad} onChange={setPad} />
              </label>
              <label className="flex flex-col gap-1 text-fg-muted">
                Date
                <select
                  value={dateFmt}
                  onChange={(e) => setDateFmt(e.target.value)}
                  className="rounded-app border border-border bg-bg px-2 py-1.5 text-fg outline-none focus:border-accent"
                >
                  <option>YYYY-MM-DD</option>
                  <option>DD-MM-YYYY</option>
                  <option>YYYYMMDD</option>
                </select>
              </label>
            </div>

            <Field label="Liste de noms (un par ligne) → remplit {name}, fixe le nombre">
              <textarea
                value={names}
                onChange={(e) => setNames(e.target.value)}
                rows={4}
                placeholder={'Alice\nBob\nCharlie'}
                spellCheck={false}
                className="w-full resize-none rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none focus:border-accent"
              />
            </Field>

            <Field label="Sous-dossiers, répliqués dans chaque dossier (un par ligne)">
              <textarea
                value={subs}
                onChange={(e) => setSubs(e.target.value)}
                rows={4}
                placeholder={'src\nsrc/components\nassets\ndocs'}
                spellCheck={false}
                className="w-full resize-none rounded-app border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-fg outline-none focus:border-accent"
              />
            </Field>
          </div>

          {/* Aperçu */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-fg-muted">
              Aperçu — {topCount} dossier(s), {rels.length} chemin(s)
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[12px]">
              {rels.length === 0 ? (
                <p className="px-1 py-3 text-fg-muted">Rien à créer.</p>
              ) : (
                rels.slice(0, 500).map((r) => (
                  <div key={r} className="truncate text-fg-secondary" title={r}>
                    {r}
                  </div>
                ))
              )}
              {rels.length > 500 && <div className="px-1 text-fg-muted">… +{rels.length - 500}</div>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-3">
          {result && (
            <span className="flex items-center gap-1.5 truncate text-[12px] text-danger-fg">
              <AlertTriangle size={14} /> {result}
            </span>
          )}
          <button
            onClick={close}
            className="ml-auto rounded-app px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
          >
            Annuler
          </button>
          <button
            onClick={() => void create()}
            disabled={busy || rels.length === 0}
            className="rounded-app bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            Créer ({topCount})
          </button>
        </div>
      </div>
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-fg-muted">{props.label}</span>
      {props.children}
    </label>
  )
}

function Input(props: { value: string; onChange: (v: string) => void; placeholder: string }): JSX.Element {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      spellCheck={false}
      className="w-full rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
    />
  )
}

function NumInput(props: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <input
      type="number"
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(Number(e.target.value) || 0)}
      className="w-16 rounded-app border border-border bg-bg px-2 py-1.5 text-fg outline-none focus:border-accent disabled:opacity-40"
    />
  )
}
