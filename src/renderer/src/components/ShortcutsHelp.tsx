import { useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'

interface Row {
  keys: string[]
  label: string
}

interface Group {
  title: string
  rows: Row[]
}

/** Tous les raccourcis de l'application, par catégorie (source de l'antisèche F1). */
const GROUPS: Group[] = [
  {
    title: 'Général',
    rows: [
      { keys: ['Ctrl', 'P'], label: 'Palette de commandes' },
      { keys: ['Ctrl', 'Maj', 'N'], label: 'Nouvelle fenêtre GVue' },
      { keys: ['F1'], label: 'Cette aide' },
      { keys: ['Échap'], label: 'Fermer le dialogue / menu en cours' }
    ]
  },
  {
    title: 'Onglets & volets',
    rows: [
      { keys: ['Ctrl', 'T'], label: 'Nouvel onglet (même dossier)' },
      { keys: ['Ctrl', 'W'], label: "Fermer l'onglet actif" },
      { keys: ['Clic milieu'], label: 'Fermer un onglet' },
      { keys: ['⫿ Diviser'], label: 'Nouvelle colonne côte à côte (max 3)' }
    ]
  },
  {
    title: 'Navigation',
    rows: [
      { keys: ['Ret. arrière'], label: 'Dossier parent' },
      { keys: ['Souris 4 / 5'], label: 'Précédent / Suivant' },
      { keys: ['↑ ↓', 'Début', 'Fin', 'Pg↑↓'], label: 'Déplacer la sélection' },
      { keys: ['a…z'], label: 'Aller au premier nom correspondant' },
      { keys: ['Entrée'], label: "Ouvrir l'élément sélectionné" },
      { keys: ['Ctrl', 'F'], label: 'Filtrer le dossier courant' },
      { keys: ['Ctrl', 'E'], label: 'Aller à un fichier… (recherche floue)' }
    ]
  },
  {
    title: 'Fichiers',
    rows: [
      { keys: ['Ctrl', 'A'], label: 'Tout sélectionner' },
      { keys: ['Ctrl', 'C / X / V'], label: 'Copier / Couper / Coller' },
      { keys: ['F2'], label: 'Renommer (sélection multiple : en masse)' },
      { keys: ['Suppr'], label: 'Supprimer vers la corbeille' },
      { keys: ['Ctrl', 'Z'], label: 'Annuler la dernière opération' },
      { keys: ['Glisser', '+ Maj / Ctrl'], label: 'Déplacer / forcer la copie' },
      { keys: ['Glisser clic droit'], label: 'Menu « Copier / Déplacer ici »' },
      { keys: ['Double-clic'], label: 'Ouvrir (dossier ou application)' }
    ]
  },
  {
    title: 'Terminal',
    rows: [
      { keys: ['Ctrl', 'F'], label: 'Rechercher dans le terminal' },
      { keys: ['Entrée', 'Maj+Entrée'], label: 'Correspondance suivante / précédente' },
      { keys: ['Tab'], label: 'Accepter la suggestion (texte gris)' },
      { keys: ['Clic droit'], label: 'Copier la sélection, sinon coller' },
      { keys: ['Double-clic (barre)'], label: 'Plein espace / restaurer' }
    ]
  }
]

/** Antisèche des raccourcis clavier (F1, palette, ou bouton « ? »). */
export default function ShortcutsHelp(): JSX.Element | null {
  const open = useUiStore((s) => s.shortcutsOpen)
  const close = (): void => useUiStore.getState().setShortcuts(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[86vh] w-[min(760px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Keyboard size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">Raccourcis clavier</span>
          <span className="text-[11px] text-fg-muted">F1 pour rouvrir cette aide</span>
          <button
            onClick={close}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-8 gap-y-5 overflow-auto p-4 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
                {g.title}
              </h3>
              <div className="flex flex-col">
                {g.rows.map((r) => (
                  <div key={r.label} className="flex items-center gap-2 py-1">
                    <span className="flex shrink-0 flex-wrap items-center gap-1">
                      {r.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[11px] text-fg-secondary"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-fg-secondary" title={r.label}>
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
