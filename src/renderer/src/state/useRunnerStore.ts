import { create } from 'zustand'
import type { RunnerTask, RunnerProfile, StoredLaunch, ProjectLaunch } from '@shared/types'
import { normalizeLaunches } from '@shared/launches'
import { useTerminalStore } from './useTerminalStore'
import { useUiStore } from './useUiStore'
import { t } from '../i18n'

/**
 * Lanceur de tâches : tâches (commande + dossier) et profils (groupes de tâches).
 * Persistés dans electron-store. L'exécution se fait dans le terminal intégré
 * (un onglet par tâche) ; on suit l'état « en cours » (taskId → ptyId).
 */
/** Clé d'état « en cours » pour le lancement d'un projet (vs un lancement). */
export const projKey = (root: string): string => `proj:${root}`
/** Clé d'état d'UN lancement précis d'un projet (plusieurs boutons ▶). */
export const launchKey = (root: string, launchId: string): string => `proj:${root}#${launchId}`

interface RunnerState {
  tasks: RunnerTask[]
  profiles: RunnerProfile[]
  /** Lancements du bouton ▶ de chaque projet (racine → lancements). */
  projectLaunch: Record<string, StoredLaunch>
  /** En cours : taskId (ou projKey) → ptyId de l'onglet terminal. */
  running: Record<string, string>
  /** Lancements tournant dans un terminal REPRIS (arrêt = Ctrl+C, pas kill). */
  reused: Record<string, boolean>

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

  /** Définit (ou efface) la commande ▶ d'un projet (rétrocompatible). */
  setProjectCommand: (root: string, command: string) => void
  /** Remplace la liste des lancements d'un projet. */
  setProjectLaunches: (root: string, launches: ProjectLaunch[]) => void
  /** Lancements d'un projet, ancien format compris. */
  launchesFor: (root: string) => ProjectLaunch[]
  /** Lance UN lancement précis du projet. */
  runLaunch: (root: string, launchId: string) => Promise<void>
  stopLaunch: (root: string, launchId: string) => void
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

  /**
   * Lance une commande et suit son état sous `key`.
   *
   * Réutilise un terminal LIBRE déjà ouvert sur le même dossier plutôt que
   * d'empiler un onglet de plus (demande utilisateur). « Libre » = vivant,
   * local, et sans tâche du lanceur en cours : on n'écrase jamais un serveur
   * qui tourne — dans ce cas un nouvel onglet est ouvert.
   *
   * Nuance assumée : dans un terminal réutilisé, GVue ne peut pas savoir
   * quand la commande se termine (c'est un shell interactif, le pty survit).
   * L'état reste donc « en cours » jusqu'au clic sur ■, qui envoie Ctrl+C au
   * lieu de tuer un terminal que l'utilisateur avait ouvert lui-même.
   */
  const runUnder = async (
    key: string,
    opts: { cwd: string; title: string; command: string }
  ): Promise<void> => {
    if (get().running[key]) return
    useUiStore.getState().setTerminalOpen(true)

    const busy = Object.values(get().running)
    const free = useTerminalStore.getState().freeTabFor(opts.cwd, busy)
    if (free) {
      useTerminalStore.getState().runInTab(free.id, opts.command)
      set((s) => ({
        running: { ...s.running, [key]: free.ptyId },
        reused: { ...s.reused, [key]: true }
      }))
      // Le terminal peut quand même mourir (exit tapé par l'utilisateur).
      const off = window.api.terminal.onExit(free.ptyId, () => {
        set((s) => {
          const r = { ...s.running }
          const u = { ...s.reused }
          if (r[key] === free.ptyId) {
            delete r[key]
            delete u[key]
          }
          return { running: r, reused: u }
        })
        off()
      })
      return
    }

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
    // Terminal réutilisé : il appartient à l'utilisateur → Ctrl+C, pas kill.
    if (get().reused[key]) window.api.terminal.write(ptyId, '\u0003') // Ctrl+C
    else window.api.terminal.kill(ptyId)
    set((s) => {
      const r = { ...s.running }
      const u = { ...s.reused }
      delete r[key]
      delete u[key]
      return { running: r, reused: u }
    })
  }

  return {
    tasks: [],
    profiles: [],
    projectLaunch: {},
    running: {},
    reused: {},

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
      const cmd = command.trim()
      if (!cmd) {
        get().setProjectLaunches(root, [])
        return
      }
      // Conserve les autres lancements : on ne remplace que le premier.
      const list = get().launchesFor(root)
      const next = list.length
        ? list.map((l, i) => (i === 0 ? { ...l, command: cmd } : l))
        : [{ id: 'principal', name: t('Lancer'), command: cmd, icon: 'play' as const }]
      get().setProjectLaunches(root, next)
    },

    setProjectLaunches: (root, launches) => {
      const next = { ...get().projectLaunch }
      if (launches.length) next[root] = launches
      else delete next[root]
      set({ projectLaunch: next })
      void window.api.config.set('projectLaunch', next)
    },

    launchesFor: (root) => normalizeLaunches(get().projectLaunch[root]),

    runLaunch: async (root, launchId) => {
      const launch = get().launchesFor(root).find((l) => l.id === launchId)
      if (!launch) return
      await runUnder(launchKey(root, launchId), {
        cwd: root,
        title: launch.name,
        command: launch.command
      })
    },

    stopLaunch: (root, launchId) => stopUnder(launchKey(root, launchId)),

    // Bouton ▶ historique : le PREMIER lancement du projet.
    runProject: async (root, name) => {
      const first = get().launchesFor(root)[0]
      if (!first) return
      await runUnder(launchKey(root, first.id), { cwd: root, title: name, command: first.command })
    },

    stopProject: (root) => {
      const first = get().launchesFor(root)[0]
      if (first) stopUnder(launchKey(root, first.id))
      // Ancien état éventuellement enregistré sous la clé sans lancement.
      stopUnder(projKey(root))
    }
  }
})
