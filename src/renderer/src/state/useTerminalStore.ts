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
  /** Dossier de départ (pour l'autocomplétion de chemins). */
  cwd: string
  exited: boolean
  /** Désabonnement de l'événement de sortie du pty. */
  disposeExit: () => void
}

interface TerminalState {
  shells: ShellInfo[]
  tabs: TermTab[]
  activeId: string | null
  error: string | null
  /** Shell par défaut (id) ; vide = premier détecté. */
  defaultShellId: string

  loadShells: () => Promise<void>
  /** Définit le shell par défaut (persisté). */
  setDefaultShell: (id: string) => void
  openTab: (shellId?: string, cwd?: string) => Promise<void>
  /** Ouvre un onglet pour une tâche (cwd/titre/commande) et renvoie son ptyId. */
  openTaskTab: (opts: { cwd: string; title: string; command: string }) => Promise<string | null>
  ensureTab: () => Promise<void>
  /** Ferme tous les onglets puis rouvre un terminal par shell (espaces de travail). */
  restore: (shellIds: string[]) => Promise<void>
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
  defaultShellId: '',

  loadShells: async () => {
    try {
      const [shells, defaultShell] = await Promise.all([
        window.api.terminal.shells(),
        window.api.config.get('defaultShell')
      ])
      // Ne garde le défaut que s'il correspond encore à un shell détecté.
      const valid = shells.some((s) => s.id === defaultShell) ? defaultShell : ''
      set({ shells, defaultShellId: valid })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  setDefaultShell: (id) => {
    set({ defaultShellId: id })
    void window.api.config.set('defaultShell', id)
  },

  openTab: async (shellId, explicitCwd) => {
    const { shells } = get()
    if (shells.length === 0) await get().loadShells()
    const list = get().shells
    const def = get().defaultShellId
    // Priorité : shell explicitement demandé → shell par défaut → premier détecté.
    const shell =
      list.find((s) => s.id === shellId) ?? list.find((s) => s.id === def) ?? list[0]
    if (!shell) {
      set({ error: 'Aucun shell disponible.' })
      return
    }
    const cwd = explicitCwd || activePane(useNavStore.getState()).path || shell.path
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
      const tab: TermTab = { id: ptyId, ptyId, shell, title: shell.label, cwd, exited: false, disposeExit }
      set((s) => ({ tabs: [...s.tabs, tab], activeId: ptyId, error: null }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  openTaskTab: async ({ cwd, title, command }) => {
    if (get().shells.length === 0) await get().loadShells()
    const list = get().shells
    // Une commande « cmd /c … » (ex. lancer un .bat/.exe) doit tourner dans cmd :
    // Git Bash casse « cmd /c » (MSYS convertit le /c → cmd s'ouvre en interactif).
    // Les autres commandes (npm, node, python, bash…) restent dans le shell par défaut.
    const needsCmd = /^\s*cmd\s+\/\/?c\b/i.test(command)
    const shell =
      (needsCmd ? list.find((s) => s.id === 'cmd') : undefined) ??
      list.find((s) => s.id === get().defaultShellId) ??
      list[0]
    if (!shell) {
      set({ error: 'Aucun shell disponible.' })
      return null
    }
    try {
      const ptyId = await window.api.terminal.create({
        shellPath: shell.path,
        args: shell.args,
        cwd: cwd || shell.path,
        cols: 80,
        rows: 24
      })
      const disposeExit = window.api.terminal.onExit(ptyId, () => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === ptyId ? { ...t, exited: true, title: `${title} (terminé)` } : t))
        }))
        disposeExit()
      })
      const tab: TermTab = {
        id: ptyId,
        ptyId,
        shell,
        title,
        cwd: cwd || shell.path,
        exited: false,
        disposeExit
      }
      set((s) => ({ tabs: [...s.tabs, tab], activeId: ptyId, error: null }))
      window.api.terminal.write(ptyId, command + '\r')
      return ptyId
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      return null
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

  restore: async (shellIds) => {
    if (get().shells.length === 0) await get().loadShells()
    for (const t of [...get().tabs]) get().closeTab(t.id)
    for (const id of shellIds) await get().openTab(id)
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
