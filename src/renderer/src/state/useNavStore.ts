import { create } from 'zustand'
import type { DirEntry, NavLocations } from '@shared/types'

export type SortKey = 'name' | 'size' | 'modifiedMs'
export type SortDir = 'asc' | 'desc'

interface NavState {
  path: string
  parent: string | null
  entries: DirEntry[]
  loading: boolean
  error: string | null

  back: string[]
  forward: string[]

  locations: NavLocations | null
  sortKey: SortKey
  sortDir: SortDir
  showHidden: boolean
  /** Masquer les fichiers ignorés par .gitignore (persisté). */
  hideGitIgnored: boolean
  /** La page « Accès rapide » remplace-t-elle la liste de fichiers ? */
  quickAccess: boolean

  init: () => Promise<void>
  navigate: (path: string, record?: boolean) => Promise<void>
  showQuickAccess: () => void
  toggleGitIgnored: () => void
  goBack: () => void
  goForward: () => void
  goParent: () => void
  goHome: () => void
  refresh: () => void
  setSort: (key: SortKey) => void
  toggleHidden: () => void
}

function sortEntries(entries: DirEntry[], key: SortKey, dir: SortDir): DirEntry[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    // Dossiers toujours avant les fichiers, quel que soit le tri.
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    let cmp = 0
    if (key === 'name') cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
    else if (key === 'size') cmp = a.size - b.size
    else cmp = a.modifiedMs - b.modifiedMs
    return cmp * factor
  })
}

export const useNavStore = create<NavState>((set, get) => ({
  path: '',
  parent: null,
  entries: [],
  loading: false,
  error: null,
  back: [],
  forward: [],
  locations: null,
  sortKey: 'name',
  sortDir: 'asc',
  showHidden: false,
  hideGitIgnored: true,
  quickAccess: true,

  init: async () => {
    const locations = await window.api.fs.locations()
    const hideGitIgnored = await window.api.config.get('hideGitIgnored').catch(() => true)
    set({ locations, hideGitIgnored })
    // Charge le dossier home en arrière-plan (chemin courant pour le terminal/
    // la recherche), mais on démarre sur la page Accès rapide.
    await get().navigate(locations.home, false)
    set({ quickAccess: true })
  },

  navigate: async (target, record = true) => {
    const current = get().path
    set({ loading: true, error: null })
    try {
      const result = await window.api.fs.list(target)
      set((s) => ({
        path: result.path,
        parent: result.parent,
        entries: sortEntries(result.entries, s.sortKey, s.sortDir),
        loading: false,
        // Toute navigation quitte la page Accès rapide.
        quickAccess: false,
        back: record && current ? [...s.back, current] : s.back,
        forward: record ? [] : s.forward
      }))
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  },

  showQuickAccess: () => set({ quickAccess: true }),

  goBack: () => {
    const { back, path } = get()
    if (back.length === 0) return
    const prev = back[back.length - 1]
    set((s) => ({ back: s.back.slice(0, -1), forward: [path, ...s.forward] }))
    get().navigate(prev, false)
  },

  goForward: () => {
    const { forward, path } = get()
    if (forward.length === 0) return
    const next = forward[0]
    set((s) => ({ forward: s.forward.slice(1), back: [...s.back, path] }))
    get().navigate(next, false)
  },

  goParent: () => {
    const { parent } = get()
    if (parent) get().navigate(parent)
  },

  goHome: () => {
    const { locations } = get()
    if (locations) get().navigate(locations.home)
  },

  refresh: () => {
    const { path } = get()
    if (path) get().navigate(path, false)
  },

  setSort: (key) => {
    set((s) => {
      const sortDir: SortDir =
        s.sortKey === key ? (s.sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
      return {
        sortKey: key,
        sortDir,
        entries: sortEntries(s.entries, key, sortDir)
      }
    })
  },

  toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),

  toggleGitIgnored: () => {
    const next = !get().hideGitIgnored
    set({ hideGitIgnored: next })
    void window.api.config.set('hideGitIgnored', next)
  }
}))
