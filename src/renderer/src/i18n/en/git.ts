/** Traductions anglaises — domaine « git ». Clé = chaîne française exacte. */
export const git: Record<string, string> = {
  // GitPanel.tsx
  'Indexer{suffix}': 'Stage{suffix}',
  'Désindexer{suffix}': 'Unstage{suffix}',
  'Annuler les modifications{suffix}…': 'Discard changes{suffix}…',
  'Ignorer ce fichier (.gitignore)': 'Ignore this file (.gitignore)',
  'Ignorer ces {n} fichiers (.gitignore)': 'Ignore these {n} files (.gitignore)',
  'Ignorer ces dossiers (.gitignore)': 'Ignore these folders (.gitignore)',
  'Ignorer ce dossier (.gitignore)': 'Ignore this folder (.gitignore)',
  'Ignorer tous les {ext} (.gitignore)': 'Ignore all {ext} (.gitignore)',
  'Ignorer {list}': 'Ignore {list}',
  'Copier le chemin': 'Copy path',
  'Copier le chemin relatif': 'Copy relative path',
  "Révéler dans l'explorateur": 'Reveal in explorer',
  'Ouvrir avec VS Code': 'Open with VS Code',
  'Ouvrir (programme par défaut)': 'Open (default program)',
  "Ce dossier n'est pas un dépôt Git.": 'This folder is not a Git repository.',
  'Fermer la vue Git': 'Close Git view',
  Modifications: 'Changes',
  Historique: 'History',
  '{n} fichier modifié': '{n} file changed',
  '{n} fichiers modifiés': '{n} files changed',
  '{n} indexé': '{n} staged',
  '{n} indexés': '{n} staged',
  '{n} sélectionné': '{n} selected',
  '{n} sélectionnés': '{n} selected',
  Indexer: 'Stage',
  Désindexer: 'Unstage',
  'Annuler…': 'Discard…',
  'Vider la sélection (Échap)': 'Clear selection (Esc)',
  'Astuce : Ctrl+clic pour choisir plusieurs fichiers, Maj+clic pour une plage.':
    'Tip: Ctrl+click to pick several files, Shift+click for a range.',
  'Aucun changement.': 'No changes.',
  'En cours…': 'Working…',
  'Sélectionnez un fichier pour voir le diff.': 'Select a file to see the diff.',
  "Pas de diff textuel (fichier binaire, vide, ou identique à l'index).":
    'No text diff (binary file, empty, or identical to the index).',

  // GitWidget.tsx
  'Git — vue simple (clic) · panneau complet : Ctrl+G':
    'Git — simple view (click) · full panel: Ctrl+G',
  '{n} commit à pousser': '{n} commit to push',
  '{n} commits à pousser': '{n} commits to push',
  '{n} commit à récupérer': '{n} commit to pull',
  '{n} commits à récupérer': '{n} commits to pull',
  'à jour': 'up to date',
  indexé: 'staged',
  '… et {n} autre — tout voir': '… and {n} more — see all',
  '… et {n} autres — tout voir': '… and {n} more — see all',
  'Aucune modification en attente.': 'No pending changes.',
  'Ouvrir le panneau Git': 'Open Git panel',
  'Message de commit…': 'Commit message…',
  'Commiter toutes les modifications': 'Commit all changes',
  'Commit tout{suffix}': 'Commit all{suffix}',
  'Pull{suffix}': 'Pull{suffix}',
  'Push{suffix}': 'Push{suffix}',
  Pull: 'Pull',
  Push: 'Push',
  Fetch: 'Fetch',

  // BranchBar.tsx
  'Changer de branche': 'Switch branch',
  'Nouvelle branche…': 'New branch…',
  'Créer la branche': 'Create branch',
  Rafraîchir: 'Refresh',

  // GitHistory.tsx
  'Filtrer (message, auteur, hash)…': 'Filter (message, author, hash)…',
  'Afficher uniquement la branche courante': 'Show only the current branch',
  'Afficher toutes les branches (graphe complet)': 'Show all branches (full graph)',
  Toutes: 'All',
  'Chargement…': 'Loading…',
  'Aucun commit ne correspond au filtre.': 'No commit matches the filter.',
  'Aucun commit.': 'No commits.',
  'Charger plus de commits': 'Load more commits',
  'Sélectionnez un commit pour voir ses fichiers.': 'Select a commit to see its files.',
  'Pas de diff textuel (fichier binaire, vide, ou renommage sans modification).':
    'No text diff (binary file, empty, or rename without modification).',
  'Copier le hash complet': 'Copy full hash',

  // CommitBox.tsx
  'Commit{suffix} sur {branch}': 'Commit{suffix} to {branch}',

  // ChangedFileRow.tsx
  'Sera commité (cliquer pour désindexer)': 'Will be committed (click to unstage)',
  'Cocher pour indexer': 'Check to stage',
  'Annuler les modifications (destructif)': 'Discard changes (destructive)',

  // FileHistory.tsx
  'Historique Git — {name}': 'Git history — {name}',
  '{n} commit': '{n} commit',
  '{n} commits': '{n} commits',
  "Chargement de l'historique…": 'Loading history…',
  'Aucun commit ne touche ce fichier (non suivi, ou hors dépôt Git).':
    'No commit touches this file (untracked, or outside a Git repository).',
  'Pas de diff textuel pour ce commit (binaire, ou renommage sans modification).':
    'No text diff for this commit (binary, or rename without modification).',

  // gitGraph.ts (relativeDate)
  "à l'instant": 'just now',
  'il y a {n} min': '{n} min ago',
  'il y a {n} h': '{n} h ago',
  'il y a {n} j': '{n} d ago'
}
