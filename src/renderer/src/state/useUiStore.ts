import { create } from 'zustand'

/** État d'affichage des panneaux (terminal, apparence). */
interface UiState {
  terminalOpen: boolean
  appearanceOpen: boolean
  toggleTerminal: () => void
  setTerminalOpen: (v: boolean) => void
  toggleAppearance: () => void
}

export const useUiStore = create<UiState>((set) => ({
  terminalOpen: false,
  appearanceOpen: true,
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminalOpen: (v) => set({ terminalOpen: v }),
  toggleAppearance: () => set((s) => ({ appearanceOpen: !s.appearanceOpen }))
}))
