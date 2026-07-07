# PLAN — Découper Sidebar.tsx (664 l) et GitPanel.tsx (588 l)

## Rang : 4/5

**Pourquoi ce rang :** exigence de maintenabilité explicite du propriétaire du
projet (« On veut absolument éviter de regrouper tout au même endroit »). Le
précédent découpage (FileList 1021 → 438 l, dossier `filelist/`) fixe le modèle
à suivre. C'est du refactor **sans changement de comportement** — moins urgent
que la CI et les erreurs silencieuses, mais chaque future feature sidebar/Git
en profite.

## Objectif

- `src/renderer/src/components/Sidebar.tsx` : 664 → **< 300 lignes**
  (orchestration seule), sous-composants dans `components/sidebar/`.
- `src/renderer/src/components/GitPanel.tsx` : 588 → **< 350 lignes**,
  sous-composants dans `components/git/` (dossier déjà existant : `DiffView.tsx`,
  `badge.ts`, `GitHistory.tsx` y sont déjà).
- Extraction **1:1** : aucun changement de comportement, de style ou de texte.

## Fichiers à toucher

| Fichier | Action |
|---|---|
| `src/renderer/src/components/Sidebar.tsx` | Réduire à l'orchestration |
| `src/renderer/src/components/sidebar/Item.tsx` | **Créer** (bouton générique icône+libellé) |
| `src/renderer/src/components/sidebar/Section.tsx` | **Créer** (section repliable/réordonnable) |
| `src/renderer/src/components/sidebar/FavoriteItem.tsx` | **Créer** |
| `src/renderer/src/components/sidebar/ProjectItem.tsx` | **Créer** |
| `src/renderer/src/components/sidebar/LaunchRow.tsx` | **Créer** |
| `src/renderer/src/components/sidebar/LaunchConfigDialog.tsx` | **Créer** (~150 l, le plus gros gain) |
| `src/renderer/src/components/GitPanel.tsx` | Réduire |
| `src/renderer/src/components/git/BranchBar.tsx` | **Créer** (barre branche + fetch/pull/push + menu de branches) |
| `src/renderer/src/components/git/CommitBox.tsx` | **Créer** (textarea + bouton commit + erreur) |
| `src/renderer/src/components/git/ChangedFileRow.tsx` | **Créer** (ligne fichier : case, badge, discard) |

Aucun autre fichier n'importe ces sous-composants aujourd'hui (ils sont tous
`function` locales non exportées) : le refactor est contenu dans ces fichiers.

## Implémentation, dans l'ordre

### Partie A — Sidebar (faire en premier : extractions indépendantes)

1. **`LaunchConfigDialog`** : couper/coller la fonction complète (elle est en
   bas de Sidebar.tsx, ~145 lignes, avec son JSX). Elle utilise :
   `useRunnerStore` (projectLaunch, setProjectCommand, runProject),
   `window.api.fs.packageScripts/runnableFiles`, `FilePickerDialog`,
   `commandForFile`/`joinWin` de `../lib/runfile` → dans le nouveau fichier les
   chemins deviennent `../../lib/runfile`, `../FilePickerDialog`.
   Props inchangées : `{ root: string; name: string; onClose: () => void }`.
2. **`Item`**, **`FavoriteItem`**, **`ProjectItem`**, **`LaunchRow`**,
   **`Section`** : couper/coller chacun dans son fichier, `export default`.
   ATTENTION : ces composants ont récemment gagné une prop optionnelle
   `onContextMenu?: (e: React.MouseEvent) => void` (menus contextuels de
   dossier) — la conserver telle quelle.
3. Dans `Sidebar.tsx` : remplacer les définitions locales par des imports
   (`import Item from './sidebar/Item'` etc.). Vérifier que les icônes lucide
   encore utilisées dans Sidebar.tsx restent importées, et **supprimer** celles
   devenues inutilisées (le typecheck échoue sur `noUnusedLocals` sinon —
   c'est le piège n°4).

### Partie B — GitPanel

4. **`ChangedFileRow`** : extraire la fonction locale `fileRow(f)` en composant
   avec props explicites :
   ```ts
   {
     file: GitFileChange
     rel: string            // chemin relatif déjà calculé (relOf)
     selected: boolean      // sel.has(key)
     lead: boolean          // selPath === file.path (anneau accent)
     onClick: (e: React.MouseEvent) => void
     onContextMenu: (e: React.MouseEvent) => void
     onToggleStaged: () => void
     onDiscard: () => void
   }
   ```
   Le `badge()` s'importe depuis `./badge` (déjà extrait).
5. **`BranchBar`** : extraire toute la barre du haut (le `<div className="flex
   h-10 …">` complet : bouton de branche + dropdown, `HeaderBtn` Fetch/Pull/
   Push, boutons rafraîchir/fermer). Déplacer `HeaderBtn` (fonction locale en
   bas du fichier) dans `BranchBar.tsx`. Props :
   ```ts
   {
     repo: { branch: string; ahead: number; behind: number }
     branches: GitBranches
     busy: boolean
     onCheckout: (b: string) => void
     onCreateBranch: (name: string) => void
     onFetch: () => void; onPull: () => void; onPush: () => void
     onRefresh: () => void; onClose: () => void
   }
   ```
   L'état LOCAL du dropdown (`branchMenu`, `newBranch`) **déménage dans
   BranchBar** (il n'est utilisé nulle part ailleurs).
6. **`CommitBox`** : extraire la zone de commit (textarea `message`, bouton
   « Commit (N) sur branche », `<pre>` d'erreur). L'état `message` déménage
   dedans ; props :
   ```ts
   {
     branch: string
     stagedCount: number
     busy: boolean
     error: string | null          // result && !result.ok ? result.output : null
     onCommit: (message: string) => void
   }
   ```
   Dans GitPanel, `onCommit` appelle `act(() => window.api.git.commitStaged(root,
   msg), …)` — le vidage du textarea après succès se fait DANS CommitBox
   (vider quand la prop `stagedCount` retombe à 0 après un commit réussi est
   fragile : préférer que `onCommit` renvoie une Promise<boolean> et vider si
   true — adapter la signature en `onCommit: (m: string) => Promise<boolean>`
   et dans GitPanel retourner `r.ok`).
7. GitPanel garde : l'état de sélection (`selPath`, `sel`), `act`/`busy`/
   `result`, le chargement du diff, `buildMenu` (menu contextuel — 100 l mais
   fortement couplé à `act` et à la sélection ; NE PAS l'extraire dans ce plan,
   c'est le prochain candidat), les onglets Modifications/Historique.

### Partie C — vérifier

`npm run typecheck && npm test && npm run build` verts, puis test manuel
(checklist en critères). Committer avec le format du dépôt (préfixe `GVue:`,
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`, boucle de réessai
git — GVue verrouille `.git/index.lock` quand il tourne).

## Pièges relevés (qu'un modèle moins attentif raterait)

1. **Sélecteurs zustand : jamais de tableau/objet neuf dans le sélecteur.** Ce
   dépôt a DÉJÀ subi un écran noir à cause de
   `useNavStore((s) => s.locations?.drives ?? [])` (nouvelle référence à chaque
   appel → boucle useSyncExternalStore). Le correctif historique est le pattern
   `const NO_DRIVES: DriveInfo[] = []` + `useNavStore((s) => s.locations?.drives) ?? NO_DRIVES`
   (visible en tête de `FolderTree.tsx`). En déplaçant du code qui lit les
   stores, garder les sélecteurs primitifs/référence-stables tels quels.
2. **`autoSaveId` des PanelGroup = clés de persistance.** `"gvue:git"` (vue
   Modifications) et `"gvue:git-history"` existent en localStorage chez
   l'utilisateur. Ne pas les renommer pendant l'extraction, sinon les largeurs
   de colonnes sauvegardées sont perdues.
3. **Collision de nom `GitCommit`.** `GitPanel.tsx` importe l'icône lucide
   `GitCommit` ET le type partagé `GitCommit` existe dans `@shared/types`
   (l'historique l'aliase déjà en `GitCommitIcon` dans `GitHistory.tsx`). Si un
   fichier extrait a besoin des deux : `import { GitCommit as GitCommitIcon }
   from 'lucide-react'`.
4. **`noUnusedLocals`/`noUnusedParameters` sont stricts.** Après extraction,
   les imports lucide orphelins dans Sidebar.tsx/GitPanel.tsx font ÉCHOUER le
   typecheck. Faire la passe de nettoyage des imports après chaque coupe.
5. **Case à cocher « maître » avec `indeterminate`.** Dans GitPanel, la case
   d'en-tête utilise un ref-callback (`ref={(el) => { if (el) el.indeterminate
   = … }}`) — `indeterminate` n'est pas une prop React ; si on extrait cette
   zone, transporter le ref-callback tel quel.
6. **Le drag & drop des sections** de la sidebar passe par
   `dataTransfer.setData('application/x-gvue-section', key)` : la clé MIME doit
   rester identique entre `Section.tsx` extrait et tout code qui la lit.
7. **Ne pas convertir les `function` en `const` fléchées ni « améliorer » les
   styles au passage** : extraction 1:1, le diff doit se relire comme des
   déplacements.

## Critères d'acceptation

1. `wc -l` : `Sidebar.tsx` < 300 ; `GitPanel.tsx` < 350 ; aucun nouveau fichier
   > 200 lignes sauf `LaunchConfigDialog.tsx` (~160) et `BranchBar.tsx` (~150).
2. `npm run typecheck`, `npm test` (63 tests), `npm run build` verts.
3. Vérification manuelle (`npm run dev`) — tout se comporte comme avant :
   - sidebar : replier/déplier une section ; réordonner par glisser (l'ordre
     persiste après redémarrage) ; clic droit sur Accueil/favori/projet →
     menu contextuel de dossier ; ▶ d'un projet (lance/arrête) ; ⚙ ouvre le
     dialogue de commande, boutons « Fichiers/Scripts » remplissent le champ ;
   - vue Git : changer de branche via le dropdown ; en créer une ; fetch/pull/
     push ; cocher/décocher un fichier (indexe/désindexe) ; case maître
     (indeterminate visible quand indexation partielle) ; commit vide le
     champ après succès et affiche l'erreur git en rouge après échec ;
     onglet Historique intact ; largeurs de panneaux conservées d'avant
     le refactor (localStorage).
4. `git diff --stat` du commit : Sidebar.tsx et GitPanel.tsx en fortes
   suppressions, nouveaux fichiers en ajouts — pas de modification d'un autre
   composant.
