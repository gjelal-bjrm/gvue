/** Traductions anglaises — domaine « filelist ». Clé = chaîne française exacte. */
export const filelist: Record<string, string> = {
  // FileList.tsx
  'Corbeille : {n} échec — {list}': 'Trash: {n} failure — {list}',
  'Corbeille : {n} échecs — {list}': 'Trash: {n} failures — {list}',
  'Filtrer ce dossier…': 'Filter this folder…',
  'Fermer le filtre (Échap)': 'Close filter (Esc)',
  'Chargement…': 'Loading…',
  'Dossier vide': 'Empty folder',

  // ColumnHeader.tsx
  Nom: 'Name',
  Type: 'Type',
  Taille: 'Size',
  Modifié: 'Modified',

  // Row.tsx
  '(indexé)': '(staged)',
  masqué: 'hidden',

  // StatusBar.tsx
  '{n} élément': '{n} item',
  '{n} éléments': '{n} items',
  '{n} masqué': '{n} hidden',
  '{n} masqués': '{n} hidden',
  '{n} sélectionné': '{n} selected',
  '{n} sélectionnés': '{n} selected',
  '{n} dossier': '{n} folder',
  '{n} dossiers': '{n} folders',

  // menus.tsx — buildDropMenu
  'Copier ici': 'Copy here',
  'Copier ici ({n})': 'Copy here ({n})',
  'Déplacer ici': 'Move here',
  'Déplacer ici ({n})': 'Move here ({n})',
  'Créer un raccourci ici': 'Create shortcut here',
  'Créer {n} raccourcis ici': 'Create {n} shortcuts here',
  'Compresser ici (.zip)': 'Compress here (.zip)',
  'Extraire ici': 'Extract here',
  'Extraire ici ({n})': 'Extract here ({n})',
  Annuler: 'Cancel',

  // menus.tsx — buildSelectSubmenu
  'Tout sélectionner': 'Select all',
  'Inverser la sélection': 'Invert selection',
  'Fichiers seulement': 'Files only',
  'Dossiers seulement': 'Folders only',
  "Modifiés aujourd'hui": 'Modified today',
  'Même extension (.{ext})': 'Same extension (.{ext})',
  Sélectionner: 'Select',

  // menus.tsx — buildBackgroundMenu
  'Ouvrir avec VS Code': 'Open with VS Code',
  'Nouveau dossier': 'New folder',
  'Nouveau fichier': 'New file',
  'Créer des dossiers… (en lot)': 'Create folders… (batch)',
  Coller: 'Paste',
  'Retirer des favoris': 'Remove from favorites',
  'Ajouter aux favoris': 'Add to favorites',
  Actualiser: 'Refresh',
  'Ouvrir un terminal ici': 'Open terminal here',
  "Ouvrir dans l'explorateur": 'Open in Explorer',
  'Propriétés du dossier': 'Folder properties',

  // menus.tsx — buildItemMenu
  'VS Code': 'VS Code',
  'Notepad++': 'Notepad++',
  'Choisir un programme…': 'Choose a program…',
  'Applications Windows…': 'Windows Apps…',
  'Ouvrir avec': 'Open with',
  'Compresser en .zip': 'Compress to .zip',
  'Compresser ({n}) en .zip': 'Compress ({n}) to .zip',
  '7-Zip': '7-Zip',
  Commandes: 'Commands',
  Ouvrir: 'Open',
  "Analyser l'espace disque": 'Analyze disk usage',
  "Parcourir l'archive": 'Browse archive',
  'Créer un raccourci': 'Create shortcut',
  'Copier le chemin': 'Copy path',
  'Copier le nom': 'Copy name',
  'Renommer en masse ({n})…': 'Bulk rename ({n})…',
  Renommer: 'Rename',
  Couper: 'Cut',
  'Couper ({n})': 'Cut ({n})',
  Copier: 'Copy',
  'Copier ({n})': 'Copy ({n})',
  'Coller dans le dossier': 'Paste into folder',
  "Mettre sur l'étagère": 'Put on shelf',
  "Mettre sur l'étagère ({n})": 'Put on shelf ({n})',
  'Historique Git': 'Git history',
  Indexer: 'Stage',
  Désindexer: 'Unstage',
  'Annuler les modifications': 'Discard changes',
  'Annuler les modifications de « {name} » ? Action irréversible.':
    'Discard changes to "{name}"? This action cannot be undone.',
  'Supprimer (corbeille)': 'Delete (trash)',
  'Supprimer ({n}) → corbeille': 'Delete ({n}) → trash',
  Propriétés: 'Properties',

  // folderMenu.tsx (clés propres à ce fichier, le reste est partagé ci-dessus)
  "Révéler dans l'explorateur": 'Reveal in Explorer'
}
