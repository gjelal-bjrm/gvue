import { create } from 'zustand'
import type { RunnerTask, RunnerProfile } from '@shared/types'
import { useTerminalStore } from './useTerminalStore'
import { useUiStore } from './useUiStore'

/**
 * Lanceur de tâches : tâches (commande + dossier) et profils (groupes de tâches).
 * Persistés dans electron-store. L'exécution se fait dans le terminal intégré
 * (un onglet par tâche) ; on suit l'état « en cours » (taskId → ptyId).
 */
/** Clé d'état « en cours » pour le lancement d'un projet (vs un lancement). */
export const projKey = (root: string): string => `proj:${root}`

interface RunnerState {
  tasks: RunnerTask[]
  profiles: RunnerProfile[]
  /** Commande du bouton ▶ de chaque projet (racine → commande). */
  projectLaunch: Record<string, string>
  /** En cours : taskId (ou projKey) → ptyId de l'onglet terminal. */
  running: Record<string, string>

  init: () => Promise<void>
  addTask: (task: Omit<RunnerTask, 'id'>) => void
  updateTask: (id: string, patch: Partial<Omit<RunnerTask, 'id'>>) => void
  removeTask: (id: string) => void
  addProfile: (name: string, taskIds: string[]) => void
  removeProfile: (id: string) => void

  runTask: (id: string) => Promise<void>
  stopTask: (id: string) => void
  runProfile: (id: string) => Promise<void>
  stopProfile: (id: string) => void

  /** Définit (ou efface) la commande ▶ d'un projet. */
  setProjectCommand: (root: string, command: string) => void
  runProject: (root: string, name: string) => Promise<void>
  stopProject: (root: string) => void
}

let counter = 0
const newId = (p: string): string => `${p}-${Date.now().toString(36)}-${++counter}`

export const useRunnerStore = create<RunnerState>((set, get) => {
  const persistTasks = (tasks: RunnerTask[]): void => {
    set({ tasks })
    void window.api.config.set('runnerTasks', tasks)
  }
  const persistProfiles = (profiles: RunnerProfile[]): void => {
    set({ profiles })
    void window.api.config.set('runnerProfiles', profiles)
  }

  // Lance une commande dans un onglet terminal et suit son état sous `key`.
  const runUnder = async (
    key: string,
    opts: { cwd: string; title: string; command: string }
  ): Promise<void> => {
    if (get().running[key]) return
    useUiStore.getState().setTerminalOpen(true)
    const ptyId = await useTerminalStore.getState().openTaskTab(opts)
    if (!ptyId) return
    set((s) => ({ running: { ...s.running, [key]: ptyId } }))
    const off = window.api.terminal.onExit(ptyId, () => {
      set((s) => {
        const r = { ...s.running }
        if (r[key] === ptyId) delete r[key]
        return { running: r }
      })
      off()
    })
  }

  const stopUnder = (key: string): void => {
    const ptyId = get().running[key]
    if (!ptyId) return
    window.api.terminal.kill(ptyId)
    set((s) => {
      const r = { ...s.running }
      delete r[key]
      return { running: r }
    })
  }

  return {
    tasks: [],
    profiles: [],
    projectLaunch: {},
    running: {},

    init: async () => {
      try {
        const [tasks, profiles, projectLaunch] = await Promise.all([
          window.api.config.get('runnerTasks'),
          window.api.config.get('runnerProfiles'),
          window.api.config.get('projectLaunch')
        ])
        set({
          tasks: tasks ?? [],
          profiles: profiles ?? [],
          projectLaunch: projectLaunch ?? {}
        })
      } catch {
        set({ tasks: [], profiles: [], projectLaunch: {} })
      }
    },

    addTask: (task) => persistTasks([...get().tasks, { ...task, id: newId('task') }]),
    updateTask: (id, patch) =>
      persistTasks(get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    removeTask: (id) => {
      get().stopTask(id)
      persistTasks(get().tasks.filter((t) => t.id !== id))
      // Retire la tâche des profils.
      persistProfiles(
        get().profiles.map((p) => ({ ...p, taskIds: p.taskIds.filter((tid) => tid !== id) }))
      )
    },

    addProfile: (name, taskIds) =>
      persistProfiles([...get().profiles, { id: newId('prof'), name, taskIds }]),
    removeProfile: (id) => persistProfiles(get().profiles.filter((p) => p.id !== id)),

    runTask: async (id) => {
      const task = get().tasks.find((t) => t.id === id)
      if (!task) return
      await runUnder(id, { cwd: task.cwd, title: task.name, command: task.command })
    },

    stopTask: (id) => stopUnder(id),

    runProfile: async (id) => {
      const profile = get().profiles.find((p) => p.id === id)
      if (!profile) return
      for (const tid of profile.taskIds) await get().runTask(tid)
    },

    stopProfile: (id) => {
      const profile = get().profiles.find((p) => p.id === id)
      if (!profile) return
      for (const tid of profile.taskIds) get().stopTask(tid)
    },

    setProjectCommand: (root, command) => {
      const next = { ...get().projectLaunch }
      if (command.trim()) next[root] = command.trim()
      else delete next[root]
      set({ projectLaunch: next })
      void window.api.config.set('projectLaunch', next)
    },

    runProject: async (root, name) => {
      const command = get().projectLaunch[root]
      if (!command) return
      await runUnder(projKey(root), { cwd: root, title: name, command })
    },

    stopProject: (root) => stopUnder(projKey(root))
  }
})
