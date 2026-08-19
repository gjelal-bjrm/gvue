import { Play, Square } from 'lucide-react'
import { normalizeLaunches } from '@shared/launches'
import { useRunnerStore, launchKey } from '../../state/useRunnerStore'
import { LAUNCH_ICON_MAP } from '../../lib/launchIcons'
import { t } from '../../i18n'

/**
 * Boutons de lancement d'un projet (dév, build, déploiement…), sur la ligne
 * de la sidebar. Partagé par les projets et les favoris.
 *
 * Place : au repos seuls les lancements EN COURS s'affichent (on voit d'un
 * coup d'œil ce qui tourne) ; les autres apparaissent au survol et
 * n'occupent aucune largeur avant — sans quoi quatre icônes rogneraient en
 * permanence le nom du dossier.
 */
export default function LaunchButtons(props: {
  root: string
  /** Aucun lancement configuré : un ▶ unique qui ouvre la configuration. */
  onConfigure: (e: React.MouseEvent) => void
}): JSX.Element {
  const stored = useRunnerStore((s) => s.projectLaunch[props.root])
  const running = useRunnerStore((s) => s.running)
  const runLaunch = useRunnerStore((s) => s.runLaunch)
  const stopLaunch = useRunnerStore((s) => s.stopLaunch)
  const launches = normalizeLaunches(stored)

  if (launches.length === 0) {
    return (
      <button
        onClick={props.onConfigure}
        title={t('Définir puis lancer')}
        className="hidden h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-success-fg group-hover:grid"
      >
        <Play size={13} />
      </button>
    )
  }

  return (
    <>
      {launches.map((l) => {
        const on = Boolean(running[launchKey(props.root, l.id)])
        const Icon = LAUNCH_ICON_MAP[l.icon] ?? Play
        return (
          <button
            key={l.id}
            onClick={(e) => {
              e.stopPropagation()
              if (on) stopLaunch(props.root, l.id)
              else void runLaunch(props.root, l.id)
            }}
            title={on ? t('Arrêter : {name}', { name: l.name }) : `${l.name} — ${l.command}`}
            className={`h-6 w-6 shrink-0 place-items-center rounded hover:bg-bg-hover ${
              on
                ? 'grid text-danger-fg'
                : 'hidden text-fg-muted hover:text-success-fg group-hover:grid'
            }`}
          >
            {on ? <Square size={12} /> : <Icon size={13} />}
          </button>
        )
      })}
    </>
  )
}
