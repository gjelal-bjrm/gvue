/**
 * Notes de version (« Nouveautés ») affichées une fois après une mise à jour.
 *
 * À CHAQUE release : ajoute une entrée en tête avec la nouvelle version et la
 * liste des nouveautés. La version doit correspondre à celle de package.json.
 */
export interface ReleaseNote {
  version: string
  date?: string
  notes: string[]
}

export const WHATS_NEW: ReleaseNote[] = [
  {
    version: '0.1.8',
    notes: [
      'Créateur de dossiers en lot (motif {n}/{name}/{date}, numérotation, sous-structure répliquée).',
      'Analyse de l’espace disque (tailles des dossiers, barres, descente dans l’arborescence).',
      'Renommage en masse (rechercher/remplacer + regex, préfixe/suffixe, numérotation, aperçu).',
      'Navigation au clavier dans la liste + taper-pour-sélectionner, filtre instantané (Ctrl+F).',
      'Recherche de fichiers par nom (Ctrl+E, façon « Aller au fichier »).',
      'Vue Git détaillée façon GitHub Desktop : branches, fetch, diff coloré, cases à cocher, menu contextuel.',
      '« Ouvrir un terminal ici » sur les dossiers ; shell par défaut configurable (cmd).'
    ]
  }
]
