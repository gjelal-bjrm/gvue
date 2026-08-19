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
  fsJustRecipes: 'fs:justRecipes',

  // Intégration à l'Explorateur Windows (« Ouvrir dans GVue »)
  /** Ce que la ligne de commande demandait au démarrage (espace, dossier). */
  cliPending: 'cli:pending',
  integrationGet: 'integration:get',
  integrationSet: 'integration:set',

  // SSH (section Serveurs)
  sshConfigHosts: 'ssh:configHosts',
  sshAvailable: 'ssh:available',
  sshImportSources: 'ssh:importSources',

  // SFTP (explorateur distant)
  sftpConnect: 'sftp:connect',
  sftpDisconnect: 'sftp:disconnect',
  sftpList: 'sftp:list',
  sftpMkdir: 'sftp:mkdir',
  sftpRename: 'sftp:rename',
  sftpDelete: 'sftp:delete',
  sftpDownload: 'sftp:download',
  sftpUpload: 'sftp:upload',
  sftpEdit: 'sftp:edit',
  sftpOnProgress: 'sftp:onProgress',
  sftpHasPassword: 'sftp:hasPassword',
  sftpForgetPassword: 'sftp:forgetPassword',
  sftpSavePassword: 'sftp:savePassword',
  sftpSecretsAvailable: 'sftp:secretsAvailable',

  // Corbeille Windows (lecture, restauration, suppression définitive)
  binList: 'bin:list',
  binRestore: 'bin:restore',
  binDelete: 'bin:delete',
  binEmpty: 'bin:empty',
  fsIcon: 'fs:icon',
  fsCopy: 'fs:copy',
  fsMove: 'fs:move',
  fsRename: 'fs:rename',
  fsRenameMany: 'fs:renameMany',
  fsUndo: 'fs:undo',
  fsUndoPeek: 'fs:undoPeek',
  fsCancelCopy: 'fs:cancelCopy',
  fsOnCopyProgress: 'fs:onCopyProgress',
  fsConflicts: 'fs:conflicts',
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
  appsPickFolder: 'apps:pickFolder',
  appsArchive: 'apps:archive',
  appsExtract: 'apps:extract',
  appsOpenAsDialog: 'apps:openAsDialog',
  appsProperties: 'apps:properties',

  // Archives (lecture sans extraction)
  archiveList: 'archive:list',
  archiveExtract: 'archive:extract',

  // Presse-papiers système (interop fichiers avec l'Explorateur Windows)
  clipReadFiles: 'clip:readFiles',
  clipWriteFiles: 'clip:writeFiles',
  clipClear: 'clip:clear',

  // Git
  gitStatus: 'git:status',
  gitCommit: 'git:commit',
  gitPull: 'git:pull',
  gitPush: 'git:push',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitDiscard: 'git:discard',
  gitProjects: 'git:projects',
  gitHideProject: 'git:hideProject',
  gitUnhideProjects: 'git:unhideProjects',
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
  gitFileLog: 'git:fileLog',
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
  openExternal: 'app:openExternal',

  // Rangement auto des téléchargements : un fichier vient d'être rangé.
  tidyMoved: 'tidy:moved',
  // La config du rangement a changé (toute origine, tray compris) → recharger.
  tidyChanged: 'tidy:changed',
  // Dossier « Mes scripts » : lister, ouvrir ; erreurs d'exécution (toast).
  tidyScriptsList: 'tidy:scriptsList',
  tidyScriptsOpen: 'tidy:scriptsOpen',
  tidyScriptError: 'tidy:scriptError',

  // Plateau système (tray) → actions rapides
  trayOpenPath: 'tray:openPath',
  trayRunTask: 'tray:runTask',
  trayOpenSsh: 'tray:openSsh',
  trayBrowseSsh: 'tray:browseSsh',
  trayRunProject: 'tray:runProject',
  trayLoadWorkspace: 'tray:loadWorkspace',

  // Mises à jour automatiques
  updateCheck: 'update:check',
  updateInstall: 'update:install',
  updateGet: 'update:get',
  updateStatus: 'update:onStatus',

  // Menu contextuel natif (popup OS : peut déborder de la fenêtre)
  menuPopup: 'menu:popup',

  // Serveur MCP (agents IA) : contexte poussé par le renderer + bascule
  mcpContext: 'mcp:context',
  mcpToggle: 'mcp:toggle',
  mcpStatus: 'mcp:status',
  // Actions demandées par un agent (main → renderer)
  mcpOpenTerminal: 'mcp:openTerminal',
  mcpReveal: 'mcp:reveal',
  mcpNotify: 'mcp:notify',
  /** Ouvrir/fermer un panneau ou un dialogue (captures dirigées, démos). */
  mcpSetUi: 'mcp:setUi',
  /** Changer le thème appliqué. */
  mcpSetTheme: 'mcp:setTheme',

  // Mode sélecteur (--pick) : un autre outil G (GRay…) lance GVue pour
  // choisir un fichier ; GVue écrit le choix puis se ferme.
  pickMode: 'pick:mode',
  pickConfirm: 'pick:confirm',

  // Journalisation / diagnostic
  logReport: 'log:report',
  logPath: 'log:path'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
