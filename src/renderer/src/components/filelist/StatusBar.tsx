import GitWidget from '../GitWidget'
import { formatSize } from '../../lib/format'
import { tn } from '../../i18n'

/**
 * Barre d'état bas de liste : compteurs d'éléments, widget Git du volet actif,
 * et à droite le détail de la sélection (nombre + taille cumulée des fichiers).
 */
export default function StatusBar(props: {
  count: number
  total: number
  selectedCount: number
  /** Taille cumulée des fichiers sélectionnés (octets). */
  selectedBytes: number
  /** Nombre de dossiers dans la sélection (taille inconnue sans scan). */
  selectedDirs: number
  showGit: boolean
}): JSX.Element {
  const hiddenCount = props.total - props.count
  const files = props.selectedCount - props.selectedDirs
  const hiddenLabel = tn(hiddenCount, '{n} masqué', '{n} masqués')
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-bg-secondary px-3 py-1.5 text-[12px] text-fg-muted">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0">
          {tn(props.count, '{n} élément', '{n} éléments')}
          {hiddenCount > 0 && ` · ${hiddenLabel}`}
        </span>
        {props.showGit && <GitWidget />}
      </div>
      {props.selectedCount > 0 && (
        <span className="shrink-0 pl-3 text-fg-secondary">
          {tn(props.selectedCount, '{n} sélectionné', '{n} sélectionnés')}
          {files > 0 && props.selectedBytes > 0 && ` · ${formatSize(props.selectedBytes, 'file')}`}
          {props.selectedDirs > 0 && ` · ${tn(props.selectedDirs, '{n} dossier', '{n} dossiers')}`}
        </span>
      )}
    </div>
  )
}
