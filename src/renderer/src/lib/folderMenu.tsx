import {
  FolderOpen,
  TerminalSquare,
  ExternalLink,
  Copy,
  FolderPlus,
  PieChart,
  Star,
  StarOff,
  Info
} from 'lucide-react'
import type { MenuEntry } from '../components/ContextMenu'
import { useNavStore } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'
import { useTerminalStore } from '../state/useTerminalStore'
import { useFavoritesStore } from '../state/useFavoritesStore'
import { t } from '../i18n'

/**
 * Menu contextuel commun pour un dossier (sidebar, arbre, favoris, projets).
 * Les actions ciblent `dir` ; « Créer des dossiers » s'ouvre directement dans ce
 * dossier — utile quand le volet est plein et n'a pas de zone vide cliquable.
 */
export function buildFolderMenu(dir: string): MenuEntry[] {
  const fav = useFavoritesStore.getState()
  const isFav = fav.has(dir)
  const openTerminalHere = (): void => {
    useUiStore.getState().setTerminalOpen(true)
    void useTerminalStore.getState().openTab(undefined, dir)
  }
  return [
    { label: t('Ouvrir'), icon: <FolderOpen size={14} />, onClick: () => useNavStore.getState().navigate(dir) },
    { label: t('Ouvrir un terminal ici'), icon: <TerminalSquare size={14} />, onClick: openTerminalHere },
    { type: 'sep' },
    {
      label: t('Créer des dossiers… (en lot)'),
      icon: <FolderPlus size={14} />,
      onClick: () => useUiStore.getState().setFolderCreator(true, dir)
    },
    {
      label: t("Analyser l'espace disque"),
      icon: <PieChart size={14} />,
      onClick: () => useUiStore.getState().setDiskUsage(dir)
    },
    { type: 'sep' },
    {
      label: t('Copier le chemin'),
      icon: <Copy size={14} />,
      onClick: () => void navigator.clipboard?.writeText(dir)
    },
    {
      label: t("Révéler dans l'explorateur"),
      icon: <ExternalLink size={14} />,
      onClick: () => void window.api.fs.reveal(dir)
    },
    { type: 'sep' },
    {
      label: isFav ? t('Retirer des favoris') : t('Ajouter aux favoris'),
      icon: isFav ? <StarOff size={14} /> : <Star size={14} />,
      onClick: () => fav.toggle(dir)
    },
    {
      label: t('Propriétés'),
      icon: <Info size={14} />,
      onClick: () => window.api.apps.properties(dir)
    }
  ]
}
