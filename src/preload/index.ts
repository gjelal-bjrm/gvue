import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  ListResult,
  NavLocations,
  PathKind,
  TreeEntry,
  UsageEntry,
  PreviewData,
  FileOpResult,
  CreateResult,
  QuickAccessData,
  GitStatus,
  GitActionResult,
  GitProject,
  GitBranches,
  GitCommit,
  GitFileChange,
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
  NavCommand,
  UpdateStatus,
  RendererErrorReport,
  UndoInfo,
  UndoResult,
  CopyProgress,
  NativeMenuItem,
  ConflictMode,
  ConflictInfo,
  ArchiveEntry,
  McpContext,
  SysClipboardFiles,
  JustRecipe,
  RecycleItem,
  SshHost,
  TidyMovedEvent,
  SftpEntry,
  SftpConnectResult,
  SftpProgress
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
    complete: (cwd: string, token: string, sep: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.fsComplete, cwd, token, sep),
    /** Recettes du justfile gouvernant `dir` (recherche ascendante). */
    justRecipes: (dir: string): Promise<JustRecipe[]> =>
      ipcRenderer.invoke(IPC.fsJustRecipes, dir),
    listTree: (dir: string, max?: number): Promise<TreeEntry[]> =>
      ipcRenderer.invoke(IPC.fsListTree, dir, max),
    usage: (dir: string): Promise<UsageEntry[]> => ipcRenderer.invoke(IPC.fsUsage, dir),
    makeDirs: (baseDir: string, rels: string[]): Promise<{ created: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC.fsMakeDirs, baseDir, rels),
    trash: (path: string): Promise<void> => ipcRenderer.invoke(IPC.fsTrash, path),
    preview: (path: string): Promise<PreviewData> => ipcRenderer.invoke(IPC.fsPreview, path),
    icon: (path: string, size?: number): Promise<string> =>
      ipcRenderer.invoke(IPC.fsIcon, path, size),
    copy: (paths: string[], destDir: string, mode?: ConflictMode): Promise<FileOpResult> =>
      ipcRenderer.invoke(IPC.fsCopy, paths, destDir, mode),
    move: (paths: string[], destDir: string, mode?: ConflictMode): Promise<FileOpResult> =>
      ipcRenderer.invoke(IPC.fsMove, paths, destDir, mode),
    conflicts: (paths: string[], destDir: string): Promise<ConflictInfo[]> =>
      ipcRenderer.invoke(IPC.fsConflicts, paths, destDir),
    rename: (path: string, newName: string): Promise<CreateResult> =>
      ipcRenderer.invoke(IPC.fsRename, path, newName),
    renameMany: (paths: string[], newNames: string[]): Promise<FileOpResult> =>
      ipcRenderer.invoke(IPC.fsRenameMany, paths, newNames),
    undo: (): Promise<UndoResult> => ipcRenderer.invoke(IPC.fsUndo),
    undoPeek: (): Promise<UndoInfo> => ipcRenderer.invoke(IPC.fsUndoPeek),
    cancelCopy: (): void => ipcRenderer.send(IPC.fsCancelCopy),
    onCopyProgress: (cb: (p: CopyProgress | null) => void): (() => void) => {
      const listener = (_e: unknown, p: CopyProgress | null): void => cb(p)
      ipcRenderer.on(IPC.fsOnCopyProgress, listener)
      return () => ipcRenderer.removeListener(IPC.fsOnCopyProgress, listener)
    },
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
    /** Sélecteur natif de dossier (destinations : rangement auto…). */
    pickFolder: (title?: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.appsPickFolder, title),
    archive: (paths: string[], destDir?: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.appsArchive, paths, destDir),
    extract: (archivePath: string, destDir?: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.appsExtract, archivePath, destDir),
    openAsDialog: (path: string): void => ipcRenderer.send(IPC.appsOpenAsDialog, path),
    properties: (path: string): void => ipcRenderer.send(IPC.appsProperties, path)
  },
  archive: {
    list: (path: string): Promise<{ ok: boolean; entries: ArchiveEntry[]; error?: string }> =>
      ipcRenderer.invoke(IPC.archiveList, path),
    extract: (path: string, destDir?: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.archiveExtract, path, destDir)
  },
  integration: {
    /** Intégration Explorateur : { supported, enabled } (« Ouvrir dans GVue »). */
    get: (): Promise<{ supported: boolean; enabled: boolean }> =>
      ipcRenderer.invoke(IPC.integrationGet),
    /** Enregistre / retire l'entrée du menu contextuel de l'Explorateur. */
    set: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke(IPC.integrationSet, enabled)
  },
  ssh: {
    /** Hôtes lus dans ~/.ssh/config (lecture seule, jamais modifié par GVue). */
    configHosts: (): Promise<SshHost[]> => ipcRenderer.invoke(IPC.sshConfigHosts),
    /** OpenSSH (client ssh) est-il disponible sur la machine ? */
    available: (): Promise<boolean> => ipcRenderer.invoke(IPC.sshAvailable),
    /** Sessions PuTTY/WinSCP trouvées sur la machine (registre + WinSCP.ini). */
    importSources: (): Promise<{ putty: SshHost[]; winscp: SshHost[] }> =>
      ipcRenderer.invoke(IPC.sshImportSources)
  },
  sftp: {
    connect: (
      host: SshHost,
      opts?: { password?: string; acceptFingerprint?: string; savePassword?: boolean }
    ): Promise<SftpConnectResult> => ipcRenderer.invoke(IPC.sftpConnect, host, opts),
    /** Un mot de passe est-il enregistré (chiffré) pour cet hôte ? */
    hasPassword: (hostKey: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.sftpHasPassword, hostKey),
    /** Oublie le mot de passe enregistré d'un hôte. */
    forgetPassword: (hostKey: string): Promise<void> =>
      ipcRenderer.invoke(IPC.sftpForgetPassword, hostKey),
    /** Enregistre (chiffré par l'OS) le mot de passe d'un hôte. */
    savePassword: (hostKey: string, password: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.sftpSavePassword, hostKey, password),
    /** Le chiffrement OS est-il disponible sur cette machine ? */
    secretsAvailable: (): Promise<boolean> => ipcRenderer.invoke(IPC.sftpSecretsAvailable),
    disconnect: (hostKey: string): Promise<void> => ipcRenderer.invoke(IPC.sftpDisconnect, hostKey),
    list: (hostKey: string, dir: string): Promise<{ entries?: SftpEntry[]; error?: string }> =>
      ipcRenderer.invoke(IPC.sftpList, hostKey, dir),
    mkdir: (hostKey: string, path: string): Promise<{ error?: string }> =>
      ipcRenderer.invoke(IPC.sftpMkdir, hostKey, path),
    rename: (hostKey: string, from: string, to: string): Promise<{ error?: string }> =>
      ipcRenderer.invoke(IPC.sftpRename, hostKey, from, to),
    delete: (hostKey: string, entries: SftpEntry[]): Promise<{ ok: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC.sftpDelete, hostKey, entries),
    download: (
      hostKey: string,
      entries: SftpEntry[],
      destDir: string
    ): Promise<{ ok: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC.sftpDownload, hostKey, entries, destDir),
    upload: (
      hostKey: string,
      localPaths: string[],
      remoteDir: string,
      contents?: boolean
    ): Promise<{ ok: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC.sftpUpload, hostKey, localPaths, remoteDir, contents),
    /** Télécharge, ouvre localement, ré-téléverse à chaque sauvegarde. */
    edit: (hostKey: string, entry: SftpEntry): Promise<{ local?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.sftpEdit, hostKey, entry),
    onProgress: (cb: (p: SftpProgress) => void): (() => void) => {
      const listener = (_e: unknown, p: SftpProgress): void => cb(p)
      ipcRenderer.on(IPC.sftpOnProgress, listener)
      return () => ipcRenderer.removeListener(IPC.sftpOnProgress, listener)
    }
  },
  bin: {
    /** Contenu de la corbeille Windows (tous lecteurs). */
    list: (): Promise<RecycleItem[]> => ipcRenderer.invoke(IPC.binList),
    /** Restaure des éléments à leur emplacement d'origine. */
    restore: (ids: string[]): Promise<{ ok: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC.binRestore, ids),
    /** Supprime définitivement des éléments (irréversible). */
    delete: (ids: string[]): Promise<{ ok: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC.binDelete, ids),
    /** Vide entièrement la corbeille. */
    empty: (): Promise<{ ok: number; errors: string[] }> => ipcRenderer.invoke(IPC.binEmpty)
  },
  clip: {
    /** Fichiers du presse-papiers système (Explorateur Windows), ou null. */
    readFiles: (): Promise<SysClipboardFiles | null> => ipcRenderer.invoke(IPC.clipReadFiles),
    /** Place des fichiers dans le presse-papiers système (copier ou couper). */
    writeFiles: (files: string[], move: boolean): Promise<boolean> =>
      ipcRenderer.invoke(IPC.clipWriteFiles, files, move),
    /** Vide le presse-papiers système (après un couper-coller consommé). */
    clear: (): Promise<void> => ipcRenderer.invoke(IPC.clipClear)
  },
  git: {
    status: (dir: string): Promise<GitStatus> => ipcRenderer.invoke(IPC.gitStatus, dir),
    commit: (dir: string, message: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitCommit, dir, message),
    pull: (dir: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC.gitPull, dir),
    push: (dir: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC.gitPush, dir),
    stage: (dir: string, files: string[]): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitStage, dir, files),
    unstage: (dir: string, files: string[]): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitUnstage, dir, files),
    discard: (dir: string, file: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitDiscard, dir, file),
    projects: (): Promise<GitProject[]> => ipcRenderer.invoke(IPC.gitProjects),
    /** Met un projet de côté (réapparaît à sa prochaine visite) ; renvoie la liste à jour. */
    hideProject: (root: string): Promise<GitProject[]> =>
      ipcRenderer.invoke(IPC.gitHideProject, root),
    /** Réaffiche tous les projets mis de côté ; renvoie la liste à jour. */
    unhideProjects: (): Promise<GitProject[]> => ipcRenderer.invoke(IPC.gitUnhideProjects),
    diff: (
      dir: string,
      file: string,
      opts: { staged?: boolean; untracked?: boolean }
    ): Promise<string> => ipcRenderer.invoke(IPC.gitDiff, dir, file, opts),
    branches: (dir: string): Promise<GitBranches> => ipcRenderer.invoke(IPC.gitBranches, dir),
    checkout: (dir: string, branch: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitCheckout, dir, branch),
    createBranch: (dir: string, name: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitCreateBranch, dir, name),
    fetch: (dir: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC.gitFetch, dir),
    stageAll: (dir: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC.gitStageAll, dir),
    unstageAll: (dir: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitUnstageAll, dir),
    commitStaged: (dir: string, message: string): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitCommitStaged, dir, message),
    ignore: (dir: string, patterns: string[]): Promise<GitActionResult> =>
      ipcRenderer.invoke(IPC.gitIgnore, dir, patterns),
    log: (dir: string, limit?: number, all?: boolean): Promise<GitCommit[]> =>
      ipcRenderer.invoke(IPC.gitLog, dir, limit, all),
    fileLog: (dir: string, file: string, limit?: number): Promise<GitCommit[]> =>
      ipcRenderer.invoke(IPC.gitFileLog, dir, file, limit),
    commitFiles: (dir: string, hash: string): Promise<GitFileChange[]> =>
      ipcRenderer.invoke(IPC.gitCommitFiles, dir, hash),
    commitDiff: (dir: string, hash: string, file: string): Promise<string> =>
      ipcRenderer.invoke(IPC.gitCommitDiff, dir, hash, file)
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
    new: (): Promise<void> => ipcRenderer.invoke(IPC.windowNew),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.openExternal, url),
    setOpacity: (value: number): Promise<void> => ipcRenderer.invoke(IPC.windowSetOpacity, value),
    onStatus: (cb: (status: WindowStatus) => void): (() => void) => {
      const listener = (_e: unknown, status: WindowStatus): void => cb(status)
      ipcRenderer.on(IPC.windowOnStatus, listener)
      return () => ipcRenderer.removeListener(IPC.windowOnStatus, listener)
    }
  },
  pick: {
    /** Mode sélecteur (--pick) : GVue choisit un fichier pour un autre outil G. */
    onMode: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.pickMode, listener)
      return () => ipcRenderer.removeListener(IPC.pickMode, listener)
    },
    /** Valide le choix : le main écrit le fichier de sortie puis quitte. */
    confirm: (paths: string[]): Promise<void> => ipcRenderer.invoke(IPC.pickConfirm, paths)
  },
  tray: {
    onOpenPath: (cb: (path: string) => void): (() => void) => {
      const listener = (_e: unknown, path: string): void => cb(path)
      ipcRenderer.on(IPC.trayOpenPath, listener)
      return () => ipcRenderer.removeListener(IPC.trayOpenPath, listener)
    },
    onRunTask: (cb: (id: string) => void): (() => void) => {
      const listener = (_e: unknown, id: string): void => cb(id)
      ipcRenderer.on(IPC.trayRunTask, listener)
      return () => ipcRenderer.removeListener(IPC.trayRunTask, listener)
    },
    /** Tray → terminal SSH vers un serveur. */
    onOpenSsh: (cb: (host: SshHost) => void): (() => void) => {
      const listener = (_e: unknown, host: SshHost): void => cb(host)
      ipcRenderer.on(IPC.trayOpenSsh, listener)
      return () => ipcRenderer.removeListener(IPC.trayOpenSsh, listener)
    },
    /** Tray → explorateur SFTP d'un serveur. */
    onBrowseSsh: (cb: (host: SshHost) => void): (() => void) => {
      const listener = (_e: unknown, host: SshHost): void => cb(host)
      ipcRenderer.on(IPC.trayBrowseSsh, listener)
      return () => ipcRenderer.removeListener(IPC.trayBrowseSsh, listener)
    },
    onRunProject: (cb: (root: string) => void): (() => void) => {
      const listener = (_e: unknown, root: string): void => cb(root)
      ipcRenderer.on(IPC.trayRunProject, listener)
      return () => ipcRenderer.removeListener(IPC.trayRunProject, listener)
    },
    /** Ce que la ligne de commande demandait — consommé une seule fois. */
    pending: (): Promise<{ workspace?: string; dir?: string } | null> =>
      ipcRenderer.invoke(IPC.cliPending),
    onLoadWorkspace: (cb: (name: string) => void): (() => void) => {
      const listener = (_e: unknown, name: string): void => cb(name)
      ipcRenderer.on(IPC.trayLoadWorkspace, listener)
      return () => ipcRenderer.removeListener(IPC.trayLoadWorkspace, listener)
    }
  },
  tidy: {
    /** Rangement auto : un fichier vient d'être déplacé (toast + rafraîchit). */
    onMoved: (cb: (ev: TidyMovedEvent) => void): (() => void) => {
      const listener = (_e: unknown, ev: TidyMovedEvent): void => cb(ev)
      ipcRenderer.on(IPC.tidyMoved, listener)
      return () => ipcRenderer.removeListener(IPC.tidyMoved, listener)
    },
    /** La config a changé (toute origine, tray compris) → recharger le store. */
    onChanged: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.tidyChanged, listener)
      return () => ipcRenderer.removeListener(IPC.tidyChanged, listener)
    },
    /** Dossier « Mes scripts » : contenu (crée + exemples au premier appel). */
    listScripts: (): Promise<{ dir: string; scripts: string[] }> =>
      ipcRenderer.invoke(IPC.tidyScriptsList),
    /** Ouvre le dossier « Mes scripts » dans l'explorateur. */
    openScripts: (): Promise<void> => ipcRenderer.invoke(IPC.tidyScriptsOpen),
    /** Un script d'action a échoué (introuvable, interpréteur absent…). */
    onScriptError: (cb: (message: string) => void): (() => void) => {
      const listener = (_e: unknown, message: string): void => cb(message)
      ipcRenderer.on(IPC.tidyScriptError, listener)
      return () => ipcRenderer.removeListener(IPC.tidyScriptError, listener)
    }
  },
  update: {
    check: (): Promise<void> => ipcRenderer.invoke(IPC.updateCheck),
    install: (): Promise<void> => ipcRenderer.invoke(IPC.updateInstall),
    get: (): Promise<{ status: UpdateStatus; version: string }> =>
      ipcRenderer.invoke(IPC.updateGet),
    onStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_e: unknown, status: UpdateStatus): void => cb(status)
      ipcRenderer.on(IPC.updateStatus, listener)
      return () => ipcRenderer.removeListener(IPC.updateStatus, listener)
    }
  },
  menu: {
    /** Affiche un menu contextuel natif ; résout avec l'id cliqué (ou null). */
    popup: (items: NativeMenuItem[], x: number, y: number): Promise<string | null> =>
      ipcRenderer.invoke(IPC.menuPopup, items, x, y)
  },
  mcp: {
    /** Pousse l'instantané de contexte (onglets/sélection/terminaux) au serveur MCP. */
    pushContext: (ctx: McpContext): void => ipcRenderer.send(IPC.mcpContext, ctx),
    toggle: (enabled: boolean): Promise<{ enabled: boolean; port: number; bridgePath: string }> =>
      ipcRenderer.invoke(IPC.mcpToggle, enabled),
    status: (): Promise<{ enabled: boolean; port: number; bridgePath: string }> =>
      ipcRenderer.invoke(IPC.mcpStatus),
    /** Un agent demande un terminal visible (cwd + commande optionnelle). */
    onOpenTerminal: (
      cb: (req: { cwd: string; command: string; title: string }) => void
    ): (() => void) => {
      const listener = (_e: unknown, req: { cwd: string; command: string; title: string }): void =>
        cb(req)
      ipcRenderer.on(IPC.mcpOpenTerminal, listener)
      return () => ipcRenderer.removeListener(IPC.mcpOpenTerminal, listener)
    },
    /** Un agent demande de révéler un fichier/dossier (naviguer + sélectionner). */
    onReveal: (cb: (path: string) => void): (() => void) => {
      const listener = (_e: unknown, path: string): void => cb(path)
      ipcRenderer.on(IPC.mcpReveal, listener)
      return () => ipcRenderer.removeListener(IPC.mcpReveal, listener)
    },
    /** Un agent affiche une notification (toast) dans GVue. */
    onNotify: (cb: (message: string) => void): (() => void) => {
      const listener = (_e: unknown, message: string): void => cb(message)
      ipcRenderer.on(IPC.mcpNotify, listener)
      return () => ipcRenderer.removeListener(IPC.mcpNotify, listener)
    },
    /** Un agent ouvre/ferme un panneau ou un dialogue (captures, démos). */
    onSetUi: (cb: (req: { panel: string; open: boolean }) => void): (() => void) => {
      const listener = (_e: unknown, req: { panel: string; open: boolean }): void => cb(req)
      ipcRenderer.on(IPC.mcpSetUi, listener)
      return () => ipcRenderer.removeListener(IPC.mcpSetUi, listener)
    },
    /** Un agent applique un thème. */
    onSetTheme: (cb: (theme: string) => void): (() => void) => {
      const listener = (_e: unknown, theme: string): void => cb(theme)
      ipcRenderer.on(IPC.mcpSetTheme, listener)
      return () => ipcRenderer.removeListener(IPC.mcpSetTheme, listener)
    }
  },
  log: {
    report: (report: RendererErrorReport): Promise<void> =>
      ipcRenderer.invoke(IPC.logReport, report),
    path: (): Promise<string> => ipcRenderer.invoke(IPC.logPath)
  }
}

export type GvueApi = typeof api

contextBridge.exposeInMainWorld('api', api)
