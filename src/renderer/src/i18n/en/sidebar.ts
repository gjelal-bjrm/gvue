/** Traductions anglaises — domaine « sidebar ». Clé = chaîne française exacte. */
export const sidebar: Record<string, string> = {
  // Sidebar.tsx — sections
  'Ce PC': 'This PC',
  Accueil: 'Home',
  Bureau: 'Desktop',
  Téléchargements: 'Downloads',
  Documents: 'Documents',
  Corbeille: 'Recycle bin',
  Lecteurs: 'Drives',
  Favoris: 'Favorites',
  'Aucun favori — clic droit sur un dossier → « Ajouter aux favoris ».':
    'No favorites yet — right-click a folder → “Add to favorites”.',
  Projets: 'Projects',
  'Visitez un dépôt Git pour le voir ici.': 'Visit a Git repository to see it here.',
  'Réafficher les projets retirés de la liste': 'Show projects removed from the list again',
  '{n} projet masqué — tout réafficher': '{n} project hidden — show all again',
  '{n} projets masqués — tout réafficher': '{n} projects hidden — show all again',
  'SSH / SFTP': 'SSH / SFTP',
  'OpenSSH introuvable — activez « Client OpenSSH » dans les fonctionnalités facultatives de Windows.':
    'OpenSSH not found — enable “OpenSSH Client” in Windows optional features.',
  'Les hôtes de ~/.ssh/config apparaissent ici automatiquement.':
    'Hosts from ~/.ssh/config appear here automatically.',
  'Import à la demande : « ⇪ Importer » liste aussi votre ~/.ssh/config.':
    'On-demand import: “⇪ Import” also lists your ~/.ssh/config.',
  '+ Ajouter un serveur…': '+ Add a server…',
  'Récupérer les sessions PuTTY, WinSCP ou ~/.ssh/config':
    'Retrieve PuTTY, WinSCP, or ~/.ssh/config sessions',
  '⇪ Importer (PuTTY / WinSCP / ssh_config)…': '⇪ Import (PuTTY / WinSCP / ssh_config)…',
  'Exporter la liste au format ssh_config standard (OpenSSH, VS Code Remote-SSH…)':
    'Export the list in standard ssh_config format (OpenSSH, VS Code Remote-SSH…)',
  '⤓ Exporter (format ssh_config)': '⤓ Export (ssh_config format)',
  'Retirer tous les serveurs de la liste (ré-importables ensuite)':
    'Remove all servers from the list (can be re-imported later)',
  '✕ Tout retirer…': '✕ Remove all…',
  'Retirer les {n} serveurs de la liste ? (ré-importables ensuite)':
    'Remove the {n} servers from the list? (can be re-imported later)',
  Lanceur: 'Launcher',
  Lancements: 'Launches',
  'Changer le regroupement (projet / catégorie)': 'Change grouping (project / category)',
  Projet: 'Project',
  'Cat.': 'Cat.',
  'Sans projet': 'No project',
  'Sans catégorie': 'No category',
  'Accès rapide': 'Quick access',

  // FolderTree.tsx
  "Développer l'arbre jusqu'au dossier ouvert": 'Expand the tree to the open folder',
  'Suivre le dossier ouvert': 'Follow the open folder',
  activé: 'on',
  désactivé: 'off',

  // QuickAccessPanel.tsx
  Ouvrir: 'Open',
  "Ouvrir dans l'explorateur": 'Open in File Explorer',
  'Ouvrir avec VS Code': 'Open with VS Code',
  'Éditer avec Notepad++': 'Edit with Notepad++',
  'Ouvrir avec {name}': 'Open with {name}',
  'Ouvrir avec…': 'Open with…',
  'Compresser en .zip (7-Zip)': 'Compress to .zip (7-Zip)',
  'Copier le chemin': 'Copy path',
  'Copier le nom': 'Copy name',
  'Retirer des favoris': 'Remove from favorites',
  'Ajouter aux favoris': 'Add to favorites',
  'Supprimer (corbeille)': 'Delete (recycle bin)',
  'Naviguez dans des dossiers et ouvrez des fichiers pour peupler l’accès rapide.':
    'Browse folders and open files to populate quick access.',
  'Dossiers fréquents ({n})': 'Frequent folders ({n})',
  'Fichiers récents ({n})': 'Recent files ({n})',

  // LauncherPanel.tsx
  Profils: 'Profiles',
  '{n} lancement': '{n} launch',
  '{n} lancements': '{n} launches',
  'Supprimer le profil': 'Delete profile',
  'Aucun lancement. Ajoutez-en un ci-dessous.': 'No launches yet. Add one below.',
  'Supprimer le lancement': 'Delete launch',
  'Nouveau lancement': 'New launch',
  'Nom (ex. Front dev)': 'Name (e.g. Front dev)',
  'Dossier (cwd)': 'Folder (cwd)',
  'Commande (ex. npm run dev)': 'Command (e.g. npm run dev)',
  'Choisir un fichier à lancer (.bat, .ps1, .exe…)': 'Choose a file to launch (.bat, .ps1, .exe…)',
  'Fichier…': 'File…',
  'Fichiers :': 'Files:',
  'Projet (aucun)': 'Project (none)',
  Catégorie: 'Category',
  'Scripts détectés :': 'Detected scripts:',
  'Ajouter le lancement': 'Add launch',
  'Nouveau profil': 'New profile',
  'Nom (ex. Projet X — dev)': 'Name (e.g. Project X — dev)',
  'Créer le profil': 'Create profile',
  Arrêter: 'Stop',
  Lancer: 'Run',

  // WorkspaceMenu.tsx
  'Espaces de travail': 'Workspaces',
  'Aucun. Enregistrez votre disposition actuelle ci-dessous.': 'None yet. Save your current layout below.',
  'Charger « {name} »': 'Load “{name}”',
  'Réenregistrer (écraser avec la disposition actuelle)': 'Re-save (overwrite with the current layout)',
  'Supprimer cet espace': 'Delete this workspace',
  "Nom de l'espace…": 'Workspace name…',
  'Enregistrer la disposition actuelle': 'Save the current layout',

  // sidebar/FavoriteItem.tsx, sidebar/ProjectItem.tsx
  'Définir la commande du ▶': 'Set the ▶ command',
  'Définir puis lancer': 'Set then run',
  'Lancer le projet': 'Run project',
  'Retirer de la liste (revient en rouvrant le dossier)':
    'Remove from the list (reappears when reopening the folder)',

  // sidebar/LaunchConfigDialog.tsx
  'Lancement de {name}': 'Launch for {name}',
  "Commande exécutée d'un clic sur ▶, dans le dossier du projet.":
    'Command run on a ▶ click, inside the project folder.',
  'ex. npm run dev': 'e.g. npm run dev',
  'Scripts :': 'Scripts:',
  Effacer: 'Clear',
  Annuler: 'Cancel',
  Enregistrer: 'Save'
}
