import { create } from 'zustand'
import type { WorkspaceData } from '@shared/types'
import { useNavStore } from './useNavStore'
import { useUiStore } from './useUiStore'

/**
 * Espaces de travail nommés : capturent la disposition des volets (dossiers +
 * Accès rapide + volet actif) et l'état des panneaux (terminal/aperçu/apparence).
 * Persistés dans electron-store ; chargés/restaurés à la demande.
 */
interface WorkspaceStore {
  workspaces: Record<string, WorkspaceData>
  init: () => Promise<void>
  save: (name: string) => void
  load: (name: string) => Promise<void>
  remove: (name: string) => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: {},

  init: async () => {
    try {
      const workspaces = await window.api.config.get('workspaces')
      set({ workspaces: workspaces ?? {} })
    } catch {
      set({ workspaces: {} })
    }
  },

  save: (name) => {
    const key = name.trim()
    if (!key) return
    const nav = useNavStore.getState()
    const ui = useUiStore.getState()
    const data: WorkspaceData = {
      panes: nav.panes.map((p) => ({ path: p.path, quickAccess: p.quickAccess })),
      activeIndex: Math.max(0, nav.panes.findIndex((p) => p.id === nav.activeId)),
      terminalOpen: ui.terminalOpen,
      previewOpen: ui.previewOpen,
      appearanceOpen: ui.appearanceOpen
    }
    const workspaces = { ...get().workspaces, [key]: data }
    set({ workspaces })
    void window.api.config.set('workspaces', workspaces)
  },

  load: async (name) => {
    const data = get().workspaces[name]
    if (!data) return
    const ui = useUiStore.getState()
    ui.setTerminalOpen(data.terminalOpen)
    ui.setPreviewOpen(data.previewOpen)
    ui.setAppearanceOpen(data.appearanceOpen)
    await useNavStore.getState().applyWorkspace(data.panes, data.activeIndex)
  },

  remove: (name) => {
    const workspaces = { ...get().workspaces }
    delete workspaces[name]
    set({ workspaces })
    void window.api.config.set('workspaces', workspaces)
  }
}))
