import { create } from 'zustand'
import type { CustomCommand } from '@shared/types'

/**
 * Commandes personnalisées du menu contextuel (persistées dans la config).
 * Exécutées dans le terminal intégré via useTerminalStore.openTaskTab.
 */
interface CustomCommandsState {
  commands: CustomCommand[]
  init: () => Promise<void>
  save: (commands: CustomCommand[]) => void
}

export const useCustomCommandsStore = create<CustomCommandsState>((set) => ({
  commands: [],

  init: async () => {
    try {
      const commands = await window.api.config.get('customCommands')
      set({ commands: Array.isArray(commands) ? commands : [] })
    } catch {
      set({ commands: [] })
    }
  },

  save: (commands) => {
    set({ commands })
    void window.api.config.set('customCommands', commands)
  }
}))
