// Noms de canaux IPC, centralisés pour éviter les chaînes magiques dispersées.
// Convention : « domaine:action ». Les flux continus utilisent le suffixe « :on… ».

export const IPC = {
  // Système de fichiers
  fsList: 'fs:list',
  fsLocations: 'fs:locations',
  fsReveal: 'fs:reveal',
  fsOpen: 'fs:open',
  fsProbe: 'fs:probe',
  fsTrash: 'fs:trash',
  fsPreview: 'fs:preview',
  fsCopy: 'fs:copy',
  fsMove: 'fs:move',
  fsRename: 'fs:rename',
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

  // Git
  gitStatus: 'git:status',
  gitCommit: 'git:commit',
  gitPull: 'git:pull',
  gitPush: 'git:push',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitDiscard: 'git:discard',
  gitProjects: 'git:projects',

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
  windowOnStatus: 'window:onStatus'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
