import { create } from 'zustand'
import type { DirEntry, NavLocations, WorkspacePane } from '@shared/types'
import { useUiStore } from './useUiStore'

export type SortKey = 'name' | 'size' | 'modifiedMs'
export type SortDir = 'asc' | 'desc'

/**
 * État de navigation d'un onglet. Les onglets sont regroupés en colonnes
 * (« groupes ») affichées côte à côte : `group` identifie la colonne ; un seul
 * onglet par colonne est visible (voir `groupActive`).
 */
export interface Pane {
  id: string
  /** Colonne (groupe d'onglets) à laquelle appartient cet onglet. */
  group: number
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
  /** Ce volet affiche-t-il la page Lanceur ? */
  launcher: boolean
  /** Chemins sélectionnés (multi-sélection). */
  selected: string[]
  /** Chemin en cours de renommage (édition en place), ou null. */
  renaming: string | null
}

interface NavState {
  panes: Pane[]
  activeId: string
  /** Onglet visible de chaque colonne (groupe → id d'onglet). */
  groupActive: Record<number, string>
  locations: NavLocations | null
  showHidden: boolean
  hideGitIgnored: boolean

  init: () => Promise<void>

  // Gestion des volets (colonnes) et des onglets
  setActive: (id: string) => void
  addPane: () => Promise<void>
  /** Ouvre un nouvel onglet dans la colonne donnée (défaut : celle de l'onglet actif). */
  addTab: (group?: number) => Promise<void>
  closePane: (id: string) => void
  /** Restaure une disposition de volets (espace de travail). */
  applyWorkspace: (panes: WorkspacePane[], activeIndex: number) => Promise<void>

  // Actions sur le volet actif
  navigate: (path: string, record?: boolean) => Promise<void>
  silentRefresh: (paneId?: string) => Promise<void>
  /** Rafraîchit tous les volets affichant un dossier (après copie/déplacement). */
  refreshAll: () => void
  showLauncher: () => void
  goBack: () => void
  goForward: () => void
  goParent: () => void
  goHome: () => void
  refresh: () => void
  setSort: (key: SortKey) => void
  showQuickAccess: () => void
  setSelected: (paths: string[]) => void
  setRenaming: (p: string | null) => void

  // Préférences d'affichage (partagées par tous les volets)
  toggleHidden: () => void
  toggleGitIgnored: () => void
}

const MAX_PANES = 3 // nombre maximal de colonnes côte à côte (les onglets, eux, sont illimités)
let paneCounter = 1

function makePane(
  id: string,
  sortKey: SortKey = 'name',
  sortDir: SortDir = 'asc',
  group = 0
): Pane {
  return {
    id,
    group,
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
    launcher: false,
    selected: [],
    renaming: null
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
    // Naviguer vers un AUTRE dossier ferme la vue Git (retour à l'exploration) ;
    // un simple rafraîchissement (même chemin) ne la ferme pas.
    if (target !== current) useUiStore.getState().setGitView(false)
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
        launcher: false,
        selected: [],
        renaming: null,
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
    groupActive: { 0: 'pane-1' },
    locations: null,
    showHidden: false,
    hideGitIgnored: true,

    init: async () => {
      const locations = await window.api.fs.locations()
      const hideGitIgnored = await window.api.config.get('hideGitIgnored').catch(() => true)
      set({ locations, hideGitIgnored })

      // Restauration de session : rouvre colonnes + onglets de la dernière
      // fois (option « Rouvrir les dossiers au démarrage », activée par défaut).
      try {
        const restore = await window.api.config.get('restoreSession')
        const session = await window.api.config.get('lastSession')
        if (restore && session && Array.isArray(session.panes) && session.panes.length > 0) {
          await get().applyWorkspace(session.panes, session.activeIndex ?? 0)
          return
        }
      } catch {
        /* config indisponible : démarrage par défaut */
      }

      // Défaut : charge le home en arrière-plan puis démarre sur l'Accès rapide.
      await navigatePane(get().activeId, locations.home, false)
      patch(get().activeId, { quickAccess: true })
    },

    // Activer un onglet le rend aussi visible dans sa colonne.
    setActive: (id) =>
      set((s) => {
        const p = s.panes.find((x) => x.id === id)
        if (!p) return s
        return { activeId: id, groupActive: { ...s.groupActive, [p.group]: id } }
      }),

    // « Diviser » : nouvelle colonne (groupe) à droite.
    addPane: async () => {
      const s = get()
      const groups = new Set(s.panes.map((p) => p.group))
      if (groups.size >= MAX_PANES) return
      const src = activePane(s)
      const group = Math.max(...s.panes.map((p) => p.group)) + 1
      const id = `pane-${++paneCounter}`
      set((st) => ({
        panes: [...st.panes, makePane(id, src.sortKey, src.sortDir, group)],
        activeId: id,
        groupActive: { ...st.groupActive, [group]: id }
      }))
      await navigatePane(id, src.path || get().locations?.home || '', false)
    },

    // Nouvel onglet dans une colonne (celle de l'onglet actif par défaut),
    // ouvert sur le même dossier — comme l'explorateur Windows.
    addTab: async (group) => {
      const src = activePane(get())
      const g = group ?? src.group
      // Duplique l'onglet visible de la colonne cible (pas forcément l'actif global).
      const model = get().panes.find((p) => p.id === get().groupActive[g]) ?? src
      const id = `pane-${++paneCounter}`
      set((st) => ({
        panes: [...st.panes, makePane(id, model.sortKey, model.sortDir, g)],
        activeId: id,
        groupActive: { ...st.groupActive, [g]: id }
      }))
      await navigatePane(id, model.path || get().locations?.home || '', false)
      if (model.quickAccess) patch(id, { quickAccess: true })
    },

    // Ferme un onglet ; la colonne disparaît avec son dernier onglet.
    closePane: (id) =>
      set((s) => {
        if (s.panes.length <= 1) return s
        const closed = s.panes.find((p) => p.id === id)
        if (!closed) return s
        const panes = s.panes.filter((p) => p.id !== id)
        const sameGroup = panes.filter((p) => p.group === closed.group)
        const groupActive = { ...s.groupActive }
        if (sameGroup.length > 0) {
          if (groupActive[closed.group] === id) {
            groupActive[closed.group] = sameGroup[sameGroup.length - 1].id
          }
        } else {
          delete groupActive[closed.group]
        }
        let activeId = s.activeId
        if (activeId === id) {
          activeId = sameGroup.length ? sameGroup[sameGroup.length - 1].id : panes[panes.length - 1].id
        }
        // Le nouvel actif doit être visible dans sa colonne.
        const act = panes.find((p) => p.id === activeId)
        if (act) {
          const vis = groupActive[act.group]
          if (!vis || !panes.some((p) => p.id === vis && p.group === act.group)) {
            groupActive[act.group] = activeId
          }
        }
        return { panes, activeId, groupActive }
      }),

    applyWorkspace: async (confs, activeIndex) => {
      if (confs.length === 0) return
      const src = activePane(get())
      // Anciens espaces (sans `group`) : une colonne par volet — comportement historique.
      const newPanes = confs.map((c, i) =>
        makePane(`pane-${++paneCounter}`, src.sortKey, src.sortDir, c.group ?? i)
      )
      const active = newPanes[Math.min(Math.max(activeIndex, 0), newPanes.length - 1)]
      const groupActive: Record<number, string> = {}
      for (const p of newPanes) if (!(p.group in groupActive)) groupActive[p.group] = p.id
      groupActive[active.group] = active.id
      set({ panes: newPanes, activeId: active.id, groupActive })
      await Promise.all(
        confs.map(async (c, i) => {
          const id = newPanes[i].id
          if (c.path) await navigatePane(id, c.path, false)
          if (c.quickAccess) patch(id, { quickAccess: true })
        })
      )
    },

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

    showQuickAccess: () => {
      useUiStore.getState().setGitView(false)
      patch(get().activeId, { quickAccess: true, launcher: false })
    },

    showLauncher: () => {
      useUiStore.getState().setGitView(false)
      patch(get().activeId, { launcher: true, quickAccess: false })
    },

    setSelected: (paths) => patch(get().activeId, { selected: paths }),

    setRenaming: (p) => patch(get().activeId, { renaming: p }),

    toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),

    toggleGitIgnored: () => {
      const next = !get().hideGitIgnored
      set({ hideGitIgnored: next })
      void window.api.config.set('hideGitIgnored', next)
    }
  }
})
