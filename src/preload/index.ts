import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  ListResult,
  NavLocations,
  PathKind,
  PreviewData,
  FileOpResult,
  CreateResult,
  QuickAccessData,
  GitStatus,
  GitActionResult,
  GitProject,
  DetectedApps,
  ExternalAppId,
  AppConfig,
  WindowAction,
  WindowStatus,
  ShellInfo,
  TerminalCreateOptions,
  TerminalDataEvent,
  TerminalExitEvent,
  SearchOptions,
  SearchResultEvent,
  SearchDoneEvent,
  NavCommand
} from '@shared/types'

/**
 * Dispatcher de flux terminal.
 * La sortie d'un pty peut arriver AVANT que le composant ne s'abonne (l'invite
 * du shell est émise dès le spawn). On tamponne donc par ptyId tant qu'aucun
 * abonné n'est présent, puis on vide le tampon à l'abonnement → zéro perte.
 */
const dataSubs = new Map<string, Set<(d: string) => void>>()
const dataBuffer = new Map<string, string[]>()
const exitSubs = new Map<string, Set<(code: number) => void>>()

ipcRenderer.on(IPC.terminalOnData, (_e, ev: TerminalDataEvent) => {
  const subs = dataSubs.get(ev.ptyId)
  if (subs && subs.size > 0) {
    subs.forEach((cb) => cb(ev.data))
  } else {
    const buf = dataBuffer.get(ev.ptyId) ?? []
    buf.push(ev.data)
    // Plafonne le tampon : un terminal masqué produisant beaucoup de logs ne
    // doit pas faire gonfler la mémoire indéfiniment (on garde le plus récent).
    if (buf.length > 2000) buf.splice(0, buf.length - 2000)
    dataBuffer.set(ev.ptyId, buf)
  }
})

ipcRenderer.on(IPC.terminalOnExit, (_e, ev: TerminalExitEvent) => {
  exitSubs.get(ev.ptyId)?.forEach((cb) => cb(ev.exitCode))
})

/**
 * Pont de sécurité : seule surface exposée au renderer.
 * Aucune fuite de `require`, `ipcRenderer` brut ou API Node.
 * Chaque méthode est un appel IPC typé vers le processus principal.
 */
const api = {
  fs: {
    list: (path: string, track = true): Promise<ListResult> =>
      ipcRenderer.invoke(IPC.fsList, path, track),
    locations: (): Promise<NavLocations> => ipcRenderer.invoke(IPC.fsLocations),
    reveal: (path: string): Promise<void> => ipcRenderer.invoke(IPC.fsReveal, path),
    open: (path: string): Promise<string> => ipcRenderer.invoke(IPC.fsOpen, path),
    probe: (path: string): Promise<PathKind> => ipcRenderer.invoke(IPC.fsProbe, path),
    packageScripts: (dir: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.fsPackageScripts, dir),
    runnableFiles: (dir: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.fsRunnableFiles, dir),
    pickFile: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.fsPickFile, defaultPath),
    trash: (path: string): Promise<void> => ipcRenderer.invoke(IPC.fsTrash, path),
    preview: (path: string): Promise<PreviewData> => ipcRenderer.invoke(IPC.fsPreview, path),
    icon: (path: string): Promise<string> => ipcRenderer.invoke(IPC.fsIcon, path),
    copy: (paths: string[], destDir: string): Promise<FileOpResult> =>
      ipcRenderer.invoke(IPC.fsCopy, paths, destDir),
    move: (paths: string[], destDir: string): Promise<FileOpResult> =>
      ipcRenderer.invoke(IPC.fsMove, paths, destDir),
    rename: (path: string, newName: string): Promise<CreateResult> =>
      ipcRenderer.invoke(IPC.fsRename, path, newName),
    createFile: (dir: string, base: string): Promise<CreateResult> =>
      ipcRenderer.invoke(IPC.fsCreateFile, dir, base),
    createDir: (dir: string, base: string): Promise<CreateResult> =>
      ipcRenderer.invoke(IPC.fsCreateDir, dir, base),
    createShortcut: (path: string, destDir?: string): Promise<CreateResult> =>
      ipcRenderer.invoke(IPC.fsCreateShortcut, path, destDir),
    startDrag: (paths: string[]): void => ipcRenderer.send(IPC.fsStartDrag, paths),
    /** Chemin absolu d'un File déposé (drag depuis l'explorateur/une autre instance). */
    pathForFile: (file: File): string => webUtils.getPathForFile(file),
    quickAccess: (): Promise<QuickAccessData> => ipcRenderer.invoke(IPC.fsQuickAccess),
    onChange: (cb: (path: string) => void): (() => void) => {
      const listener = (_e: unknown, path: string): void => cb(path)
      ipcRenderer.on(IPC.fsOnChange, listener)
      return () => ipcRenderer.removeListener(IPC.fsOnChange, listener)
    }
  },
  apps: {
    list: (): Promise<DetectedApps> => ipcRenderer.invoke(IPC.appsList),
    openWith: (appId: ExternalAppId, paths: string[]): void =>
      ipcRenderer.send(IPC.appsOpenWith, appId, paths),
    openPathWith: (exe: string, paths: string[]): void =>
      ipcRenderer.send(IPC.appsOpenPathWith, exe, paths),
    pickProgram: (): Promise<string | null> => ipcRenderer.invoke(IPC.appsPickProgram),
    archive: (paths: string[], destDir?: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.appsArchive, paths, destDir),
    extract: (archivePath: string, destDir?: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.appsExtract, archivePath, destDir)
  },
  git: {
    status: (dir: string): Promise<GitStatus> => ipcRenderer.invoke(IPC.gitStatus, dir),
    commit: (dir: string, message: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitCommit, dir, message),
    pull: (dir: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC.gitPull, dir),
    push: (dir: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC.gitPush, dir),
    stage: (dir: string, file: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitStage, dir, file),
    unstage: (dir: string, file: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitUnstage, dir, file),
    discard: (dir: string, file: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitDiscard, dir, file),
    projects: (): Promise<GitProject[]> => ipcRenderer.invoke(IPC.gitProjects)
  },
  nav: {
    onCommand: (cb: (cmd: NavCommand) => void): (() => void) => {
      const listener = (_e: unknown, cmd: NavCommand): void => cb(cmd)
      ipcRenderer.on(IPC.navOnCommand, listener)
      return () => ipcRenderer.removeListener(IPC.navOnCommand, listener)
    }
  },
  search: {
    start: (searchId: string, opts: SearchOptions): Promise<void> =>
      ipcRenderer.invoke(IPC.searchStart, searchId, opts),
    cancel: (searchId: string): void => ipcRenderer.send(IPC.searchCancel, searchId),
    onResult: (cb: (ev: SearchResultEvent) => void): (() => void) => {
      const listener = (_e: unknown, ev: SearchResultEvent): void => cb(ev)
      ipcRenderer.on(IPC.searchOnResult, listener)
      return () => ipcRenderer.removeListener(IPC.searchOnResult, listener)
    },
    onDone: (cb: (ev: SearchDoneEvent) => void): (() => void) => {
      const listener = (_e: unknown, ev: SearchDoneEvent): void => cb(ev)
      ipcRenderer.on(IPC.searchOnDone, listener)
      return () => ipcRenderer.removeListener(IPC.searchOnDone, listener)
    }
  },
  config: {
    get: <K extends keyof AppConfig>(key: K): Promise<AppConfig[K]> =>
      ipcRenderer.invoke(IPC.configGet, key),
    set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> =>
      ipcRenderer.invoke(IPC.configSet, key, value),
    all: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configAll)
  },
  terminal: {
    shells: (): Promise<ShellInfo[]> => ipcRenderer.invoke(IPC.terminalShells),
    create: (opts: TerminalCreateOptions): Promise<string> =>
      ipcRenderer.invoke(IPC.terminalCreate, opts),
    write: (ptyId: string, data: string): void =>
      ipcRenderer.send(IPC.terminalWrite, ptyId, data),
    resize: (ptyId: string, cols: number, rows: number): void =>
      ipcRenderer.send(IPC.terminalResize, ptyId, cols, rows),
    kill: (ptyId: string): void => ipcRenderer.send(IPC.terminalKill, ptyId),
    onData: (ptyId: string, cb: (data: string) => void): (() => void) => {
      let set = dataSubs.get(ptyId)
      if (!set) {
        set = new Set()
        dataSubs.set(ptyId, set)
      }
      set.add(cb)
      // Vide le tampon accumulé avant l'abonnement.
      const buffered = dataBuffer.get(ptyId)
      if (buffered) {
        buffered.forEach((d) => cb(d))
        dataBuffer.delete(ptyId)
      }
      return () => {
        const s = dataSubs.get(ptyId)
        s?.delete(cb)
        if (s && s.size === 0) dataSubs.delete(ptyId)
      }
    },
    onExit: (ptyId: string, cb: (code: number) => void): (() => void) => {
      let set = exitSubs.get(ptyId)
      if (!set) {
        set = new Set()
        exitSubs.set(ptyId, set)
      }
      set.add(cb)
      return () => {
        const s = exitSubs.get(ptyId)
        s?.delete(cb)
        if (s && s.size === 0) exitSubs.delete(ptyId)
      }
    }
  },
  window: {
    action: (action: WindowAction): Promise<void> =>
      ipcRenderer.invoke(IPC.windowAction, action),
    status: (): Promise<WindowStatus> => ipcRenderer.invoke(IPC.windowStatus),
    setOpacity: (value: number): Promise<void> => ipcRenderer.invoke(IPC.windowSetOpacity, value),
    onStatus: (cb: (status: WindowStatus) => void): (() => void) => {
      const listener = (_e: unknown, status: WindowStatus): void => cb(status)
      ipcRenderer.on(IPC.windowOnStatus, listener)
      return () => ipcRenderer.removeListener(IPC.windowOnStatus, listener)
    }
  }
}

export type GvueApi = typeof api

contextBridge.exposeInMainWorld('api', api)
