# PLAN — CI de tests sur chaque push/PR

## Rang : 1/5 (à faire en premier)

**Pourquoi ce rang :** ~30 minutes de travail, et il rend automatique le filet de
sécurité (typecheck strict + 63 tests vitest) qui aujourd'hui ne se déclenche que
si on y pense en local. Tous les autres chantiers en bénéficient immédiatement.
Le dépôt a `.github/workflows/release.yml` (déclenché uniquement sur tag `v*`)
mais **aucune CI sur push/PR**.

## Objectif

Créer un workflow GitHub Actions `ci.yml` qui exécute typecheck + tests + build
à chaque push sur `main` et à chaque pull request, sur `windows-latest`
(plateforme cible de l'app).

## Fichiers à toucher

| Fichier | Action |
|---|---|
| `.github/workflows/ci.yml` | **Créer** |
| `README.md` | Modifier (1 ligne : badge de statut, optionnel) |

## Contexte du dépôt (à connaître avant d'agir)

- Scripts npm (dans `package.json`) : `npm run typecheck` (node + web),
  `npm test` (= `vitest run`, 63 tests), `npm run build`
  (= `npm run typecheck && electron-vite build` — le build REFAIT le typecheck,
  c'est voulu, ne pas « optimiser »).
- `node-pty` est en **optionalDependencies** : si sa compilation échoue,
  `npm ci` **ne doit pas** faire échouer le job (comportement npm par défaut
  pour une dépendance optionnelle — ne rien ajouter de spécial).
- Les tests écrivent dans `os.tmpdir()` (répertoires `gvue-test-*`, `gvue-mkd-*`)
  et se nettoient seuls : aucun setup requis.
- `release.yml` existe déjà et tourne sur les tags `v*` : `ci.yml` ne doit PAS
  se déclencher sur les tags (sinon double exécution).

## Implémentation, dans l'ordre

### Étape 1 — créer `.github/workflows/ci.yml`

Contenu exact :

```yaml
name: CI

# Typecheck + tests + build sur chaque push/PR (les releases ont leur propre
# workflow release.yml, déclenché par les tags v*).
on:
  push:
    branches: [main]
  pull_request:

# Annule les exécutions périmées quand on repousse sur la même branche.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: windows-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Tests
        run: npm test

      - name: Build
        run: npx electron-vite build
```

Remarques d'exactitude :
- La dernière étape appelle `npx electron-vite build` (et non `npm run build`)
  pour ne pas répéter le typecheck déjà exécuté à l'étape précédente — chaque
  étape a ainsi une cause d'échec claire.
- Ne PAS ajouter d'étape electron-builder/dist : la CI de test ne fabrique pas
  d'installeur (c'est le rôle de `release.yml`).

### Étape 2 (optionnelle) — badge dans le README

Dans `README.md`, sous le titre `# GVue` (ligne 1), ajouter :

```markdown
![CI](https://github.com/gjelal-bjrm/gvue/actions/workflows/ci.yml/badge.svg)
```

### Étape 3 — committer

Conventions du dépôt : message préfixé `GVue:`, terminé par la ligne
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. GVue (l'app) tourne
souvent pendant le dev et verrouille `.git/index.lock` par intermittence :
committer dans une boucle de réessai :

```bash
for i in 1 2 3 4 5 6; do git add -A 2>/dev/null && git commit -m "..." && break || { echo "retry $i"; sleep 2; }; done
```

## Pièges relevés (qu'un modèle moins attentif raterait)

1. **Ne pas déclencher sur les tags.** `on.push.branches: [main]` suffit ; ne pas
   mettre `on: push` nu, sinon chaque tag `v*` lancerait CI **et** release.
2. **Ne pas « corriger » le double typecheck de `npm run build`.** Le script
   `build` du package.json enchaîne volontairement typecheck + build ; en CI on
   appelle `npx electron-vite build` directement pour éviter la répétition SANS
   modifier package.json (d'autres flux locaux comptent dessus).
3. **`npm ci` sur windows-latest recompile node-pty** (les runners ont les Build
   Tools). Si un jour ça casse, c'est une dépendance optionnelle : l'install
   réussit quand même — ne pas ajouter `--no-optional`, l'app doit continuer à
   être testée avec sa vraie résolution de dépendances.
4. **`concurrency`** évite d'empiler des runs obsolètes quand on pousse vite
   (l'utilisateur pousse des grappes de commits).

## Critères d'acceptation

1. `git push` sur `main` → l'onglet Actions montre un run **CI** vert avec
   4 étapes distinctes (install, typecheck, tests, build).
2. Ouvrir une PR → le même workflow se déclenche sur la PR.
3. Pousser un tag `vX.Y.Z` → **release.yml se lance, ci.yml NE se lance PAS**.
4. Casser volontairement un test en local (`expect(true).toBe(false)` dans
   `tests/bulkRename.test.ts`), pousser sur une branche → run rouge, l'étape
   « Tests » est celle en échec ; retirer le sabotage → run vert.
5. Durée totale du run < ~8 minutes (sinon vérifier que le cache npm est actif).
