import { create } from 'zustand'
import type { WorkspaceData } from '@shared/types'
import { useNavStore } from './useNavStore'
import { useUiStore } from './useUiStore'
import { useAppearanceStore } from './useAppearanceStore'
import { useSidebarStore } from './useSidebarStore'
import { useTerminalStore } from './useTerminalStore'

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
    const ap = useAppearanceStore.getState().appearance
    const sb = useSidebarStore.getState()
    const term = useTerminalStore.getState()
    const data: WorkspaceData = {
      panes: nav.panes.map((p) => ({ path: p.path, quickAccess: p.quickAccess })),
      activeIndex: Math.max(0, nav.panes.findIndex((p) => p.id === nav.activeId)),
      terminalOpen: ui.terminalOpen,
      previewOpen: ui.previewOpen,
      appearanceOpen: ui.appearanceOpen,
      appearance: {
        accent: ap.accent,
        theme: ap.theme,
        density: ap.density,
        corners: ap.corners,
        fontFamily: ap.fontFamily,
        fontSize: ap.fontSize,
        windowOpacity: ap.windowOpacity,
        titleCursor: ap.titleCursor
      },
      treeExpand: sb.treeExpand,
      sidebarOrder: sb.order,
      sidebarCollapsed: sb.collapsed,
      terminalSplit: ui.terminalSplit,
      terminals: term.tabs.filter((t) => !t.exited).map((t) => t.shell.id)
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
    if (data.terminalSplit !== undefined) ui.setTerminalSplit(data.terminalSplit)

    // Thème / couleur d'accent propres à l'espace.
    if (data.appearance) useAppearanceStore.getState().update(data.appearance)

    // Config sidebar (ordre, repli, suivi du dossier).
    if (data.sidebarOrder || data.sidebarCollapsed || data.treeExpand !== undefined) {
      useSidebarStore.getState().applyState(data.sidebarOrder, data.sidebarCollapsed, data.treeExpand)
    }

    await useNavStore.getState().applyWorkspace(data.panes, data.activeIndex)

    // Terminaux : rouvre l'ensemble mémorisé (ou ferme tout si l'espace n'en a pas).
    if (data.terminals) {
      await useTerminalStore.getState().restore(data.terminalOpen ? data.terminals : [])
    }
  },

  remove: (name) => {
    const workspaces = { ...get().workspaces }
    delete workspaces[name]
    set({ workspaces })
    void window.api.config.set('workspaces', workspaces)
  }
}))
