import { create } from 'zustand'
import type { SearchMatch, SearchDone, SearchOptions } from '@shared/types'

/**
 * État de la recherche ripgrep.
 *
 * L'`searchId` est généré ici (compteur) et passé au main : il est donc connu
 * avant même que l'invoke ne réponde, ce qui élimine toute course avec les
 * événements streamés. Les abonnements onResult/onDone sont attachés une seule
 * fois via `init()` et filtrent sur l'`searchId` courant.
 */

const MAX_RESULTS = 5000

interface SearchState {
  /** Le panneau de résultats remplace-t-il la liste de fichiers ? */
  active: boolean
  /** Saisie courante du champ de recherche. */
  query: string
  /** Options de construction de la requête. */
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  includeIgnored: boolean

  /** Id de la recherche en cours (ou la dernière lancée). */
  searchId: string | null
  /** Dossier sur lequel a porté la dernière recherche. */
  dir: string
  matches: SearchMatch[]
  searching: boolean
  done: SearchDone | null

  init: () => () => void
  setQuery: (q: string) => void
  toggleCase: () => void
  toggleWord: () => void
  toggleRegex: () => void
  toggleIncludeIgnored: () => void
  run: (dir: string) => Promise<void>
  cancel: () => void
  close: () => void
}

let counter = 0

export const useSearchStore = create<SearchState>((set, get) => ({
  active: false,
  query: '',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  includeIgnored: false,

  searchId: null,
  dir: '',
  matches: [],
  searching: false,
  done: null,

  init: () => {
    const offResult = window.api.search.onResult((ev) => {
      if (ev.searchId !== get().searchId) return
      set((s) => ({ matches: [...s.matches, ...ev.matches] }))
    })
    const offDone = window.api.search.onDone((ev) => {
      if (ev.searchId !== get().searchId) return
      set({ searching: false, done: ev.done })
    })
    return () => {
      offResult()
      offDone()
    }
  },

  setQuery: (q) => set({ query: q }),
  toggleCase: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  toggleWord: () => set((s) => ({ wholeWord: !s.wholeWord })),
  toggleRegex: () => set((s) => ({ regex: !s.regex })),
  toggleIncludeIgnored: () => set((s) => ({ includeIgnored: !s.includeIgnored })),

  run: async (dir) => {
    const { query, caseSensitive, wholeWord, regex, includeIgnored } = get()
    if (!query.trim() || !dir) return

    // Annule une éventuelle recherche encore en cours avant d'en lancer une autre.
    const prev = get().searchId
    if (prev && get().searching) window.api.search.cancel(prev)

    const searchId = `search-${++counter}`
    const opts: SearchOptions = {
      query,
      dir,
      caseSensitive,
      wholeWord,
      regex,
      includeIgnored,
      maxResults: MAX_RESULTS
    }
    set({ active: true, searchId, dir, matches: [], searching: true, done: null })
    await window.api.search.start(searchId, opts)
  },

  cancel: () => {
    const { searchId, searching } = get()
    if (searchId && searching) window.api.search.cancel(searchId)
    set({ searching: false })
  },

  close: () => {
    const { searchId, searching } = get()
    if (searchId && searching) window.api.search.cancel(searchId)
    set({ active: false, searching: false, matches: [], done: null, searchId: null })
  }
}))
