import { Play, Hammer, FlaskConical, Rocket, TerminalSquare, Database, RefreshCw, Bug } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LaunchIcon } from '@shared/launches'
import { t } from '../i18n'

/**
 * Rendu des icônes de lancement — un seul endroit, partagé par la sidebar,
 * la barre du terminal et l'éditeur : une icône choisie se reconnaît partout.
 */
export const LAUNCH_ICON_MAP: Record<LaunchIcon, LucideIcon> = {
  play: Play,
  build: Hammer,
  test: FlaskConical,
  deploy: Rocket,
  terminal: TerminalSquare,
  database: Database,
  refresh: RefreshCw,
  bug: Bug
}

/** Libellés du sélecteur d'icône (traduits à l'appel, jamais au chargement). */
export function launchIconLabel(icon: LaunchIcon): string {
  switch (icon) {
    case 'play':
      return t('Démarrer')
    case 'build':
      return t('Construire')
    case 'test':
      return t('Tester')
    case 'deploy':
      return t('Déployer')
    case 'terminal':
      return t('Commande')
    case 'database':
      return t('Base de données')
    case 'refresh':
      return t('Rafraîchir')
    case 'bug':
      return t('Déboguer')
  }
}
