import { create } from 'zustand'

/** Hauteur (en % de la zone) du panneau terminal à l'ouverture normale et en grand. */
const TERMINAL_DEFAULT = 32
const TERMINAL_LARGE = 60

/** État d'affichage des panneaux (terminal, apparence). */
interface UiState {
  terminalOpen: boolean
  appearanceOpen: boolean
  /** Hauteur cible du panneau terminal (% de la zone verticale). */
  terminalSize: number
  /** Compteur incrémenté pour redéclencher l'agrandissement quand déjà ouvert. */
  terminalGrow: number
  /** Palette de commandes (Ctrl+Maj+P) ouverte ? */
  paletteOpen: boolean
  toggleTerminal: () => void
  setTerminalOpen: (v: boolean) => void
  /** Ouvre le terminal et l'affiche en grand (exécution d'une commande). */
  openTerminalLarge: () => void
  toggleAppearance: () => void
  togglePalette: () => void
  setPaletteOpen: (v: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  terminalOpen: false,
  appearanceOpen: false,
  terminalSize: TERMINAL_DEFAULT,
  terminalGrow: 0,
  paletteOpen: false,
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminalOpen: (v) => set({ terminalOpen: v }),
  openTerminalLarge: () =>
    set((s) => ({
      terminalOpen: true,
      terminalSize: TERMINAL_LARGE,
      terminalGrow: s.terminalGrow + 1
    })),
  toggleAppearance: () => set((s) => ({ appearanceOpen: !s.appearanceOpen })),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setPaletteOpen: (v) => set({ paletteOpen: v })
}))
