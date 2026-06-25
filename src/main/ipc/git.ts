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
}
