/** Traductions anglaises — domaine « misc ». Clé = chaîne française exacte. */
export const misc: Record<string, string> = {
  // Shelf.tsx
  Étagère: 'Shelf',
  Déplier: 'Expand',
  Replier: 'Collapse',
  "Vider l'étagère": 'Clear the shelf',
  'Déposez des fichiers ici pour les rassembler.': 'Drop files here to gather them.',
  "Retirer de l'étagère": 'Remove from shelf',
  "Copier tout le contenu de l'étagère dans le dossier affiché":
    'Copy everything on the shelf into the displayed folder',
  'Tout coller ici': 'Paste all here',
  "Déplacer tout le contenu de l'étagère dans le dossier affiché (vide l'étagère)":
    'Move everything on the shelf into the displayed folder (empties the shelf)',
  Déplacer: 'Move',
  'Étagère : {n} élément déplacé.': 'Shelf: {n} item moved.',
  'Étagère : {n} éléments déplacés.': 'Shelf: {n} items moved.',
  'Étagère : {n} élément collé.': 'Shelf: {n} item pasted.',
  'Étagère : {n} éléments collés.': 'Shelf: {n} items pasted.',

  // RecycleBin.tsx
  '{verb} : {ok} réussi(s), {errCount} échec(s) — {err0}':
    '{verb}: {ok} succeeded, {errCount} failed — {err0}',
  '{verb} : {n} élément.': '{verb}: {n} item.',
  '{verb} : {n} éléments.': '{verb}: {n} items.',
  Restauration: 'Restore',
  'Supprimer définitivement {n} élément ? Irréversible.':
    'Permanently delete {n} item? This cannot be undone.',
  'Supprimer définitivement {n} éléments ? Irréversible.':
    'Permanently delete {n} items? This cannot be undone.',
  'Suppression définitive': 'Permanent deletion',
  'Vider la corbeille ({n} éléments) ? Irréversible.':
    'Empty the Recycle Bin ({n} items)? This cannot be undone.',
  'Échec : {err}': 'Failed: {err}',
  'Corbeille vidée.': 'Recycle Bin emptied.',
  Corbeille: 'Recycle Bin',
  '{n} élément': '{n} item',
  '{n} éléments': '{n} items',
  Actualiser: 'Refresh',
  'Fermer (Échap)': 'Close (Esc)',
  'Filtrer par nom ou emplacement…': 'Filter by name or location…',
  "Remettre à l'emplacement d'origine": 'Restore to original location',
  Restaurer: 'Restore',
  Supprimer: 'Delete',
  'Vider tout': 'Empty all',
  'Lecture de la corbeille…': 'Reading the Recycle Bin…',
  'La corbeille est vide.': 'The Recycle Bin is empty.',
  'Aucun élément ne correspond.': 'No item matches.',
  Nom: 'Name',
  "Emplacement d'origine": 'Original location',
  Taille: 'Size',
  'Supprimé le': 'Deleted on',
  "{path}\n(double-clic : ouvrir le dossier d'origine)":
    '{path}\n(double-click: open the original folder)',
  "Clic pour sélectionner · Ctrl+clic multiple · Maj+clic plage · double-clic : ouvrir le dossier d'origine":
    'Click to select · Ctrl+click for multiple · Shift+click for range · double-click: open the original folder',

  // PreviewPanel.tsx
  Aperçu: 'Preview',
  "Fermer l'aperçu": 'Close preview',
  'Sélectionnez un fichier pour l’aperçu.': 'Select a file to preview.',
  'Chargement…': 'Loading…',
  'Aperçu partiel (fichier volumineux).': 'Partial preview (large file).',
  Ouvrir: 'Open',
  Révéler: 'Reveal',

  // SearchPanel.tsx
  '{n} résultat': '{n} result',
  '{n} résultats': '{n} results',
  '{n} fichier': '{n} file',
  '{n} fichiers': '{n} files',
  '« {query} » dans {dir}': '"{query}" in {dir}',
  Annuler: 'Cancel',
  'Fermer la recherche': 'Close search',
  'Recherche tronquée au plafond de résultats — affinez la requête.':
    'Search truncated at the result cap — refine your query.',
  'Aucun résultat.': 'No results.',
  'Lancez une recherche depuis la barre d’outils.': 'Start a search from the toolbar.',
  'Ouvrir le dossier : {dir}': 'Open folder: {dir}',
  'Ouvrir le fichier': 'Open file',

  // CustomCommandsDialog.tsx
  Fichiers: 'Files',
  Dossiers: 'Folders',
  'Les deux': 'Both',
  'Chemin complet': 'Full path',
  "Dossier d'exécution": 'Working folder',
  'Nom avec extension': 'Name with extension',
  'Nom sans extension': 'Name without extension',
  'Extension sans point': 'Extension without dot',
  'Ouvrir dans VS Code': 'Open in VS Code',
  'Ouvre le fichier ou le dossier dans VS Code.': 'Opens the file or folder in VS Code.',
  'Historique du fichier': 'File history',
  'Les 10 derniers commits qui touchent ce fichier.': 'The last 10 commits touching this file.',
  'npm install ici': 'npm install here',
  'Installe les dépendances dans le dossier cliqué.':
    'Installs dependencies in the clicked folder.',
  'Convertir en MP4': 'Convert to MP4',
  'Conversion vidéo à côté de l’original (nécessite ffmpeg).':
    'Video conversion next to the original (requires ffmpeg).',
  'Taille du dossier': 'Folder size',
  'Affiche la taille totale du dossier dans le terminal.':
    'Shows the folder’s total size in the terminal.',
  'Commandes personnalisées': 'Custom commands',
  'Comment ça marche ?': 'How does it work?',
  'Définis un': 'Define a',
  nom: 'name',
  ', une': ', a',
  'commande shell': 'shell command',
  'et sa': 'and its',
  cible: 'target',
  '(fichiers, dossiers, ou les deux) ci-dessous.': '(files, folders, or both) below.',
  'Fais un': 'Do a',
  'clic droit': 'right-click',
  'sur un fichier/dossier → sous-menu': 'on a file/folder → submenu',
  '« Commandes ▸ »': '"Commands ▸"',
  '→ ta commande.': '→ your command.',
  "Elle s'exécute dans le": 'It runs in the',
  'terminal intégré': 'integrated terminal',
  ", dans le dossier de l'élément (le parent pour un fichier, le dossier lui-même sinon), avec les jetons remplacés.":
    ", in the item's folder (the parent for a file, the folder itself otherwise), with tokens substituted.",
  'Jetons disponibles': 'Available tokens',
  'Astuce : entoure les jetons de guillemets —': 'Tip: wrap tokens in quotes —',
  "— pour les chemins contenant des espaces. Les commandes « cmd /c … » s'exécutent automatiquement dans cmd.":
    '— for paths containing spaces. Commands starting with "cmd /c …" run automatically in cmd.',
  'Exemples — un clic pré-remplit le formulaire': 'Examples — click one to prefill the form',
  'Tes commandes': 'Your commands',
  Modifier: 'Edit',
  'Nom (ex. Ouvrir dans VS Code)': 'Name (e.g. Open in VS Code)',
  'Fichiers et dossiers': 'Files and folders',
  'Fichiers seulement': 'Files only',
  'Dossiers seulement': 'Folders only',
  'Commande — ex. code "{path}"': 'Command — e.g. code "{path}"',
  'Jetons :': 'Tokens:',
  '— détails via': '— details via',
  "Annuler l'édition": 'Cancel editing',
  Enregistrer: 'Save',
  Ajouter: 'Add',

  // format.ts
  hier: 'yesterday',
  o: 'B',
  Ko: 'KB',
  Mo: 'MB',
  Go: 'GB',
  To: 'TB',
  // Rangement auto des téléchargements
  '« {name} » rangé → {dir}': '"{name}" tidied → {dir}',
  'Rangement auto des téléchargements': 'Auto-tidy downloads',
  'Range automatiquement les fichiers téléchargés selon vos règles — jamais un téléchargement en cours, chaque déplacement est annulable (Ctrl+Z). Aussi activable depuis le menu de l’icône près de l’horloge.':
    'Automatically tidies downloaded files according to your rules — never a download in progress, and every move can be undone (Ctrl+Z). Also toggleable from the tray icon menu.',
  'Dossier surveillé — vide = Téléchargements': 'Watched folder — empty = Downloads',
  'Règle active': 'Rule enabled',
  'pdf, zip — vide = tous': 'pdf, zip — empty = all',
  'Supprimer cette règle': 'Delete this rule',
  'Destination — ex. D:\\Documents\\Factures': 'Destination — e.g. D:\\Documents\\Invoices',
  'Sous-dossier (facultatif) — gabarits {date}, {ext}': 'Subfolder (optional) — templates {date}, {ext}',
  'Ajouter une règle': 'Add a rule',
  'Première règle qui correspond gagne (de haut en bas). Exemple : extensions « pdf », destination D:\\Docs, sous-dossier {date} → D:\\Docs\\2026-08\\facture.pdf.':
    'The first matching rule wins (top to bottom). Example: extensions "pdf", destination D:\\Docs, subfolder {date} → D:\\Docs\\2026-08\\invoice.pdf.'
}
