import { useMemo, useState } from 'react'
import { Pencil, X, ArrowRight, AlertTriangle } from 'lucide-react'
import { baseName } from '../lib/format'

/** Échappe une chaîne pour l'utiliser comme motif regex littéral. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface Rules {
  find: string
  replace: string
  regex: boolean
  ci: boolean
  prefix: string
  suffix: string
  numbering: boolean
  start: number
  pad: number
  numPos: 'prefix' | 'suffix'
  numSep: string
}

/**
 * Renommage en masse : applique des règles (rechercher/remplacer + regex,
 * préfixe/suffixe, numérotation) à une sélection, avec aperçu et détection des
 * conflits, puis renomme via fs.rename.
 */
export default function BulkRenameDialog(props: {
  paths: string[]
  onClose: () => void
  onDone: () => void
}): JSX.Element {
  const [r, setR] = useState<Rules>({
    find: '',
    replace: '',
    regex: false,
    ci: false,
    prefix: '',
    suffix: '',
    numbering: false,
    start: 1,
    pad: 2,
    numPos: 'suffix',
    numSep: '_'
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<Rules>): void => setR((prev) => ({ ...prev, ...patch }))

  const names = useMemo(() => props.paths.map((p) => baseName(p)), [props.paths])

  // Calcule les nouveaux noms + détecte motif regex invalide.
  const { newNames, regexError } = useMemo(() => {
    let re: RegExp | null = null
    let regexError = false
    if (r.find) {
      try {
        re = new RegExp(r.regex ? r.find : escapeRe(r.find), 'g' + (r.ci ? 'i' : ''))
      } catch {
        regexError = true
      }
    }
    const newNames = names.map((name, i) => {
      let n = name
      if (re) n = n.replace(re, r.replace)
      const dot = n.lastIndexOf('.')
      let base = dot > 0 ? n.slice(0, dot) : n
      const ext = dot > 0 ? n.slice(dot) : ''
      base = r.prefix + base + r.suffix
      if (r.numbering) {
        const num = String(r.start + i).padStart(Math.max(1, r.pad), '0')
        base = r.numPos === 'prefix' ? num + r.numSep + base : base + r.numSep + num
      }
      return base + ext
    })
    return { newNames, regexError }
  }, [names, r])

  // Conflits : nom vide, ou doublon dans la nouvelle liste.
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of newNames) m.set(n, (m.get(n) ?? 0) + 1)
    return m
  }, [newNames])
  const hasEmpty = newNames.some((n) => !n.trim())
  const hasDup = newNames.some((n) => (counts.get(n) ?? 0) > 1)
  const changedCount = newNames.filter((n, i) => n !== names[i]).length
  const blocked = regexError || hasEmpty || hasDup || changedCount === 0

  const apply = async (): Promise<void> => {
    if (blocked) return
    setBusy(true)
    setError(null)
    try {
      for (let i = 0; i < props.paths.length; i++) {
        if (newNames[i] === names[i]) continue
        const res = await window.api.fs.rename(props.paths[i], newNames[i])
        if (!res.ok) {
          setError(`Échec sur « ${names[i]} » : ${res.error ?? 'erreur'}`)
          break
        }
      }
    } finally {
      setBusy(false)
      props.onDone()
      props.onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={props.onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[80vh] w-[min(720px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Pencil size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">Renommer en masse — {names.length} éléments</span>
          <button
            onClick={props.onClose}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        {/* Règles */}
        <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-[12px]">
          <Field label="Rechercher">
            <Input value={r.find} onChange={(v) => set({ find: v })} placeholder="texte ou regex" />
          </Field>
          <Field label="Remplacer par">
            <Input value={r.replace} onChange={(v) => set({ replace: v })} placeholder="(vide = supprimer)" />
          </Field>
          <div className="col-span-2 flex items-center gap-4">
            <Check label="Expression régulière" checked={r.regex} onChange={(v) => set({ regex: v })} />
            <Check label="Ignorer la casse" checked={r.ci} onChange={(v) => set({ ci: v })} />
            {regexError && <span className="text-[11px] text-danger-fg">Regex invalide</span>}
          </div>
          <Field label="Préfixe">
            <Input value={r.prefix} onChange={(v) => set({ prefix: v })} placeholder="" />
          </Field>
          <Field label="Suffixe (avant l'extension)">
            <Input value={r.suffix} onChange={(v) => set({ suffix: v })} placeholder="" />
          </Field>
          <div className="col-span-2 flex flex-wrap items-center gap-3">
            <Check label="Numéroter" checked={r.numbering} onChange={(v) => set({ numbering: v })} />
            {r.numbering && (
              <>
                <label className="flex items-center gap-1 text-fg-muted">
                  début
                  <NumInput value={r.start} onChange={(v) => set({ start: v })} />
                </label>
                <label className="flex items-center gap-1 text-fg-muted">
                  chiffres
                  <NumInput value={r.pad} onChange={(v) => set({ pad: v })} />
                </label>
                <label className="flex items-center gap-1 text-fg-muted">
                  séparateur
                  <input
                    value={r.numSep}
                    onChange={(e) => set({ numSep: e.target.value })}
                    className="w-10 rounded-app border border-border bg-bg px-1.5 py-1 text-center text-fg outline-none focus:border-accent"
                  />
                </label>
                <select
                  value={r.numPos}
                  onChange={(e) => set({ numPos: e.target.value as 'prefix' | 'suffix' })}
                  className="rounded-app border border-border bg-bg px-2 py-1 text-fg outline-none focus:border-accent"
                >
                  <option value="suffix">à la fin</option>
                  <option value="prefix">au début</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Aperçu */}
        <div className="min-h-0 flex-1 overflow-auto border-t border-border">
          {names.map((name, i) => {
            const nn = newNames[i]
            const dup = (counts.get(nn) ?? 0) > 1
            const empty = !nn.trim()
            const changed = nn !== name
            return (
              <div key={props.paths[i]} className="flex items-center gap-2 px-4 py-1 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-fg-muted">{name}</span>
                <ArrowRight size={12} className="shrink-0 text-fg-muted" />
                <span
                  className={`min-w-0 flex-1 truncate ${
                    empty || dup ? 'text-danger-fg' : changed ? 'text-accent' : 'text-fg-secondary'
                  }`}
                >
                  {nn || '(vide)'}
                  {dup && <span className="ml-1 text-[10px]">⚠ doublon</span>}
                </span>
              </div>
            )
          })}
        </div>

        {/* Pied */}
        <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-3">
          {(hasDup || hasEmpty) && (
            <span className="flex items-center gap-1.5 text-[12px] text-danger-fg">
              <AlertTriangle size={14} /> {hasEmpty ? 'Des noms sont vides.' : 'Des noms sont en doublon.'}
            </span>
          )}
          {error && <span className="truncate text-[12px] text-danger-fg">{error}</span>}
          <span className="ml-auto text-[12px] text-fg-muted">{changedCount} à renommer</span>
          <button
            onClick={props.onClose}
            className="rounded-app px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
          >
            Annuler
          </button>
          <button
            onClick={() => void apply()}
            disabled={blocked || busy}
            className="rounded-app bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            Renommer{changedCount > 0 ? ` (${changedCount})` : ''}
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
      className="rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
    />
  )
}

function NumInput(props: { value: number; onChange: (v: number) => void }): JSX.Element {
  return (
    <input
      type="number"
      value={props.value}
      onChange={(e) => props.onChange(Number(e.target.value) || 0)}
      className="w-14 rounded-app border border-border bg-bg px-1.5 py-1 text-fg outline-none focus:border-accent"
    />
  )
}

function Check(props: { label: string; checked: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <label className="flex items-center gap-1.5 text-fg-secondary">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="accent-[var(--accent)]"
      />
      {props.label}
    </label>
  )
}
