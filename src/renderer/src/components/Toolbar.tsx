import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Home,
  RotateCw,
  Search,
  ChevronRight,
  Eye,
  EyeOff,
  Palette
} from 'lucide-react'
import { useNavStore } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'
import { breadcrumbSegments } from '../lib/format'

/**
 * Barre d'outils : navigation, fil d'Ariane cliquable (édition manuelle au
 * double-clic) et champ de recherche ripgrep (câblé en phase 3).
 */
export default function Toolbar(): JSX.Element {
  const { path, back, forward, parent, goBack, goForward, goParent, goHome, navigate, refresh } =
    useNavStore()
  const showHidden = useNavStore((s) => s.showHidden)
  const toggleHidden = useNavStore((s) => s.toggleHidden)
  const appearanceOpen = useUiStore((s) => s.appearanceOpen)
  const toggleAppearance = useUiStore((s) => s.toggleAppearance)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(path)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(path)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing, path])

  const segments = breadcrumbSegments(path)

  const submit = (): void => {
    setEditing(false)
    if (draft.trim() && draft !== path) navigate(draft.trim())
  }

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-bg px-3">
      <div className="flex items-center gap-0.5">
        <NavBtn onClick={goBack} disabled={back.length === 0} title="Précédent">
          <ArrowLeft size={17} />
        </NavBtn>
        <NavBtn onClick={goForward} disabled={forward.length === 0} title="Suivant">
          <ArrowRight size={17} />
        </NavBtn>
        <NavBtn onClick={goParent} disabled={!parent} title="Dossier parent">
          <ArrowUp size={17} />
        </NavBtn>
        <NavBtn onClick={goHome} title="Accueil" accent>
          <Home size={17} />
        </NavBtn>
        <NavBtn onClick={refresh} title="Rafraîchir">
          <RotateCw size={15} />
        </NavBtn>
        <NavBtn
          onClick={toggleHidden}
          title={showHidden ? 'Masquer les éléments cachés' : 'Afficher les éléments cachés'}
          active={showHidden}
        >
          {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
        </NavBtn>
      </div>

      {/* Fil d'Ariane */}
      <div
        className="flex h-8 min-w-0 flex-1 items-center rounded-app border border-border bg-bg-tertiary px-2.5"
        onDoubleClick={() => setEditing(true)}
        title="Double-cliquez pour éditer le chemin"
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-full bg-transparent text-[13px] text-fg outline-none"
            spellCheck={false}
          />
        ) : (
          <div className="flex min-w-0 items-center overflow-hidden text-[13px]">
            {segments.map((seg, i) => (
              <span key={seg.path} className="flex shrink-0 items-center">
                {i > 0 && <ChevronRight size={14} className="mx-0.5 text-fg-muted" />}
                <button
                  className={`rounded px-1 py-0.5 hover:bg-bg-hover ${
                    i === segments.length - 1 ? 'text-fg' : 'text-fg-secondary'
                  }`}
                  onClick={() => navigate(seg.path)}
                >
                  {seg.label}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Recherche ripgrep (phase 3) */}
      <div
        className="flex h-8 w-44 items-center gap-2 rounded-app border border-border bg-bg-tertiary px-2.5 text-fg-muted"
        title="Recherche ripgrep — arrive en phase 3"
      >
        <Search size={15} />
        <span className="text-[12px]">Rechercher (rg)</span>
      </div>

      <NavBtn
        onClick={toggleAppearance}
        title="Panneau d'apparence"
        active={appearanceOpen}
      >
        <Palette size={17} />
      </NavBtn>
    </div>
  )
}

function NavBtn(props: {
  onClick: () => void
  disabled?: boolean
  title: string
  accent?: boolean
  active?: boolean
  children: React.ReactNode
}): JSX.Element {
  const tone = props.accent
    ? 'text-accent'
    : props.active
      ? 'bg-accent-soft text-accent'
      : 'text-fg-secondary hover:text-fg'
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-app transition-colors hover:bg-bg-hover disabled:opacity-30 disabled:hover:bg-transparent ${tone}`}
    >
      {props.children}
    </button>
  )
}
