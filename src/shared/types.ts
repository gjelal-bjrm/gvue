// Types partagés entre main, preload et renderer.
// Aucune dépendance Node ou Electron ici : ce module doit rester neutre.

export type DirEntryKind = 'file' | 'directory'

/** Instantané du contexte GVue poussé au serveur MCP (renderer → main). */
/** Un serveur SSH (section « Serveurs » de la sidebar). */
export interface SshHost {
  /** Alias (ssh_config) ou libellé (hôte manuel). */
  name: string
  /** Provenance : ~/.ssh/config (lecture seule) ou ajout manuel GVue. */
  source: 'config' | 'manual'
  hostName?: string
  user?: string
  port?: number
}

/** Une entrée d'un dossier distant (explorateur SFTP). */
export interface SftpEntry {
  name: string
  /** Chemin distant absolu (séparateur « / »). */
  path: string
  kind: 'file' | 'directory' | 'symlink'
  size: number
  modifiedMs: number
}

/**
 * Résultat d'une tentative de connexion SFTP — machine à états côté renderer :
 * 'fingerprint' → confirmer l'empreinte ; 'password' → saisir le mot de passe ;
 * 'ok' → session prête ; 'error' → échec définitif de cette tentative.
 */
export type SftpConnectResult =
  | { status: 'ok'; home: string }
  | { status: 'fingerprint'; fingerprint: string }
  | { status: 'password'; message?: string }
  | { status: 'error'; message: string }

/** Progression d'un transfert SFTP (événement main → renderer). */
export interface SftpProgress {
  hostKey: string
  /** Fichier en cours (nom seul). */
  file: string
  /** Octets transférés / total du fichier en cours. */
  done: number
  total: number
  /** Index du fichier courant / nombre de fichiers du lot. */
  index: number
  count: number
}

/** Un élément de la corbeille Windows. */
export interface RecycleItem {
  /** Identifiant opaque (chemin du fichier de données $R). */
  id: string
  /** Nom d'origine (basename du chemin supprimé). */
  name: string
  /** Chemin complet d'où l'élément a été supprimé. */
  originalPath: string
  size: number
  deletedAtMs: number
  isDir: boolean
}

/** Une recette d'un `justfile` (autocomplétion « just … » dans le terminal). */
export interface JustRecipe {
  name: string
  /** Paramètres déclarés (ex. « version », « publish_dir="x" »). */
  params: string[]
  /** Commentaire précédant la recette (description façon `just --list`). */
  description: string
}

/** État de l'interface (panneaux, vue, thème) exposé aux agents via MCP. */
export interface McpUiState {
  gitViewOpen: boolean
  previewOpen: boolean
  terminalOpen: boolean
  searchActive: boolean
  settingsOpen: boolean
  viewMode: 'list' | 'grid'
  gridSize: number
  /** Thème effectif : 'auto' | 'light' | 'dark' | id de palette. */
  theme: string
  shelfCount: number
}

export interface McpContext {
  panes: {
    id: string
    group: number
    path: string
    quickAccess: boolean
    active: boolean
    selected: string[]
  }[]
  repo: { root: string; branch: string } | null
  terminals: { ptyId: string; title: string; cwd: string; exited: boolean; paneId?: string }[]
  ui?: McpUiState
}

/** Entrée sérialisable d'un menu contextuel NATIF (Menu.popup côté main). */
export interface NativeMenuItem {
  /** Identifiant renvoyé au renderer quand l'entrée est cliquée. */
  id?: string
  label?: string
  type?: 'normal' | 'separator'
  enabled?: boolean
  submenu?: NativeMenuItem[]
}

/** Rapport d'erreur remonté du renderer vers le journal du processus principal. */
export interface RendererErrorReport {
  /** Origine (ex. « react », « bootstrap »). */
  scope?: string
  message: string
  stack?: string
  componentStack?: string
}

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

/** Entrée aplatie d'arborescence (recherche de fichiers par nom). */
export interface TreeEntry {
  name: string
  path: string
  dir: boolean
}

/** Taille (récursive pour les dossiers) d'un enfant — analyse d'espace disque. */
export interface UsageEntry {
  name: string
  path: string
  dir: boolean
  size: number
}

/** Résultat d'une opération copier/déplacer : nombre traité + erreurs. */
export interface FileOpResult {
  ok: number
  errors: string[]
  /** Couples source→cible réellement effectués (pour l'annulation). */
  ops?: { from: string; to: string }[]
  /** Vrai si l'opération a été interrompue par l'utilisateur. */
  cancelled?: boolean
}

/** Entrée d'une archive (zip, 7z…) listée sans extraction. */
export interface ArchiveEntry {
  /** Chemin dans l'archive (séparateurs « / »). */
  path: string
  /** Taille décompressée (octets). */
  size: number
  dir: boolean
}

/** Résolution d'un conflit de copie/déplacement (appliquée à tout le lot). */
export type ConflictMode = 'rename' | 'overwrite' | 'skip'

/** Conflit détecté avant une copie/déplacement (cible déjà existante). */
export interface ConflictInfo {
  name: string
  sourcePath: string
  targetPath: string
  source: { size: number; modifiedMs: number; dir: boolean }
  target: { size: number; modifiedMs: number; dir: boolean }
}

/** Progression d'une copie longue (octets copiés / total + élément courant). */
export interface CopyProgress {
  done: number
  total: number
  name: string
}

/** Résultat d'une création de dossiers en lot (avec les racines créées). */
export interface MakeDirsResult {
  created: number
  errors: string[]
  /** Racines réellement créées (ancêtre le plus haut), pour l'annulation. */
  paths: string[]
}

/** État de la pile d'annulation, pour l'UI (libellé de la prochaine annulation). */
export interface UndoInfo {
  canUndo: boolean
  label?: string
}

/** Résultat d'une annulation. */
export interface UndoResult {
  ok: boolean
  label?: string
  error?: string
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

export type PreviewKind =
  | 'text'
  | 'code'
  | 'markdown'
  | 'json'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'binary'

/** Contenu fichiers du presse-papiers système (interop Explorateur Windows). */
export interface SysClipboardFiles {
  files: string[]
  /** Vrai si la source a fait « Couper » (Preferred DropEffect = MOVE). */
  move: boolean
}

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

/** Planification jour/nuit du thème (heures locales « HH:MM »). */
export interface ThemeSchedule {
  enabled: boolean
  /** Début de la plage de jour (ex. « 08:00 »). */
  dayFrom: string
  /** Début de la plage de nuit (ex. « 20:00 »). */
  nightFrom: string
  /** Thème de jour : 'light' | 'dark' | id de palette. */
  day: string
  /** Thème de nuit : 'light' | 'dark' | id de palette. */
  night: string
}

/** Thème créé par l'utilisateur (éditeur de thème) : palette complète. */
export interface CustomTheme {
  /** Identifiant unique (« custom-<horodatage> »). */
  id: string
  label: string
  /** Base de résolution, déduite de la luminance du fond. */
  base: 'dark' | 'light'
  /** Variables CSS complètes (clés sans « -- »), dérivées incluses. */
  vars: Record<string, string>
}

export interface Appearance {
  accent: string
  theme: ThemeMode
  /** Palette complète ('' = suit `theme` auto/clair/sombre). */
  themeId: string
  /** Thèmes créés par l'utilisateur (galerie + export/import). */
  customThemes: CustomTheme[]
  /** Bascule automatique jour/nuit (prioritaire sur themeId/theme). */
  themeSchedule: ThemeSchedule
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
  /** Colonne (groupe d'onglets) du volet. Absent (anciens espaces) = une colonne par volet. */
  group?: number
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
  /** Préférences de vue (éléments masqués, ignorés, mode, taille de grille). */
  showHidden?: boolean
  hideGitIgnored?: boolean
  viewMode?: 'list' | 'grid'
  gridSize?: number
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
  /** Projets mis de côté : masqués de la sidebar jusqu'à leur prochaine visite. */
  hiddenProjects: string[]
  /** Serveurs SSH ajoutés à la main (ceux du ~/.ssh/config sont lus, jamais copiés). */
  sshHosts: SshHost[]
  /** Empreintes d'hôtes SSH acceptées (TOFU) : « hôte:port » → empreinte SHA256. */
  sshFingerprints: Record<string, string>
  /** Dernier dossier distant visité par serveur (clé de session). */
  sftpLastDirs: Record<string, string>
  /** Dernier envoi par serveur (redéploiement en un clic). */
  sftpLastDeploy: Record<string, { paths: string[]; remoteDir: string; contents: boolean }>
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
  /** Dernière version dont les « nouveautés » ont été vues (pour la pop-up de MAJ). */
  lastSeenVersion: string
  hideGitIgnored: boolean
  /** Rouvrir les dossiers de la dernière session au démarrage. */
  restoreSession: boolean
  /** Dernière disposition (colonnes/onglets), sauvegardée en continu. */
  lastSession: { panes: WorkspacePane[]; activeIndex: number }
  /** Mode d'affichage de la liste de fichiers. */
  viewMode: 'list' | 'grid'
  /** Largeur d'une tuile en vue grille (px). */
  gridSize: number
  /** Afficher les fichiers/dossiers masqués (dotfiles, système). */
  showHidden: boolean
  /** Terminaux liés à l'onglet de dossier actif (filtrage du panneau). */
  linkTerminals: boolean
  /** Serveur MCP local (agents IA) activé ? */
  mcpEnabled: boolean
  /** Commandes personnalisées du menu contextuel. */
  customCommands: CustomCommand[]
  /** Étagère (panier de fichiers flottant) activée ? */
  shelfEnabled: boolean
  /** Contenu de l'étagère (chemins), persisté entre les sessions. */
  shelfItems: string[]
}

/** Commande personnalisée (menu contextuel), exécutée dans le terminal intégré. */
export interface CustomCommand {
  id: string
  name: string
  /** Jetons : {path} {dir} {name} {stem} {ext}. */
  command: string
  /** Type d'élément sur lequel la proposer. */
  target: 'file' | 'directory' | 'both'
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

/** Branches locales d'un dépôt + branche courante. */
export interface GitBranches {
  current: string
  all: string[]
}

/** Un commit de l'historique (vue « Historique » façon GitHub Desktop). */
export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  /** Date formatée « AAAA-MM-JJ HH:MM ». */
  date: string
  /** Date du commit en secondes Unix (affichage relatif). */
  ts: number
  subject: string
  /** Hash(s) des parents — 2+ pour un commit de fusion (graphe). */
  parents: string[]
  /** Décorations : branches/tags pointant sur ce commit (ex. « main », « tag: v1 », « HEAD -> main »). */
  refs: string[]
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
