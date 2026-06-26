import { create } from 'zustand'
import type { RunnerTask, RunnerProfile } from '@shared/types'
import { useTerminalStore } from './useTerminalStore'
import { useUiStore } from './useUiStore'

/**
 * Lanceur de tâches : tâches (commande + dossier) et profils (groupes de tâches).
 * Persistés dans electron-store. L'exécution se fait dans le terminal intégré
 * (un onglet par tâche) ; on suit l'état « en cours » (taskId → ptyId).
 */
interface RunnerState {
  tasks: RunnerTask[]
  profiles: RunnerProfile[]
  /** Tâches en cours : taskId → ptyId de l'onglet terminal. */
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

  return {
    tasks: [],
    profiles: [],
    running: {},

    init: async () => {
      try {
        const [tasks, profiles] = await Promise.all([
          window.api.config.get('runnerTasks'),
          window.api.config.get('runnerProfiles')
        ])
        set({ tasks: tasks ?? [], profiles: profiles ?? [] })
      } catch {
        set({ tasks: [], profiles: [] })
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
      if (!task || get().running[id]) return
      useUiStore.getState().setTerminalOpen(true)
      const ptyId = await useTerminalStore
        .getState()
        .openTaskTab({ cwd: task.cwd, title: task.name, command: task.command })
      if (!ptyId) return
      set((s) => ({ running: { ...s.running, [id]: ptyId } }))
      const off = window.api.terminal.onExit(ptyId, () => {
        set((s) => {
          const r = { ...s.running }
          if (r[id] === ptyId) delete r[id]
          return { running: r }
        })
        off()
      })
    },

    stopTask: (id) => {
      const ptyId = get().running[id]
      if (!ptyId) return
      window.api.terminal.kill(ptyId)
      set((s) => {
        const r = { ...s.running }
        delete r[id]
        return { running: r }
      })
    },

    runProfile: async (id) => {
      const profile = get().profiles.find((p) => p.id === id)
      if (!profile) return
      for (const tid of profile.taskIds) await get().runTask(tid)
    },

    stopProfile: (id) => {
      const profile = get().profiles.find((p) => p.id === id)
      if (!profile) return
      for (const tid of profile.taskIds) get().stopTask(tid)
    }
  }
})
