# PLAN — Surfacer les erreurs d'opérations fichiers + durcir l'annulation

## Rang : 2/5

**Pourquoi ce rang :** plusieurs opérations sur fichiers échouent aujourd'hui
**en silence** (l'utilisateur colle/supprime/dépose… et rien ne se passe, sans
explication), et l'annulation (Ctrl+Z) d'un déplacement **inter-volumes** est
cassée (bug latent EXDEV). C'est de l'intégrité de données + un angle mort UX,
pour un effort modéré. Le composant `Toast` existe déjà — il suffit de s'en servir.

## Objectif

1. Toute opération fichier qui échoue (totalement ou partiellement) affiche un
   **toast** clair : collage (copier/couper), dépôt drag & drop, menu « Copier/
   Déplacer ici », suppression vers la corbeille.
2. L'annulation d'un déplacement inter-volumes fonctionne (fallback copie+rm,
   comme le fait déjà `move()` à l'aller).
3. Un couper (`cut`) qui échoue **ne vide pas** le presse-papiers interne.

## Fichiers à toucher

| Fichier | Action |
|---|---|
| `src/renderer/src/lib/fileActions.ts` | Modifier `pasteInto` |
| `src/renderer/src/components/FileList.tsx` | Modifier `trashPaths` et `doDrop` |
| `src/renderer/src/components/filelist/menus.tsx` | Modifier `run()` dans `buildDropMenu` |
| `src/main/services/undo-stack.ts` | Modifier `revertPairs` (fallback EXDEV) |

## Rappels d'architecture (nécessaires pour exécuter sans se tromper)

- `window.api.fs.copy/move` renvoient un `FileOpResult` défini dans
  `src/shared/types.ts` : `{ ok: number; errors: string[]; ops?: {from,to}[];
  cancelled?: boolean }`. `ok` = nombre d'éléments réussis. `cancelled: true`
  signifie que l'utilisateur a annulé une copie longue via la barre de
  progression — **ce n'est PAS une erreur**, ne pas afficher de toast d'échec.
- Le toast : `useUiStore.getState().showToast('message')`
  (store : `src/renderer/src/state/useUiStore.ts` ; rendu : `components/Toast.tsx`,
  déjà monté dans `App.tsx`). Auto-masqué après ~3,2 s.
- `window.api.fs.trash(p)` rejette (throw) en cas d'échec — il n'y a pas de
  résultat structuré pour la corbeille.

## Implémentation, dans l'ordre

### Étape 1 — helper de message partagé

Dans `src/renderer/src/lib/fileActions.ts`, ajouter (exporté, pour réutilisation
dans FileList et menus) :

```ts
import type { FileOpResult } from '@shared/types'

/** Message court résumant un résultat d'opération ; null si rien à signaler. */
export function opFeedback(res: FileOpResult, verb: string): string | null {
  if (res.cancelled) return `${verb} annulé(e).`
  if (res.errors.length === 0) return null
  const first = res.errors[0].length > 120 ? res.errors[0].slice(0, 120) + '…' : res.errors[0]
  if (res.ok > 0) return `${verb} : ${res.ok} réussi(s), ${res.errors.length} échec(s) — ${first}`
  return `Échec ${verb.toLowerCase()} : ${first}`
}
```

### Étape 2 — `pasteInto` (fileActions.ts)

Remplacer le corps actuel :

```ts
export async function pasteInto(destDir: string): Promise<void> {
  const clip = useUiStore.getState().clipboard
  if (!clip || !destDir) return
  const op = clip.mode === 'cut' ? window.api.fs.move : window.api.fs.copy
  await op(clip.paths, destDir)
  if (clip.mode === 'cut') useUiStore.getState().setClipboard(null)
  useNavStore.getState().refreshAll()
}
```

par :

```ts
export async function pasteInto(destDir: string): Promise<void> {
  const clip = useUiStore.getState().clipboard
  if (!clip || !destDir) return
  const op = clip.mode === 'cut' ? window.api.fs.move : window.api.fs.copy
  const res = await op(clip.paths, destDir)
  // Un couper n'est « consommé » que si au moins un élément a bougé : un échec
  // total ne doit pas faire perdre le contenu coupé.
  if (clip.mode === 'cut' && res.ok > 0) useUiStore.getState().setClipboard(null)
  const msg = opFeedback(res, clip.mode === 'cut' ? 'Déplacement' : 'Copie')
  if (msg) useUiStore.getState().showToast(msg)
  useNavStore.getState().refreshAll()
}
```

### Étape 3 — `doDrop` (FileList.tsx)

Localiser dans `src/renderer/src/components/FileList.tsx` :

```ts
const move = e.ctrlKey ? false : e.shiftKey ? true : defaultMove
await (move ? window.api.fs.move : window.api.fs.copy)(paths, destDir)
useNavStore.getState().refreshAll()
```

Remplacer par :

```ts
const move = e.ctrlKey ? false : e.shiftKey ? true : defaultMove
const res = await (move ? window.api.fs.move : window.api.fs.copy)(paths, destDir)
const msg = opFeedback(res, move ? 'Déplacement' : 'Copie')
if (msg) useUiStore.getState().showToast(msg)
useNavStore.getState().refreshAll()
```

et ajouter `opFeedback` à l'import existant depuis `../lib/fileActions`
(le fichier importe déjà `clipFiles, pasteInto`).

### Étape 4 — `trashPaths` (FileList.tsx)

Remplacer :

```ts
const trashPaths = async (paths: string[]): Promise<void> => {
  for (const p of paths) {
    try {
      await window.api.fs.trash(p)
    } catch {
      /* annulé ou échec sur cet élément */
    }
  }
  setSelected([])
  await refreshAfter()
}
```

par :

```ts
const trashPaths = async (paths: string[]): Promise<void> => {
  const failed: string[] = []
  for (const p of paths) {
    try {
      await window.api.fs.trash(p)
    } catch {
      failed.push(p.split(/[\\/]/).pop() ?? p)
    }
  }
  if (failed.length) {
    useUiStore
      .getState()
      .showToast(
        `Corbeille : ${failed.length} échec(s) — ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`
      )
  }
  setSelected([])
  await refreshAfter()
}
```

### Étape 5 — menu « Copier/Déplacer ici » (menus.tsx)

Dans `src/renderer/src/components/filelist/menus.tsx`, fonction `buildDropMenu`,
remplacer :

```ts
const run = (op: 'copy' | 'move'): void => {
  void window.api.fs[op](paths, destDir).then(refreshAll)
}
```

par :

```ts
const run = (op: 'copy' | 'move'): void => {
  void window.api.fs[op](paths, destDir).then((res) => {
    const msg = opFeedback(res, op === 'move' ? 'Déplacement' : 'Copie')
    if (msg) useUiStore.getState().showToast(msg)
    refreshAll()
  })
}
```

Ajouter `opFeedback` à l'import déjà présent depuis `../../lib/fileActions`.

### Étape 6 — fallback EXDEV de l'annulation (undo-stack.ts)

Dans `src/main/services/undo-stack.ts`, remplacer :

```ts
async function revertPairs(pairs: { from: string; to: string }[]): Promise<void> {
  // Ordre inverse : évite les collisions transitoires entre éléments du lot.
  for (const p of [...pairs].reverse()) {
    await fs.rename(p.to, p.from)
  }
}
```

par :

```ts
async function revertPairs(pairs: { from: string; to: string }[]): Promise<void> {
  // Ordre inverse : évite les collisions transitoires entre éléments du lot.
  for (const p of [...pairs].reverse()) {
    try {
      await fs.rename(p.to, p.from)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
        // Déplacement inter-volumes à l'aller → même stratégie au retour.
        await fs.cp(p.to, p.from, { recursive: true })
        await fs.rm(p.to, { recursive: true, force: true })
      } else {
        throw e
      }
    }
  }
}
```

(`fs` est déjà `node:fs`.promises dans ce fichier.)

### Étape 7 — vérifier puis committer

`npm run typecheck && npm test && npm run build` doivent être verts (63 tests —
aucune modification de logique testée, pas de nouveau test obligatoire ; en
ajouter un pour `opFeedback` est un bonus facile : fonction pure, importable
dans `tests/` via l'alias `@renderer`).

Commit : préfixe `GVue:`, ligne finale
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`, boucle de réessai
git (index.lock — voir PLAN-ci-tests.md, étape 3).

## Pièges relevés (qu'un modèle moins attentif raterait)

1. **`cancelled` n'est pas une erreur.** Une copie longue annulée par
   l'utilisateur renvoie `cancelled: true` avec `errors: []`. Afficher « Échec »
   serait faux — d'où la branche dédiée dans `opFeedback`.
2. **Le presse-papiers `cut` était vidé même en cas d'échec total** : après un
   déplacement raté (cible en lecture seule…), l'utilisateur perdait sa
   sélection coupée. La condition `res.ok > 0` corrige ça.
3. **EXDEV au retour, pas seulement à l'aller.** `move()` (fileops.ts) gère déjà
   EXDEV en copie+rm ; mais l'undo faisait un `fs.rename(to, from)` nu → un
   Ctrl+Z après déplacement C:→D: levait EXDEV et l'annulation échouait. Le
   fallback doit être **symétrique**.
4. **`shell.trashItem` échoue sur les chemins réseau UNC** (pas de corbeille) —
   c'est précisément un cas que l'app rencontre depuis le support `\\serveur`.
   Ne PAS « réparer » en `fs.rm` (suppression définitive silencieuse !) :
   surfacer l'échec, c'est le comportement sûr.
5. **Tronquer les messages** (120 caractères) : les erreurs Node incluent des
   chemins complets, le toast est une seule ligne.
6. `menus.tsx` et `FileList.tsx` importent déjà depuis `fileActions` — étendre
   les imports existants, ne pas créer de doublons d'import (lint strict).

## Critères d'acceptation

1. Coller (Ctrl+V) vers une cible où la copie échoue (ex. dossier supprimé entre
   temps, ou fichier source verrouillé) → un toast décrit l'échec ; avec un lot
   partiellement réussi → toast « X réussi(s), Y échec(s)… ».
2. Couper puis coller vers une cible en échec total → toast d'échec ET le
   presse-papiers est conservé (re-coller ailleurs fonctionne).
3. Annuler une copie longue via la barre de progression → toast « Copie
   annulée. » (pas de mention d'échec).
4. Supprimer un fichier verrouillé (ouvert en écriture par un autre process) →
   toast « Corbeille : 1 échec(s) — … ».
5. Déplacer un dossier de `C:` vers un autre volume (`D:` ou clé USB), puis
   Ctrl+Z → le dossier revient sur `C:` (fallback EXDEV) et le toast « Annulé :
   Déplacement de N élément(s) » s'affiche.
6. `npm run typecheck`, `npm test`, `npm run build` verts.
