/**
 * Dictionnaire anglais du processus principal (tray, dialogues,
 * notifications, intégration Explorateur). Clé = chaîne française exacte.
 */
export const EN: Record<string, string> = {
  // tray.ts
  '(vide)': '(empty)',
  'Ouvrir le dossier': 'Open folder',
  'Démarrer': 'Start',
  'Démarrer dans GVue': 'Start in GVue',
  'Terminal SSH': 'SSH terminal',
  'Fichiers (SFTP)': 'Files (SFTP)',
  'Ouvrir GVue': 'Open GVue',
  'Accès rapide': 'Quick access',
  'Projets': 'Projects',
  'SSH / SFTP': 'SSH / SFTP',
  'Lancements': 'Launches',
  'Profil : {name}': 'Profile: {name}',
  'Espaces de travail': 'Workspaces',
  'Vérifier les mises à jour': 'Check for updates',
  'Version {v}': 'Version {v}',
  'Quitter GVue': 'Quit GVue',

  // index.ts
  'GVue — erreur inattendue': 'GVue — unexpected error',
  "Une erreur est survenue mais l'application reste ouverte.\n\n{error}\n\nDétails : {log}":
    'An error occurred but the application remains open.\n\n{error}\n\nDetails: {log}',

  // services/updater.ts
  'Aucune release exploitable trouvée sur GitHub (latest.yml manquant ou release absente).':
    'No usable release found on GitHub (missing latest.yml or no release).',

  // services/shell-integration.ts
  'Ouvrir dans GVue': 'Open in GVue',

  // services/fileops.ts
  'Nom invalide.': 'Invalid name.',
  'Un élément porte déjà ce nom.': 'An item with this name already exists.',
  '« {name} » ne peut pas être placé dans lui-même.': '"{name}" cannot be placed inside itself.',
  'échec': 'failed',

  // services/git.ts
  'Échec': 'Failed',
  'Message de commit vide.': 'Empty commit message.',
  'Nom de branche vide.': 'Empty branch name.',
  'HEAD (détaché)': 'HEAD (detached)',
  'Déjà dans .gitignore.': 'Already in .gitignore.',
  'Ajouté à .gitignore : {list}': 'Added to .gitignore: {list}',

  // services/recycle-bin.ts
  'Entrée invalide : {id}': 'Invalid entry: {id}',
  'métadonnées illisibles': 'unreadable metadata',
  'Windows uniquement.': 'Windows only.',

  // services/sftp-manager.ts
  'Le mot de passe enregistré a été refusé (il a été oublié).':
    'The saved password was rejected (it has been forgotten).',
  'Mot de passe refusé, réessayez.': 'Password rejected, try again.',
  '« {file} » est une clé au format PuTTY (.ppk), illisible par OpenSSH/GVue. Convertissez-la : PuTTYgen → Conversions → Export OpenSSH key.':
    '"{file}" is a PuTTY-format key (.ppk), unreadable by OpenSSH/GVue. Convert it: PuTTYgen → Conversions → Export OpenSSH key.',
  'Clé privée introuvable : {file}': 'Private key not found: {file}',
  "L'EMPREINTE DE {target} A CHANGÉ ({fp}). Connexion refusée. Si le serveur a vraiment été réinstallé, retirez l'ancienne empreinte des paramètres GVue.":
    "THE FINGERPRINT OF {target} HAS CHANGED ({fp}). Connection refused. If the server was genuinely reinstalled, remove the old fingerprint from GVue's settings.",
  'Session SFTP fermée — reconnectez-vous.': 'SFTP session closed — please reconnect.',
  '{name} — ré-téléversé ✓': '{name} — re-uploaded ✓',

  // services/search.ts
  'Le binaire « ripgrep » est introuvable. Installez la dépendance avec « npm install @vscode/ripgrep » pour activer la recherche.':
    'The "ripgrep" binary could not be found. Install the dependency with "npm install @vscode/ripgrep" to enable search.',
  'Motif de recherche vide.': 'Empty search pattern.',

  // services/preview.ts
  'Image trop volumineuse pour l’aperçu.': 'Image too large to preview.',
  'Fichier binaire — aperçu indisponible.': 'Binary file — preview unavailable.',

  // services/apps.ts
  '7-Zip introuvable.': '7-Zip not found.',
  'Aucun élément.': 'No items.',

  // services/undo-stack.ts
  'Rien à annuler.': 'Nothing to undo.',

  // ipc/fs.ts
  'Échec de création du raccourci.': 'Failed to create shortcut.',
  'Création de {n} dossier(s)': 'Creating {n} folder(s)',
  'Copie de {n} élément(s)': 'Copying {n} item(s)',
  'Déplacement de {n} élément(s)': 'Moving {n} item(s)',
  'Renommage de « {name} »': 'Renaming "{name}"',
  'Renommage de {n} élément(s)': 'Renaming {n} item(s)',
  // services/tidy.ts + tray
  'Rangement de « {name} »': 'Tidying of "{name}"',
  'Rangement auto des téléchargements': 'Auto-tidy downloads'
}
