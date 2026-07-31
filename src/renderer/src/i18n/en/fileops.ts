/** Traductions anglaises — domaine « fileops » (dialogues fichiers). Clé = chaîne française exacte. */
export const fileops: Record<string, string> = {
  // fileActions.ts
  '{verb} annulé(e).': '{verb} cancelled.',
  '{verb} : {ok} réussi(s), {errCount} échec(s) — {first}': '{verb}: {ok} succeeded, {errCount} failed — {first}',
  'Échec {verb} : {first}': '{verb} failed: {first}',
  'Déplacement': 'Move',
  'Copie': 'Copy',
  'Rien à coller.': 'Nothing to paste.',
  'Annulé : {label}': 'Undone: {label}',
  'dernière opération': 'last operation',
  'Rien à annuler.': 'Nothing to undo.',

  // ConflictDialog.tsx
  '{n} élément existe déjà dans la destination': '{n} item already exists in the destination',
  '{n} éléments existent déjà dans la destination': '{n} items already exist in the destination',
  '… +{count} autres': '… +{count} more',
  '« Remplacer » envoie les éléments existants à la corbeille (récupérable).':
    '"Replace" sends the existing items to the Recycle Bin (recoverable).',
  'Annuler': 'Cancel',
  'Ignorer les conflits': 'Skip conflicts',
  'Garder les deux': 'Keep both',
  'Remplacer': 'Replace',
  'Remplacer tout': 'Replace all',
  'dossier · {date}': 'folder · {date}',
  '{size} · {date}': '{size} · {date}',
  'source plus récente': 'source newer',
  'source : {detail}': 'source: {detail}',
  'existant : {detail}': 'existing: {detail}',

  // CopyProgress.tsx
  'Copie en cours — {name}': 'Copying — {name}',
  'Annuler la copie': 'Cancel the copy',

  // FolderCreator.tsx
  '{created} créé(s), {errCount} erreur(s) : {first}': '{created} created, {errCount} error(s): {first}',
  'Créer des dossiers dans {dir}': 'Create folders in {dir}',
  'Motif du nom': 'Name pattern',
  'ex. Projet-{n} ou {date}_{name}': 'e.g. Project-{n} or {date}_{name}',
  'Jetons :': 'Tokens:',
  'numéro': 'number',
  'liste': 'list',
  'index': 'index',
  'Nombre': 'Count',
  'Début': 'Start',
  'Chiffres': 'Digits',
  'Date': 'Date',
  'Liste de noms (un par ligne) → remplit {name}, fixe le nombre':
    'List of names (one per line) → fills {name}, sets the count',
  'Sous-dossiers, répliqués dans chaque dossier (un par ligne)':
    'Subfolders, replicated inside each folder (one per line)',
  'Aperçu — {top} dossier(s), {total} chemin(s)': 'Preview — {top} folder(s), {total} path(s)',
  'Rien à créer.': 'Nothing to create.',
  '… +{count}': '… +{count}',
  'Créer ({count})': 'Create ({count})',

  // BulkRenameDialog.tsx
  'Renommer en masse — {count} éléments': 'Bulk rename — {count} items',
  'Rechercher': 'Find',
  'texte ou regex': 'text or regex',
  'Remplacer par': 'Replace with',
  '(vide = supprimer)': '(empty = remove)',
  'Expression régulière': 'Regular expression',
  'Ignorer la casse': 'Ignore case',
  'Regex invalide': 'Invalid regex',
  'Préfixe': 'Prefix',
  "Suffixe (avant l'extension)": 'Suffix (before the extension)',
  'Numéroter': 'Number',
  'début': 'start',
  'chiffres': 'digits',
  'séparateur': 'separator',
  'à la fin': 'at the end',
  'au début': 'at the start',
  '(vide)': '(empty)',
  '⚠ doublon': '⚠ duplicate',
  'Des noms sont vides.': 'Some names are empty.',
  'Des noms sont en doublon.': 'Some names are duplicated.',
  '{count} à renommer': '{count} to rename',
  'Renommer': 'Rename',

  // ArchiveViewer.tsx
  'Lecture impossible.': 'Unable to read.',
  '{n} entrée · {size} décompressé': '{n} entry · {size} uncompressed',
  '{n} entrées · {size} décompressé': '{n} entries · {size} uncompressed',
  'Extraction lancée à côté de l’archive.': 'Extraction started next to the archive.',
  'Extraction impossible : {error}': 'Extraction failed: {error}',
  'Filtrer les entrées…': 'Filter entries…',
  "Lecture de l'archive…": 'Reading the archive…',
  "Lecture seule — l'extraction crée un dossier au nom libre à côté de l'archive.":
    'Read-only — extraction creates a freely-named folder next to the archive.',
  'Extraire tout': 'Extract all',

  // FilePickerDialog.tsx
  'Dossier parent': 'Parent folder',
  'Dossier vide': 'Empty folder',
  'Choisir {name}': 'Choose {name}',
  'Cliquez un fichier pour le choisir.': 'Click a file to choose it.',

  // DiskUsage.tsx
  'o': 'B',
  'Ko': 'KB',
  'Mo': 'MB',
  'Go': 'GB',
  'To': 'TB',
  'Espace disque': 'Disk usage',
  'Fermer': 'Close',
  'Calcul des tailles…': 'Calculating sizes…',
  'Ouvrir dans GVue': 'Open in GVue',

  // ComparePanes.tsx
  'type différent (fichier / dossier)': 'different type (file / folder)',
  'taille différente': 'different size',
  'date différente': 'different date',
  'Comparer les volets': 'Compare panes',
  '{a} ⟷ {b} · {identical}': '{a} ⟷ {b} · {identical}',
  '{n} identique': '{n} identical',
  '{n} identiques': '{n} identical',
  'Actualiser les deux volets': 'Refresh both panes',
  'Il faut deux volets ouverts sur des dossiers pour comparer.':
    'You need two panes open on folders to compare.',
  "(Bouton « Diviser » de la barre d'outils, puis naviguer chaque volet.)":
    '(Toolbar "Split" button, then navigate each pane.)',
  'Uniquement dans {dir}': 'Only in {dir}',
  'Présents des deux côtés mais différents': 'Present on both sides but different',
  'Rien.': 'Nothing.',
  'dossier': 'folder',
  'Comparaison superficielle du niveau courant (les sous-dossiers ne sont pas parcourus ; deux dossiers de même nom sont considérés identiques).':
    'Shallow comparison of the current level (subfolders are not scanned; two folders with the same name are considered identical).',

  // FileFinder.tsx
  'Aller à un fichier dans {dir}…': 'Go to a file in {dir}…',
  'Indexation…': 'Indexing…',
  'Aucun fichier': 'No files'
}
