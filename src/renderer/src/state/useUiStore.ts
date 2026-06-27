import { create } from 'zustand'
import type { CopyProgress } from '@shared/types'

/** Presse-papiers de fichiers interne (entre volets d'une même fenêtre). */
export interface FileClipboard {
  paths: string[]
  mode: 'copy' | 'cut'
}

/** Hauteur (en % de la zone) du panneau terminal à l'ouverture normale et en grand. */
const TERMINAL_DEFAULT = 32
const TERMINAL_LARGE = 60

/** État d'affichage des panneaux (terminal, apparence). */
interface UiState {
  terminalOpen: boolean
  appearanceOpen: boolean
  /** Panneau d'aperçu du fichier sélectionné ouvert ? */
  previewOpen: boolean
  /** Hauteur cible du panneau terminal (% de la zone verticale). */
  terminalSize: number
  /** Compteur incrémenté pour redéclencher l'agrandissement quand déjà ouvert. */
  terminalGrow: number
  /** Palette de commandes (Ctrl+Maj+P) ouverte ? */
  paletteOpen: boolean
  /** Recherche de fichiers par nom (Ctrl+E) ouverte ? */
  fileFinderOpen: boolean
  /** Dossier analysé pour l'espace disque (null = panneau fermé). */
  diskUsagePath: string | null
  /** Créateur de dossiers en lot ouvert ? */
  folderCreatorOpen: boolean
  /** Pop-up « Nouveautés » : version depuis laquelle montrer les notes (null = fermée). */
  whatsNewSince: string | null
  /** Terminaux affichés côte à côte (sinon en onglets, un seul visible). */
  terminalSplit: boolean
  /** Vue Git détaillée (façon GitHub Desktop) affichée à la place des volets ? */
  gitViewOpen: boolean
  /** Fichiers coupés/copiés en attente de collage. */
  clipboard: FileClipboard | null
  /** Message éphémère (toast) en bas de l'écran, ou null. */
  toast: string | null
  /** Jeton incrémenté à chaque toast pour relancer la temporisation de masquage. */
  toastSeq: number
  showToast: (message: string) => void
  clearToast: () => void
  /** Progression de la copie en cours (null = aucune). */
  copyProgress: CopyProgress | null
  setCopyProgress: (p: CopyProgress | null) => void
  toggleTerminal: () => void
  toggleTerminalSplit: () => void
  setTerminalSplit: (v: boolean) => void
  toggleGitView: () => void
  setGitView: (v: boolean) => void
  setTerminalOpen: (v: boolean) => void
  /** Ouvre le terminal et l'affiche en grand (exécution d'une commande). */
  openTerminalLarge: () => void
  toggleAppearance: () => void
  setAppearanceOpen: (v: boolean) => void
  togglePalette: () => void
  setPaletteOpen: (v: boolean) => void
  toggleFileFinder: () => void
  setFileFinder: (v: boolean) => void
  setDiskUsage: (path: string | null) => void
  setFolderCreator: (v: boolean) => void
  setWhatsNew: (since: string | null) => void
  togglePreview: () => void
  setPreviewOpen: (v: boolean) => void
  setClipboard: (c: FileClipboard | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  terminalOpen: false,
  appearanceOpen: false,
  previewOpen: false,
  terminalSize: TERMINAL_DEFAULT,
  terminalGrow: 0,
  paletteOpen: false,
  fileFinderOpen: false,
  diskUsagePath: null,
  folderCreatorOpen: false,
  whatsNewSince: null,
  terminalSplit: false,
  gitViewOpen: false,
  clipboard: null,
  toast: null,
  toastSeq: 0,
  showToast: (message) => set((s) => ({ toast: message, toastSeq: s.toastSeq + 1 })),
  clearToast: () => set({ toast: null }),
  copyProgress: null,
  setCopyProgress: (p) => set({ copyProgress: p }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  toggleTerminalSplit: () => set((s) => ({ terminalSplit: !s.terminalSplit })),
  setTerminalSplit: (v) => set({ terminalSplit: v }),
  toggleGitView: () => set((s) => ({ gitViewOpen: !s.gitViewOpen })),
  setGitView: (v) => set({ gitViewOpen: v }),
  setTerminalOpen: (v) => set({ terminalOpen: v }),
  openTerminalLarge: () =>
    set((s) => ({
      terminalOpen: true,
      terminalSize: TERMINAL_LARGE,
      terminalGrow: s.terminalGrow + 1
    })),
  toggleAppearance: () => set((s) => ({ appearanceOpen: !s.appearanceOpen })),
  setAppearanceOpen: (v) => set({ appearanceOpen: v }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  toggleFileFinder: () => set((s) => ({ fileFinderOpen: !s.fileFinderOpen })),
  setFileFinder: (v) => set({ fileFinderOpen: v }),
  setDiskUsage: (path) => set({ diskUsagePath: path }),
  setFolderCreator: (v) => set({ folderCreatorOpen: v }),
  setWhatsNew: (since) => set({ whatsNewSince: since }),
  togglePreview: () => set((s) => ({ previewOpen: !s.previewOpen })),
  setPreviewOpen: (v) => set({ previewOpen: v }),
  setClipboard: (c) => set({ clipboard: c })
}))
