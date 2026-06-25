import { create } from 'zustand'
import type { ShellInfo } from '@shared/types'
import { useNavStore, activePane } from './useNavStore'
import { disposeTerminal } from '../lib/terminalRegistry'

export interface TermTab {
  /** Identifiant d'onglet = ptyId (unique). */
  id: string
  ptyId: string
  shell: ShellInfo
  title: string
  exited: boolean
  /** Désabonnement de l'événement de sortie du pty. */
  disposeExit: () => void
}

interface TerminalState {
  shells: ShellInfo[]
  tabs: TermTab[]
  activeId: string | null
  error: string | null

  loadShells: () => Promise<void>
  openTab: (shellId?: string) => Promise<void>
  ensureTab: () => Promise<void>
  closeTab: (id: string) => void
  setActive: (id: string) => void
  /** Écrit dans le terminal actif (ex. depuis la barre de commande). */
  writeActive: (data: string) => void
}

// Garde anti-doublon : évite d'ouvrir deux terminaux quand React StrictMode
// monte le panneau deux fois en développement.
let ensuring = false

export const useTerminalStore = create<TerminalState>((set, get) => ({
  shells: [],
  tabs: [],
  activeId: null,
  error: null,

  loadShells: async () => {
    try {
      const shells = await window.api.terminal.shells()
      set({ shells })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  openTab: async (shellId) => {
    const { shells } = get()
    if (shells.length === 0) await get().loadShells()
    const list = get().shells
    const shell = list.find((s) => s.id === shellId) ?? list[0]
    if (!shell) {
      set({ error: 'Aucun shell disponible.' })
      return
    }
    const cwd = activePane(useNavStore.getState()).path || shell.path
    try {
      const ptyId = await window.api.terminal.create({
        shellPath: shell.path,
        args: shell.args,
        cwd,
        cols: 80,
        rows: 24
      })
      // Marque l'onglet comme terminé quand le process se ferme, puis se désabonne.
      const disposeExit = window.api.terminal.onExit(ptyId, () => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === ptyId ? { ...t, exited: true, title: `${t.shell.label} (terminé)` } : t
          )
        }))
        disposeExit()
      })
      const tab: TermTab = { id: ptyId, ptyId, shell, title: shell.label, exited: false, disposeExit }
      set((s) => ({ tabs: [...s.tabs, tab], activeId: ptyId, error: null }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  ensureTab: async () => {
    if (get().tabs.length > 0 || ensuring) return
    ensuring = true
    try {
      await get().openTab()
    } finally {
      ensuring = false
    }
  },

  closeTab: (id) => {
    get().tabs.find((t) => t.id === id)?.disposeExit()
    disposeTerminal(id)
    window.api.terminal.kill(id)
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      const activeId =
        s.activeId === id ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null) : s.activeId
      return { tabs, activeId }
    })
  },

  setActive: (id) => set({ activeId: id }),

  writeActive: (data) => {
    const { activeId } = get()
    if (activeId) window.api.terminal.write(activeId, data)
  }
}))
