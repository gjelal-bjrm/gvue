/**
 * Bandeau du mode sélecteur (--pick) : GVue a été lancé par un autre outil G
 * (GRay…) pour choisir un fichier. Double-clic sur un fichier = choisi
 * (FileList.onActivate) ; le bouton valide la sélection courante (fichiers
 * seulement) ; Annuler ferme la fenêtre sans rien renvoyer.
 */
import { MousePointerClick } from 'lucide-react'
import { t, tn } from '../i18n'
import { useNavStore, activePane } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'

export default function PickerBanner(): JSX.Element | null {
  const pickMode = useUiStore((s) => s.pickMode)
  const pane = useNavStore(activePane)
  if (!pickMode) return null

  const files = pane.selected.filter(
    (p) => pane.entries.find((e) => e.path === p)?.kind !== 'directory'
  )

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-bg-secondary px-3 text-[12px]">
      <span className="flex shrink-0 items-center text-accent">
        <MousePointerClick size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {t('Mode sélecteur : double-clique un fichier, ou valide ta sélection.')}
      </span>
      <button
        onClick={() => void window.api.pick.confirm(files)}
        disabled={files.length === 0}
        className="rounded-app bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:cursor-default disabled:opacity-40"
      >
        {files.length > 1
          ? tn(files.length, 'Choisir {n} fichier', 'Choisir {n} fichiers')
          : t('Choisir la sélection')}
      </button>
      <button
        onClick={() => window.close()}
        className="rounded-app px-2.5 py-1 text-[12px] text-fg-muted hover:bg-bg-hover hover:text-fg"
      >
        {t('Annuler')}
      </button>
    </div>
  )
}
