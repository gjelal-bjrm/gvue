import { create } from 'zustand'

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
  /** Terminaux affichés côte à côte (sinon en onglets, un seul visible). */
  terminalSplit: boolean
  /** Vue Git détaillée (façon GitHub Desktop) affichée à la place des volets ? */
  gitViewOpen: boolean
  /** Fichiers coupés/copiés en attente de collage. */
  clipboard: FileClipboard | null
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
  terminalSplit: false,
  gitViewOpen: false,
  clipboard: null,
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
  togglePreview: () => set((s) => ({ previewOpen: !s.previewOpen })),
  setPreviewOpen: (v) => set({ previewOpen: v }),
  setClipboard: (c) => set({ clipboard: c })
}))
