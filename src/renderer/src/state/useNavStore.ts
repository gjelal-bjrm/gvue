import { create } from 'zustand'
import type { DirEntry, NavLocations } from '@shared/types'

export type SortKey = 'name' | 'size' | 'modifiedMs'
export type SortDir = 'asc' | 'desc'

/** État de navigation d'un volet (l'app en affiche 1 à 3 côte à côte). */
export interface Pane {
  id: string
  path: string
  parent: string | null
  entries: DirEntry[]
  loading: boolean
  error: string | null
  back: string[]
  forward: string[]
  sortKey: SortKey
  sortDir: SortDir
  /** Ce volet affiche-t-il la page Accès rapide plutôt qu'un dossier ? */
  quickAccess: boolean
  /** Entrée sélectionnée (pour l'aperçu). */
  selectedPath: string | null
}

interface NavState {
  panes: Pane[]
  activeId: string
  locations: NavLocations | null
  showHidden: boolean
  hideGitIgnored: boolean

  init: () => Promise<void>

  // Gestion des volets
  setActive: (id: string) => void
  addPane: () => Promise<void>
  closePane: (id: string) => void

  // Actions sur le volet actif
  navigate: (path: string, record?: boolean) => Promise<void>
  silentRefresh: (paneId?: string) => Promise<void>
  /** Rafraîchit tous les volets affichant un dossier (après copie/déplacement). */
  refreshAll: () => void
  goBack: () => void
  goForward: () => void
  goParent: () => void
  goHome: () => void
  refresh: () => void
  setSort: (key: SortKey) => void
  showQuickAccess: () => void
  setSelectedPath: (p: string | null) => void

  // Préférences d'affichage (partagées par tous les volets)
  toggleHidden: () => void
  toggleGitIgnored: () => void
}

const MAX_PANES = 3
let paneCounter = 1

function makePane(id: string, sortKey: SortKey = 'name', sortDir: SortDir = 'asc'): Pane {
  return {
    id,
    path: '',
    parent: null,
    entries: [],
    loading: false,
    error: null,
    back: [],
    forward: [],
    sortKey,
    sortDir,
    quickAccess: false,
    selectedPath: null
  }
}

/** Le volet actif (jamais undefined : retombe sur le premier). */
export function activePane(s: NavState): Pane {
  return s.panes.find((p) => p.id === s.activeId) ?? s.panes[0]
}

function sortEntries(entries: DirEntry[], key: SortKey, dir: SortDir): DirEntry[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    let cmp = 0
    if (key === 'name') cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
    else if (key === 'size') cmp = a.size - b.size
    else cmp = a.modifiedMs - b.modifiedMs
    return cmp * factor
  })
}

export const useNavStore = create<NavState>((set, get) => {
  /** Applique un patch au volet d'id donné (immuable). */
  const patch = (id: string, p: Partial<Pane>): void => {
    set((s) => ({ panes: s.panes.map((pane) => (pane.id === id ? { ...pane, ...p } : pane)) }))
  }
  const paneById = (id: string): Pane | undefined => get().panes.find((p) => p.id === id)

  /** Navigue un volet précis (utilisé par navigate, addPane, init). */
  const navigatePane = async (id: string, target: string, record: boolean): Promise<void> => {
    const pane = paneById(id)
    if (!pane) return
    const current = pane.path
    patch(id, { loading: true, error: null })
    try {
      const result = await window.api.fs.list(target)
      const p = paneById(id)
      if (!p) return
      patch(id, {
        path: result.path,
        parent: result.parent,
        entries: sortEntries(result.entries, p.sortKey, p.sortDir),
        loading: false,
        quickAccess: false,
        selectedPath: null,
        back: record && current ? [...p.back, current] : p.back,
        forward: record ? [] : p.forward
      })
    } catch (e) {
      patch(id, { loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return {
    panes: [makePane('pane-1')],
    activeId: 'pane-1',
    locations: null,
    showHidden: false,
    hideGitIgnored: true,

    init: async () => {
      const locations = await window.api.fs.locations()
      const hideGitIgnored = await window.api.config.get('hideGitIgnored').catch(() => true)
      set({ locations, hideGitIgnored })
      // Charge le home en arrière-plan puis démarre sur la page Accès rapide.
      await navigatePane(get().activeId, locations.home, false)
      patch(get().activeId, { quickAccess: true })
    },

    setActive: (id) => set({ activeId: id }),

    addPane: async () => {
      if (get().panes.length >= MAX_PANES) return
      const src = activePane(get())
      const id = `pane-${++paneCounter}`
      set((s) => ({ panes: [...s.panes, makePane(id, src.sortKey, src.sortDir)], activeId: id }))
      await navigatePane(id, src.path || get().locations?.home || '', false)
    },

    closePane: (id) =>
      set((s) => {
        if (s.panes.length <= 1) return s
        const panes = s.panes.filter((p) => p.id !== id)
        const activeId = s.activeId === id ? panes[panes.length - 1].id : s.activeId
        return { panes, activeId }
      }),

    navigate: (target, record = true) => navigatePane(get().activeId, target, record),

    silentRefresh: async (paneId) => {
      const id = paneId ?? get().activeId
      const pane = paneById(id)
      if (!pane || !pane.path) return
      try {
        const result = await window.api.fs.list(pane.path, false)
        const p = paneById(id)
        if (!p) return
        patch(id, {
          parent: result.parent,
          entries: sortEntries(result.entries, p.sortKey, p.sortDir)
        })
      } catch {
        /* dossier devenu inaccessible : on garde l'état */
      }
    },

    refreshAll: () => {
      for (const p of get().panes) if (!p.quickAccess && p.path) void get().silentRefresh(p.id)
    },

    goBack: () => {
      const pane = activePane(get())
      if (pane.back.length === 0) return
      const prev = pane.back[pane.back.length - 1]
      patch(pane.id, { back: pane.back.slice(0, -1), forward: [pane.path, ...pane.forward] })
      void navigatePane(pane.id, prev, false)
    },

    goForward: () => {
      const pane = activePane(get())
      if (pane.forward.length === 0) return
      const next = pane.forward[0]
      patch(pane.id, { forward: pane.forward.slice(1), back: [...pane.back, pane.path] })
      void navigatePane(pane.id, next, false)
    },

    goParent: () => {
      const pane = activePane(get())
      if (pane.parent) void navigatePane(pane.id, pane.parent, true)
    },

    goHome: () => {
      const { locations } = get()
      if (locations) void navigatePane(get().activeId, locations.home, true)
    },

    refresh: () => {
      const pane = activePane(get())
      if (pane.path) void navigatePane(pane.id, pane.path, false)
    },

    setSort: (key) => {
      const pane = activePane(get())
      const sortDir: SortDir = pane.sortKey === key ? (pane.sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
      patch(pane.id, { sortKey: key, sortDir, entries: sortEntries(pane.entries, key, sortDir) })
    },

    showQuickAccess: () => patch(get().activeId, { quickAccess: true }),

    setSelectedPath: (p) => patch(get().activeId, { selectedPath: p }),

    toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),

    toggleGitIgnored: () => {
      const next = !get().hideGitIgnored
      set({ hideGitIgnored: next })
      void window.api.config.set('hideGitIgnored', next)
    }
  }
})
