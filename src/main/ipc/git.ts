import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import * as git from '../services/git'
import { getConfig, pushProject } from '../services/config-store'

/** Handler IPC Git : adaptateur fin au-dessus du service `git`. */
export function registerGitHandlers(): void {
  ipcMain.handle(IPC.gitStatus, async (_e, dir: string) => {
    const s = await git.status(dir)
    // Mémorise le dépôt visité pour la section Projets de la sidebar.
    if (s.isRepo && s.root) pushProject(s.root)
    return s
  })

  ipcMain.handle(IPC.gitProjects, async () => {
    return git.projects(getConfig('projectRoots'))
  })

  ipcMain.handle(IPC.gitCommit, async (_e, dir: string, message: string) => {
    return git.commitAll(dir, message)
  })

  ipcMain.handle(IPC.gitPull, async (_e, dir: string) => {
    return git.pull(dir)
  })

  ipcMain.handle(IPC.gitPush, async (_e, dir: string) => {
    return git.push(dir)
  })

  ipcMain.handle(IPC.gitStage, async (_e, dir: string, file: string) => {
    return git.stage(dir, file)
  })

  ipcMain.handle(IPC.gitUnstage, async (_e, dir: string, file: string) => {
    return git.unstage(dir, file)
  })

  ipcMain.handle(IPC.gitDiscard, async (_e, dir: string, file: string) => {
    return git.discard(dir, file)
  })

  ipcMain.handle(
    IPC.gitDiff,
    async (_e, dir: string, file: string, opts: { staged?: boolean; untracked?: boolean }) => {
      return git.diff(dir, file, opts)
    }
  )

  ipcMain.handle(IPC.gitBranches, async (_e, dir: string) => {
    return git.branches(dir)
  })

  ipcMain.handle(IPC.gitCheckout, async (_e, dir: string, branch: string) => {
    return git.checkout(dir, branch)
  })

  ipcMain.handle(IPC.gitCreateBranch, async (_e, dir: string, name: string) => {
    return git.createBranch(dir, name)
  })

  ipcMain.handle(IPC.gitFetch, async (_e, dir: string) => {
    return git.fetch(dir)
  })

  ipcMain.handle(IPC.gitStageAll, async (_e, dir: string) => {
    return git.stageAll(dir)
  })

  ipcMain.handle(IPC.gitUnstageAll, async (_e, dir: string) => {
    return git.unstageAll(dir)
  })

  ipcMain.handle(IPC.gitCommitStaged, async (_e, dir: string, message: string) => {
    return git.commitStaged(dir, message)
  })
}
