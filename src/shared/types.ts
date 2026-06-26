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

/** Résultat d'une sonde de chemin : dossier, fichier, ou inexistant. */
export type PathKind = 'directory' | 'file' | 'missing'

/** Résultat d'une opération copier/déplacer : nombre traité + erreurs. */
export interface FileOpResult {
  ok: number
  errors: string[]
}

/** Résultat d'une création/renommage : chemin produit, ou erreur. */
export interface CreateResult {
  ok: boolean
  path?: string
  error?: string
}

/** Applications externes détectées (chemin de l'exécutable si présent). */
export interface DetectedApps {
  vscode?: string
  notepadpp?: string
  sevenzip?: string
}

export type ExternalAppId = 'vscode' | 'notepadpp'

// --- Aperçu de fichier (phase 6) ---

export type PreviewKind = 'text' | 'code' | 'markdown' | 'json' | 'image' | 'binary'

export interface PreviewData {
  kind: PreviewKind
  name: string
  path: string
  size: number
  modifiedMs: number
  /** Contenu texte (text/code/markdown/json) ou data URL (image). */
  content?: string
  /** Langage/extension deviné (info d'affichage). */
  lang?: string
  /** Message explicatif (binaire, trop volumineux…). */
  note?: string
  /** Contenu tronqué (fichier texte trop gros) ? */
  truncated?: boolean
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
  desktop: string
  downloads: string
  documents: string
  drives: DriveInfo[]
}

/** Commande de navigation émise par l'OS (boutons souris précédent/suivant). */
export type NavCommand = 'back' | 'forward'

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
  /** Curseur clignotant après « ~/gvue » dans la barre de titre. */
  titleCursor: boolean
  presets: Record<string, Partial<Appearance>>
}

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

// --- Lanceur de tâches (phase 6) ---

/** Un lancement exécutable : une commande shell lancée dans un dossier. */
export interface RunnerTask {
  id: string
  name: string
  /** Dossier d'exécution (cwd). */
  cwd: string
  /** Commande shell (ex. « npm run dev », « python app.py »). */
  command: string
  /** Racine du projet auquel ce lancement est rattaché (pour le regroupement). */
  project?: string
  /** Catégorie libre (ex. « front », « outils ») pour le regroupement. */
  category?: string
}

/** Un profil : plusieurs tâches lancées ensemble (front + back…). */
export interface RunnerProfile {
  id: string
  name: string
  taskIds: string[]
}

/** Un volet mémorisé dans un espace de travail. */
export interface WorkspacePane {
  path: string
  quickAccess: boolean
}

/** Espace de travail : disposition des volets + état des panneaux + config. */
export interface WorkspaceData {
  panes: WorkspacePane[]
  activeIndex: number
  terminalOpen: boolean
  previewOpen: boolean
  appearanceOpen: boolean
  // --- Champs additionnels (optionnels, pour rétrocompatibilité) ---
  /** Thème/couleur d'accent et autres réglages visuels. */
  appearance?: Partial<Appearance>
  /** Option « Suivre le dossier ouvert » de l'arbre. */
  treeExpand?: boolean
  /** Ordre des sections de la sidebar. */
  sidebarOrder?: string[]
  /** Sections de la sidebar repliées. */
  sidebarCollapsed?: Record<string, boolean>
  /** Terminaux affichés côte à côte (sinon onglets). */
  terminalSplit?: boolean
  /** Shells des terminaux ouverts (un par onglet), pour les rouvrir. */
  terminals?: string[]
}

export interface AppConfig {
  appearance: Appearance
  window: WindowState
  favorites: string[]
  shortcuts: { label: string; path: string; icon?: string }[]
  recents: string[]
  /** Fichiers récemment ouverts (les plus récents en tête). */
  recentFiles: string[]
  /** Nombre de visites par dossier, pour les « dossiers fréquents ». */
  folderFreq: Record<string, number>
  /** Racines des dépôts Git visités (les plus récents en tête). */
  projectRoots: string[]
  /** Programmes mémorisés par extension pour « Ouvrir avec » (ext → exes). */
  openWith: Record<string, string[]>
  /** Espaces de travail nommés. */
  workspaces: Record<string, WorkspaceData>
  /** Lancements et profils du lanceur. */
  runnerTasks: RunnerTask[]
  runnerProfiles: RunnerProfile[]
  /** Commande lancée par le bouton ▶ de chaque projet (racine → commande). */
  projectLaunch: Record<string, string>
  /** Ordre des sections de la sidebar (clés : thispc, drives, favorites, projects). */
  sidebarOrder: string[]
  /** Sections de la sidebar repliées (clé → replié). */
  sidebarCollapsed: Record<string, boolean>
  /** Développer l'arbre des dossiers jusqu'au dossier ouvert. */
  treeExpandToCurrent: boolean
  /** Identifiant du shell par défaut (vide = premier détecté). */
  defaultShell: string
  hideGitIgnored: boolean
}

/** État du système de mise à jour automatique (electron-updater). */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'none'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
  | { state: 'unsupported' }

/** Données de la page « Accès rapide » (dossiers fréquents + fichiers récents). */
export interface QuickAccessData {
  frequent: DirEntry[]
  recentFiles: DirEntry[]
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

// --- Git (phase 4) ---

export type GitCategory =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'untracked'
  | 'renamed'
  | 'conflict'
  | 'ignored'

export interface GitFileChange {
  /** Chemin absolu du fichier (séparateurs « / »). */
  path: string
  category: GitCategory
  /** Le changement est présent dans l'index (staged). */
  staged: boolean
}

/** Un dépôt Git connu, pour la section Projets de la sidebar. */
export interface GitProject {
  /** Racine du dépôt (séparateurs « / »). */
  root: string
  /** Nom affiché (basename de la racine). */
  name: string
  branch: string
  /** Le dépôt a-t-il des modifications suivies non validées ? */
  dirty: boolean
}

/** Résultat d'une action Git (commit/pull/push) : succès + sortie de git. */
export interface GitActionResult {
  ok: boolean
  /** Sortie combinée stdout+stderr de git (message d'erreur si échec). */
  output: string
}

export interface GitStatus {
  /** Le dossier interrogé est-il dans un dépôt Git ? */
  isRepo: boolean
  /** Racine du dépôt (séparateurs « / »), ou « » hors dépôt. */
  root: string
  branch: string
  /** Commits d'avance / de retard sur la branche amont. */
  ahead: number
  behind: number
  files: GitFileChange[]
}

export type WindowAction = 'minimize' | 'maximize-toggle' | 'close'

export interface WindowStatus {
  maximized: boolean
}

// --- Recherche (phase 3) ---

export interface SearchOptions {
  /** Motif recherché (littéral ou expression régulière selon `regex`). */
  query: string
  /** Dossier racine de la recherche (chemin absolu). */
  dir: string
  caseSensitive: boolean
  /** Borne les correspondances aux mots entiers. */
  wholeWord: boolean
  /** Interprète `query` comme une regex (sinon recherche littérale). */
  regex: boolean
  /** Inclut les fichiers ignorés par `.gitignore` et les fichiers cachés. */
  includeIgnored: boolean
  /** Plafond de correspondances — garde-fou anti-flot. */
  maxResults: number
}

/** Plage de caractères d'une sous-correspondance dans la ligne (surlignage). */
export interface SearchSubmatch {
  start: number
  end: number
}

export interface SearchMatch {
  /** Chemin absolu du fichier. */
  file: string
  /** Numéro de ligne (1-based). */
  line: number
  /** Texte de la ligne (saut final retiré, éventuellement tronqué). */
  text: string
  /** Plages à surligner dans `text` (indices de caractères). */
  submatches: SearchSubmatch[]
}

export interface SearchDone {
  /** Nombre total de correspondances émises. */
  matchCount: number
  /** Nombre de fichiers comportant au moins une correspondance. */
  fileCount: number
  /** Vrai si la recherche a été coupée au plafond `maxResults`. */
  hitLimit: boolean
  /** Vrai si annulée par l'utilisateur. */
  canceled: boolean
  /** Message d'erreur (rg absent, regex invalide…), sinon null. */
  error: string | null
}

export interface SearchResultEvent {
  searchId: string
  matches: SearchMatch[]
}

export interface SearchDoneEvent {
  searchId: string
  done: SearchDone
}
