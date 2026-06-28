// Noms de canaux IPC, centralisés pour éviter les chaînes magiques dispersées.
// Convention : « domaine:action ». Les flux continus utilisent le suffixe « :on… ».

export const IPC = {
  // Système de fichiers
  fsList: 'fs:list',
  fsLocations: 'fs:locations',
  fsReveal: 'fs:reveal',
  fsOpen: 'fs:open',
  fsProbe: 'fs:probe',
  fsPackageScripts: 'fs:packageScripts',
  fsRunnableFiles: 'fs:runnableFiles',
  fsComplete: 'fs:complete',
  fsListTree: 'fs:listTree',
  fsUsage: 'fs:usage',
  fsMakeDirs: 'fs:makeDirs',
  fsTrash: 'fs:trash',
  fsPreview: 'fs:preview',
  fsIcon: 'fs:icon',
  fsCopy: 'fs:copy',
  fsMove: 'fs:move',
  fsRename: 'fs:rename',
  fsRenameMany: 'fs:renameMany',
  fsUndo: 'fs:undo',
  fsUndoPeek: 'fs:undoPeek',
  fsCancelCopy: 'fs:cancelCopy',
  fsOnCopyProgress: 'fs:onCopyProgress',
  fsCreateFile: 'fs:createFile',
  fsCreateDir: 'fs:createDir',
  fsCreateShortcut: 'fs:createShortcut',
  fsStartDrag: 'fs:startDrag',
  fsQuickAccess: 'fs:quickAccess',
  fsOnChange: 'fs:onChange',

  // Terminal
  terminalShells: 'terminal:shells',
  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  terminalOnData: 'terminal:onData',
  terminalOnExit: 'terminal:onExit',

  // Applications externes
  appsList: 'apps:list',
  appsOpenWith: 'apps:openWith',
  appsOpenPathWith: 'apps:openPathWith',
  appsPickProgram: 'apps:pickProgram',
  appsArchive: 'apps:archive',
  appsExtract: 'apps:extract',

  // Git
  gitStatus: 'git:status',
  gitCommit: 'git:commit',
  gitPull: 'git:pull',
  gitPush: 'git:push',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitDiscard: 'git:discard',
  gitProjects: 'git:projects',
  gitDiff: 'git:diff',
  gitBranches: 'git:branches',
  gitCheckout: 'git:checkout',
  gitCreateBranch: 'git:createBranch',
  gitFetch: 'git:fetch',
  gitStageAll: 'git:stageAll',
  gitUnstageAll: 'git:unstageAll',
  gitCommitStaged: 'git:commitStaged',
  gitIgnore: 'git:ignore',
  gitLog: 'git:log',
  gitCommitFiles: 'git:commitFiles',
  gitCommitDiff: 'git:commitDiff',

  // Navigation (commandes système : boutons souris précédent/suivant)
  navOnCommand: 'nav:onCommand',

  // Recherche (ripgrep)
  searchStart: 'search:start',
  searchCancel: 'search:cancel',
  searchOnResult: 'search:onResult',
  searchOnDone: 'search:onDone',

  // Configuration
  configGet: 'config:get',
  configSet: 'config:set',
  configAll: 'config:all',

  // Fenêtre
  windowAction: 'window:action',
  windowStatus: 'window:status',
  windowSetOpacity: 'window:setOpacity',
  windowOnStatus: 'window:onStatus',
  windowNew: 'window:new',

  // Plateau système (tray) → actions rapides
  trayOpenPath: 'tray:openPath',
  trayRunTask: 'tray:runTask',
  trayRunProject: 'tray:runProject',
  trayLoadWorkspace: 'tray:loadWorkspace',

  // Mises à jour automatiques
  updateCheck: 'update:check',
  updateInstall: 'update:install',
  updateGet: 'update:get',
  updateStatus: 'update:onStatus',

  // Journalisation / diagnostic
  logReport: 'log:report',
  logPath: 'log:path'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
