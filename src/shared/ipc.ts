// Noms de canaux IPC, centralisés pour éviter les chaînes magiques dispersées.
// Convention : « domaine:action ». Les flux continus utilisent le suffixe « :on… ».

export const IPC = {
  // Système de fichiers
  fsList: 'fs:list',
  fsLocations: 'fs:locations',
  fsReveal: 'fs:reveal',
  fsOpen: 'fs:open',
  fsOnChange: 'fs:onChange',

  // Terminal
  terminalShells: 'terminal:shells',
  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  terminalOnData: 'terminal:onData',
  terminalOnExit: 'terminal:onExit',

  // Configuration
  configGet: 'config:get',
  configSet: 'config:set',
  configAll: 'config:all',

  // Fenêtre
  windowAction: 'window:action',
  windowStatus: 'window:status',
  windowOnStatus: 'window:onStatus'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
