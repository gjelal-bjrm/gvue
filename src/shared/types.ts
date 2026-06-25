// Types partagés entre main, preload et renderer.
// Aucune dépendance Node ou Electron ici : ce module doit rester neutre.

export type DirEntryKind = 'file' | 'directory'

export interface DirEntry {
  /** Nom affiché (basename). */
  name: string
  /** Chemin absolu normalisé. */
  path: string
  kind: DirEntryKind
  /** Taille en octets (0 pour les dossiers). */
  size: number
  /** Date de modification en ms epoch. */
  modifiedMs: number
  /** Élément caché (préfixe « . » ou attribut caché Windows). */
  hidden: boolean
  /** Lien symbolique. */
  symlink: boolean
}

export interface ListResult {
  /** Chemin demandé, normalisé et absolu. */
  path: string
  /** Chemin parent, ou null si racine. */
  parent: string | null
  entries: DirEntry[]
}

export interface DriveInfo {
  /** Racine du volume, ex. « C:\\ » ou « / ». */
  path: string
  label: string
}

export interface NavLocations {
  home: string
  drives: DriveInfo[]
}

// --- Configuration persistée (cf. section 8 de la spec) ---

export type ThemeMode = 'light' | 'dark' | 'auto'
export type Density = 'comfortable' | 'compact'
export type Corners = 'rounded' | 'square'

export interface Appearance {
  accent: string
  theme: ThemeMode
  density: Density
  corners: Corners
  fontFamily: string
  fontSize: number
  windowOpacity: number
  presets: Record<string, Partial<Appearance>>
}

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

export interface AppConfig {
  appearance: Appearance
  window: WindowState
  favorites: string[]
  shortcuts: { label: string; path: string; icon?: string }[]
  recents: string[]
  hideGitIgnored: boolean
}

// --- Terminal (phase 2) ---

export interface ShellInfo {
  id: string
  label: string
  path: string
  args: string[]
}

export interface TerminalCreateOptions {
  shellPath: string
  args: string[]
  cwd: string
  cols: number
  rows: number
}

export interface TerminalDataEvent {
  ptyId: string
  data: string
}

export interface TerminalExitEvent {
  ptyId: string
  exitCode: number
}

export type WindowAction = 'minimize' | 'maximize-toggle' | 'close'

export interface WindowStatus {
  maximized: boolean
}
