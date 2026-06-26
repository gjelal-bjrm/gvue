import { create } from 'zustand'

/** Clés des sections réordonnables/repliables de la sidebar. */
export const SIDEBAR_SECTIONS = ['thispc', 'drives', 'favorites', 'projects'] as const
export type SidebarSection = (typeof SIDEBAR_SECTIONS)[number]

/**
 * Ordre et état replié des sections de la sidebar, persistés dans la config.
 * Permet de replier « Ce PC », « Lecteurs »… et d'en changer l'ordre.
 */
interface SidebarState {
  order: string[]
  collapsed: Record<string, boolean>
  /** Développer l'arbre des dossiers jusqu'au dossier ouvert. */
  treeExpand: boolean
  init: () => Promise<void>
  toggleCollapsed: (key: string) => void
  toggleTreeExpand: () => void
  /** Déplace la section `from` à la position de la section `to`. */
  reorder: (from: string, to: string) => void
  /** Applique et persiste un état complet (ordre, repli, suivi) — espaces de travail. */
  applyState: (order?: string[], collapsed?: Record<string, boolean>, treeExpand?: boolean) => void
}

// Complète/filtre un ordre stocké pour qu'il contienne toutes les clés connues.
function normalizeOrder(stored: string[] | undefined): string[] {
  const known = [...SIDEBAR_SECTIONS] as string[]
  const kept = (stored ?? []).filter((k) => known.includes(k))
  for (const k of known) if (!kept.includes(k)) kept.push(k)
  return kept
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  order: [...SIDEBAR_SECTIONS],
  collapsed: {},
  treeExpand: true,

  init: async () => {
    try {
      const [order, collapsed, treeExpand] = await Promise.all([
        window.api.config.get('sidebarOrder'),
        window.api.config.get('sidebarCollapsed'),
        window.api.config.get('treeExpandToCurrent')
      ])
      set({ order: normalizeOrder(order), collapsed: collapsed ?? {}, treeExpand: treeExpand ?? true })
    } catch {
      set({ order: [...SIDEBAR_SECTIONS], collapsed: {}, treeExpand: true })
    }
  },

  toggleCollapsed: (key) => {
    const collapsed = { ...get().collapsed, [key]: !get().collapsed[key] }
    set({ collapsed })
    void window.api.config.set('sidebarCollapsed', collapsed)
  },

  toggleTreeExpand: () => {
    const treeExpand = !get().treeExpand
    set({ treeExpand })
    void window.api.config.set('treeExpandToCurrent', treeExpand)
  },

  reorder: (from, to) => {
    if (from === to) return
    const order = [...get().order]
    const fi = order.indexOf(from)
    const ti = order.indexOf(to)
    if (fi < 0 || ti < 0) return
    order.splice(fi, 1)
    order.splice(ti, 0, from)
    set({ order })
    void window.api.config.set('sidebarOrder', order)
  },

  applyState: (order, collapsed, treeExpand) => {
    const next = {
      order: order ? normalizeOrder(order) : get().order,
      collapsed: collapsed ?? get().collapsed,
      treeExpand: treeExpand ?? get().treeExpand
    }
    set(next)
    void window.api.config.set('sidebarOrder', next.order)
    void window.api.config.set('sidebarCollapsed', next.collapsed)
    void window.api.config.set('treeExpandToCurrent', next.treeExpand)
  }
}))
