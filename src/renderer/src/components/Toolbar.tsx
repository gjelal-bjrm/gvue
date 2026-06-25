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
  Palette,
  CaseSensitive,
  WholeWord,
  Regex,
  X,
  Copy,
  Check,
  Filter,
  FilterX,
  PanelRight,
  Columns2
} from 'lucide-react'
import { useNavStore, activePane } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'
import { useSearchStore } from '../state/useSearchStore'
import { breadcrumbSegments } from '../lib/format'
import WorkspaceMenu from './WorkspaceMenu'

/** Compare deux chemins en ignorant la casse et le séparateur final (Windows). */
function samePath(a: string, b: string): boolean {
  const norm = (s: string): string => s.replace(/[\\/]+$/, '').toLowerCase()
  return norm(a) === norm(b)
}

/**
 * Barre d'outils : navigation, barre d'adresse façon explorateur Windows
 * (fil d'Ariane cliquable + édition texte, copie, validation par Entrée avec
 * vérification d'existence) et champ de recherche ripgrep.
 */
export default function Toolbar(): JSX.Element {
  const active = useNavStore(activePane)
  const { path, back, forward, parent } = active
  const goBack = useNavStore((s) => s.goBack)
  const goForward = useNavStore((s) => s.goForward)
  const goParent = useNavStore((s) => s.goParent)
  const goHome = useNavStore((s) => s.goHome)
  const navigate = useNavStore((s) => s.navigate)
  const refresh = useNavStore((s) => s.refresh)
  const showHidden = useNavStore((s) => s.showHidden)
  const toggleHidden = useNavStore((s) => s.toggleHidden)
  const hideGitIgnored = useNavStore((s) => s.hideGitIgnored)
  const toggleGitIgnored = useNavStore((s) => s.toggleGitIgnored)
  const paneCount = useNavStore((s) => s.panes.length)
  const addPane = useNavStore((s) => s.addPane)
  const appearanceOpen = useUiStore((s) => s.appearanceOpen)
  const toggleAppearance = useUiStore((s) => s.toggleAppearance)
  const previewOpen = useUiStore((s) => s.previewOpen)
  const togglePreview = useUiStore((s) => s.togglePreview)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(path)
  const [pathError, setPathError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(path)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing, path])

  const segments = breadcrumbSegments(path)

  const startEdit = (): void => {
    setPathError(null)
    setEditing(true)
  }

  const cancelEdit = (): void => {
    setEditing(false)
    setPathError(null)
  }

  // Validation façon Windows : on ne navigue que si le chemin existe.
  // Dossier → navigation ; fichier → ouverture ; inexistant → message, on
  // garde le champ ouvert pour correction.
  const submit = async (): Promise<void> => {
    const target = draft.trim()
    if (!target || samePath(target, path)) {
      cancelEdit()
      return
    }
    let kind: Awaited<ReturnType<typeof window.api.fs.probe>>
    try {
      kind = await window.api.fs.probe(target)
    } catch {
      kind = 'missing'
    }
    if (kind === 'directory') {
      setEditing(false)
      setPathError(null)
      navigate(target)
    } else if (kind === 'file') {
      setEditing(false)
      setPathError(null)
      void window.api.fs.open(target)
    } else {
      setPathError(`Ce chemin n'existe pas : ${target}`)
      inputRef.current?.focus()
    }
  }

  const copyPath = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* presse-papiers indisponible */
    }
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
        <NavBtn
          onClick={toggleGitIgnored}
          title={
            hideGitIgnored
              ? 'Afficher les fichiers ignorés par .gitignore'
              : 'Masquer les fichiers ignorés par .gitignore'
          }
          active={!hideGitIgnored}
        >
          {hideGitIgnored ? <FilterX size={16} /> : <Filter size={16} />}
        </NavBtn>
      </div>

      {/* Barre d'adresse */}
      <div className="relative min-w-0 flex-1">
        <div
          className={`flex h-8 items-center rounded-app border bg-bg-tertiary px-2.5 ${
            pathError ? 'border-danger-fg' : 'border-border'
          }`}
          onClick={() => {
            if (!editing) startEdit()
          }}
          title={editing ? undefined : 'Cliquez pour éditer le chemin'}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={cancelEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
                if (e.key === 'Escape') cancelEdit()
              }}
              className="w-full bg-transparent text-[13px] text-fg outline-none"
              spellCheck={false}
              autoComplete="off"
            />
          ) : (
            <>
              <div className="flex min-w-0 flex-1 items-center overflow-hidden text-[13px]">
                {segments.map((seg, i) => (
                  <span key={seg.path} className="flex shrink-0 items-center">
                    {i > 0 && <ChevronRight size={14} className="mx-0.5 text-fg-muted" />}
                    <button
                      className={`rounded px-1 py-0.5 hover:bg-bg-hover ${
                        i === segments.length - 1 ? 'text-fg' : 'text-fg-secondary'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(seg.path)
                      }}
                    >
                      {seg.label}
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void copyPath()
                }}
                title="Copier le chemin"
                className="ml-1 grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
              >
                {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
              </button>
            </>
          )}
        </div>
        {pathError && (
          <div className="absolute left-0 top-full z-30 mt-1 max-w-full truncate rounded-app border border-danger-fg bg-danger-bg px-2.5 py-1 text-[12px] text-danger-fg shadow-lg">
            {pathError}
          </div>
        )}
      </div>

      {/* Recherche ripgrep */}
      <SearchBox />

      <WorkspaceMenu />
      <NavBtn
        onClick={() => void addPane()}
        disabled={paneCount >= 3}
        title="Diviser — nouveau volet"
      >
        <Columns2 size={17} />
      </NavBtn>
      <NavBtn onClick={togglePreview} title="Panneau d'aperçu" active={previewOpen}>
        <PanelRight size={17} />
      </NavBtn>
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

/**
 * Champ de recherche ripgrep : saisie + bascules (casse, mot entier, regex).
 * Entrée lance la recherche sur le dossier courant ; Échap ferme le panneau.
 */
function SearchBox(): JSX.Element {
  const dir = useNavStore((s) => activePane(s).path)
  const query = useSearchStore((s) => s.query)
  const caseSensitive = useSearchStore((s) => s.caseSensitive)
  const wholeWord = useSearchStore((s) => s.wholeWord)
  const regex = useSearchStore((s) => s.regex)
  const active = useSearchStore((s) => s.active)
  const { setQuery, toggleCase, toggleWord, toggleRegex, run, close } = useSearchStore()

  return (
    <div className="flex h-8 w-72 items-center gap-1.5 rounded-app border border-border bg-bg-tertiary pl-2.5 pr-1">
      <Search size={15} className="shrink-0 text-fg-muted" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void run(dir)
          if (e.key === 'Escape') close()
        }}
        placeholder="Rechercher (rg)…"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-muted"
      />
      {active && (
        <button
          onClick={close}
          title="Fermer la recherche"
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <X size={14} />
        </button>
      )}
      <div className="flex shrink-0 items-center">
        <SearchToggle on={caseSensitive} onClick={toggleCase} title="Respecter la casse">
          <CaseSensitive size={14} />
        </SearchToggle>
        <SearchToggle on={wholeWord} onClick={toggleWord} title="Mot entier">
          <WholeWord size={14} />
        </SearchToggle>
        <SearchToggle on={regex} onClick={toggleRegex} title="Expression régulière">
          <Regex size={14} />
        </SearchToggle>
      </div>
    </div>
  )
}

function SearchToggle(props: {
  on: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      className={`grid h-6 w-6 place-items-center rounded transition-colors ${
        props.on ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
      }`}
    >
      {props.children}
    </button>
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
