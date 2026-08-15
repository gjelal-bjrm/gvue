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
    'The first matching rule wins (top to bottom). Example: extensions "pdf", destination D:\\Docs, subfolder {date} → D:\\Docs\\2026-08\\invoice.pdf.',
  // TidyBanner
  'Rangement auto': 'Auto-tidy',
  'actif · {n} règle': 'active · {n} rule',
  'actif · {n} règles': 'active · {n} rules',
  'actif — aucune règle': 'active — no rules',
  'désactivé': 'disabled',
  'Activer': 'Enable',
  'Désactiver': 'Disable',
  'Règles…': 'Rules…',
  'Modifier les règles de rangement': 'Edit tidy rules',
  // DownloadsItem (sidebar)
  'Rangement auto actif': 'Auto-tidy active',
  'Activer le rangement auto': 'Enable auto-tidy',
  'Désactiver le rangement auto': 'Disable auto-tidy',
  'Règles de rangement…': 'Tidy rules…',
  // TidyRulesDialog
  'Dossier surveillé': 'Watched folder',
  'Vide = dossier Téléchargements': 'Empty = Downloads folder',
  'Règles (la première qui correspond gagne)': 'Rules (the first match wins)',
  'Aucune règle — ajoutez-en une pour que le rangement agisse.':
    'No rules — add one so tidying can act.',
  'Jamais un téléchargement en cours ; chaque déplacement est annulable (Ctrl+Z). Exemple : « pdf » → D:\\Docs, sous-dossier {date} → D:\\Docs\\2026-08\\facture.pdf.':
    'Never a download in progress; every move can be undone (Ctrl+Z). Example: "pdf" → D:\\Docs, subfolder {date} → D:\\Docs\\2026-08\\invoice.pdf.',
  'Ouvrir les règles de rangement…': 'Open tidy rules…',
  // TidyRulesDialog v2 (langage humain + selecteur de dossier)
  'Décochez pour mettre cette règle en pause sans la supprimer':
    'Untick to pause this rule without deleting it',
  '1. Quels fichiers ranger ?': '1. Which files to tidy?',
  'Tous les fichiers': 'All files',
  'Tapez les types séparés par des virgules (ex. pdf, jpg, zip). Laissez vide pour ranger tous les fichiers.':
    'Type the file types separated by commas (e.g. pdf, jpg, zip). Leave empty to tidy all files.',
  // Filtre sur les noms de fichiers
  'Et selon le nom ? (optionnel)': 'And by name? (optional)',
  'expression régulière': 'regular expression',
  'Pour les experts : le motif est lu comme une expression régulière.':
    'For experts: the pattern is read as a regular expression.',
  'ex. facture (contient) ou mn_* (commence par)': 'e.g. invoice (contains) or mn_* (starts with)',
  '« facture » = le nom contient facture. « mn_* » = le nom commence par mn_. * remplace n’importe quoi, ? un seul caractère.':
    '"invoice" = the name contains invoice. "mn_*" = the name starts with mn_. * matches anything, ? a single character.',
  '⚠ Ce motif est invalide : la règle n’attrapera aucun fichier tant qu’il n’est pas corrigé.':
    '⚠ This pattern is invalid: the rule will not catch any file until it is fixed.',
  // Actions de rangement (« Ensuite, que faire du fichier ? »)
  '4. Ensuite, que faire du fichier ?': '4. Then, what to do with the file?',
  'Rien de plus — juste le déplacer': 'Nothing more — just move it',
  '➕ Créer ou modifier les actions…': '➕ Create or edit actions…',
  'Actions de rangement': 'Tidying actions',
  'Une action décrit quoi faire du fichier une fois rangé. Choisissez-la ensuite dans une règle, à l’étape « Ensuite ».':
    'An action describes what to do with the file once tidied. Then pick it in a rule, at the "Then" step.',
  'Aucune action — ajoutez-en une ci-dessous.': 'No actions — add one below.',
  'Nom de l’action': 'Action name',
  'Dupliquer cette action': 'Duplicate this action',
  'Supprimer cette action': 'Delete this action',
  '{label} (copie)': '{label} (copy)',
  'Renommer selon un modèle': 'Rename using a template',
  'Attribuer des noms depuis une liste': 'Assign names from a list',
  'ex. fichier_{n} ou {date} - {nom}': 'e.g. file_{n} or {date} - {nom}',
  '{n} = numéro qui augmente tout seul, {date} = date du jour, {nom} = nom d’origine. L’extension est conservée.':
    '{n} = number that grows on its own, {date} = today’s date, {nom} = original name. The extension is kept.',
  'Aperçu :': 'Preview:',
  'Prochain numéro :': 'Next number:',
  'Un nom par ligne — le premier sert au prochain fichier rangé.':
    'One name per line — the first one is used for the next tidied file.',
  'Chaque fichier rangé prend le nom du haut de la liste, qui est ensuite retiré. Sans extension, celle du fichier est conservée. Restants : {n}.':
    'Each tidied file takes the name at the top of the list, which is then removed. Without an extension, the file’s own is kept. Remaining: {n}.',
  'Ajouter une action': 'Add an action',
  'Nouvelle action': 'New action',
  'Renommer en fichier_1, fichier_2…': 'Rename to file_1, file_2…',
  'Mettre la date devant le nom': 'Put the date in front of the name',
  '« {name} » rangé → {dir} — la liste de noms est épuisée, le fichier garde son nom.':
    '"{name}" tidied → {dir} — the name list is empty, the file keeps its name.',
  '2. Dans quel dossier les mettre ?': '2. Which folder to put them in?',
  'Choisissez un dossier avec « Parcourir »': 'Pick a folder with "Browse"',
  'Choisir le dossier de destination': 'Choose the destination folder',
  'Parcourir…': 'Browse…',
  '3. Créer un sous-dossier dedans ?': '3. Create a subfolder inside?',
  'Non — directement dans le dossier': 'No — straight into the folder',
  'Oui — un dossier par mois (ex. {sample})': 'Yes — one folder per month (e.g. {sample})',
  'Oui — un dossier par type de fichier (ex. {ext})': 'Yes — one folder per file type (e.g. {ext})',
  'Oui — par mois, puis par type': 'Yes — by month, then by type',
  'Personnalisé : {tpl}': 'Custom: {tpl}',
  'Aperçu : « exemple.{ext} » ira dans': 'Preview: "example.{ext}" will go to',
  'GVue attend qu’un téléchargement soit terminé avant de ranger le fichier, et Ctrl+Z annule le dernier rangement.':
    'GVue waits until a download has finished before tidying the file, and Ctrl+Z undoes the last move.',
  'Naviguez jusqu’au dossier voulu, puis validez.': 'Navigate to the folder you want, then confirm.',
  'Choisir ce dossier': 'Choose this folder',
  '⚠ Cette règle ne fait rien encore : choisissez le dossier de destination (étape 2, bouton « Parcourir… »).':
    '⚠ This rule does nothing yet: choose the destination folder (step 2, "Browse…" button).',
  'actif — règle incomplète, cliquez ici': 'active — incomplete rule, click here',
  'actif — aucune règle, cliquez ici': 'active — no rules, click here',
  'Rangement auto activé mais sans règle complète — ouvrez les règles':
    'Auto-tidy enabled but no complete rule — open the rules'
}
