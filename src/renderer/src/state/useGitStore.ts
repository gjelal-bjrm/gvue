import { create } from 'zustand'
import type { GitFileChange, GitBranches, GitActionResult } from '@shared/types'
import { pathKey } from '../lib/format'

/**
 * État Git de la vue courante. Rafraîchi à chaque navigation : on interroge le
 * statut du dépôt contenant le dossier affiché, puis on indexe les changements
 * par chemin (clé canonique) pour un affichage O(1) par ligne, et on marque les
 * dossiers ancêtres comme « contiennent des changements ».
 */

export interface GitRepo {
  root: string
  branch: string
  ahead: number
  behind: number
}

interface GitState {
  repo: GitRepo | null
  /** Changements indexés par clé de chemin (pathKey). */
  statusByPath: Record<string, GitFileChange>
  /** Liste des changements (hors ignorés), pour la vue Git détaillée. */
  files: GitFileChange[]
  /** Clés des dossiers contenant au moins un changement (hors ignorés). */
  dirtyDirs: Set<string>
  /** Clés des chemins ignorés par .gitignore (fichiers et dossiers regroupés). */
  ignored: Set<string>
  /** Branches locales (chargées à la demande pour la vue Git). */
  branches: GitBranches
  refresh: (dir: string) => Promise<void>
  loadBranches: (dir: string) => Promise<void>
  /**
   * (Dés)indexe des fichiers avec retour visuel immédiat : l'état `staged` est
   * basculé localement AVANT l'aller-retour git (une seule commande pour tout
   * le lot), puis le statut est resynchronisé en arrière-plan.
   */
  setStaged: (root: string, paths: string[], staged: boolean) => Promise<GitActionResult>
  /** Indexe/désindexe tout, avec la même bascule optimiste. */
  setAllStaged: (root: string, staged: boolean) => Promise<GitActionResult>
  clear: () => void
}

/** Parent d'un chemin en slashes (les chemins Git utilisent « / »). */
function parentOf(p: string): string {
  const i = p.lastIndexOf('/')
  return i > 0 ? p.slice(0, i) : ''
}

const EMPTY = {
  repo: null,
  statusByPath: {},
  files: [] as GitFileChange[],
  dirtyDirs: new Set<string>(),
  ignored: new Set<string>()
}
const NO_BRANCHES: GitBranches = { current: '', all: [] }

/** Bascule `staged` sur les fichiers dont la clé est dans `keys`. */
function flipStaged(
  s: Pick<GitState, 'files' | 'statusByPath'>,
  keys: Set<string>,
  staged: boolean
): Pick<GitState, 'files' | 'statusByPath'> {
  const files = s.files.map((f) => (keys.has(pathKey(f.path)) ? { ...f, staged } : f))
  const statusByPath: Record<string, GitFileChange> = {}
  for (const [k, f] of Object.entries(s.statusByPath)) {
    statusByPath[k] = keys.has(k) ? { ...f, staged } : f
  }
  return { files, statusByPath }
}

export const useGitStore = create<GitState>((set, get) => ({
  repo: null,
  statusByPath: {},
  files: [],
  dirtyDirs: new Set(),
  ignored: new Set(),
  branches: NO_BRANCHES,

  refresh: async (dir) => {
    let s
    try {
      s = await window.api.git.status(dir)
    } catch {
      set(EMPTY)
      return
    }
    if (!s.isRepo) {
      set(EMPTY)
      return
    }

    const statusByPath: Record<string, GitFileChange> = {}
    const files: GitFileChange[] = []
    const dirtyDirs = new Set<string>()
    const ignored = new Set<string>()
    const rootKey = pathKey(s.root)

    for (const f of s.files) {
      const key = pathKey(f.path)
      statusByPath[key] = f
      if (f.category === 'ignored') {
        ignored.add(key)
        continue // les ignorés ne « salissent » pas leurs dossiers parents
      }
      files.push(f)
      // Marque chaque dossier ancêtre jusqu'à la racine du dépôt.
      let cur = f.path
      for (;;) {
        const parent = parentOf(cur)
        if (!parent) break
        cur = parent
        const k = pathKey(cur)
        dirtyDirs.add(k)
        if (k === rootKey) break
      }
    }

    set({
      repo: { root: s.root, branch: s.branch, ahead: s.ahead, behind: s.behind },
      statusByPath,
      files,
      dirtyDirs,
      ignored
    })
  },

  loadBranches: async (dir) => {
    try {
      set({ branches: await window.api.git.branches(dir) })
    } catch {
      set({ branches: NO_BRANCHES })
    }
  },

  setStaged: async (root, paths, staged) => {
    const keys = new Set(paths.map(pathKey))
    set((s) => flipStaged(s, keys, staged))
    let r: GitActionResult
    try {
      r = staged
        ? await window.api.git.stage(root, paths)
        : await window.api.git.unstage(root, paths)
    } catch (e) {
      r = { ok: false, output: e instanceof Error ? e.message : String(e) }
    }
    // Resynchronisation silencieuse (corrige aussi l'optimisme en cas d'échec).
    await get().refresh(root)
    return r
  },

  setAllStaged: async (root, staged) => {
    set((s) => flipStaged(s, new Set(s.files.map((f) => pathKey(f.path))), staged))
    let r: GitActionResult
    try {
      r = staged ? await window.api.git.stageAll(root) : await window.api.git.unstageAll(root)
    } catch (e) {
      r = { ok: false, output: e instanceof Error ? e.message : String(e) }
    }
    await get().refresh(root)
    return r
  },

  clear: () => set({ ...EMPTY, branches: NO_BRANCHES })
}))
