# PLAN — Pipeline de release CI complet (garde de version, notes auto, signature SignPath)

## Rang : 3/5

**Pourquoi ce rang :** c'est le dernier « obligatoire » de l'audit qualité
(binaires signés = plus d'avertissement SmartScreen/antivirus). La candidature
SignPath Foundation est **en cours** ; ce plan est écrit pour être exécutable
**dès maintenant** : tout fonctionne sans les identifiants SignPath (l'étape de
signature est conditionnelle), et il corrige au passage deux failles réelles du
workflow actuel (voir Pièges 1 et 2).

## Objectif

Faire de `.github/workflows/release.yml` le chemin canonique de publication :

1. **Garde de cohérence** : le tag `vX.Y.Z` doit correspondre à la version de
   `package.json`, sinon échec immédiat (un décalage casse l'auto-update).
2. **Notes « Nouveautés » générées en CI** depuis les commits depuis le tag
   précédent (aujourd'hui `scripts/gen-whatsnew.cjs` dépend d'un marqueur local
   non versionné → en CI il prendrait arbitrairement les 25 derniers commits).
3. **Signature SignPath conditionnelle** : si le secret `SIGNPATH_API_TOKEN`
   existe, signer l'installeur puis **régénérer `latest.yml` + `.blockmap`**
   pour le binaire signé (sinon l'auto-update rejetterait le fichier : hash
   différent).
4. Publication en **brouillon** GitHub (l'utilisateur clique « Publish release »,
   flux existant).

## Fichiers à toucher

| Fichier | Action |
|---|---|
| `.github/workflows/release.yml` | **Réécrire** (structure ci-dessous) |
| `scripts/gen-whatsnew.cjs` | Modifier : accepter `--since <ref>` |
| `scripts/fix-latest-yml.cjs` | **Créer** (recalcule hash/taille/blockmap après signature) |
| `SIGNING.md` | Mettre à jour la section « Statut » quand la signature est activée |

## Pré-requis côté utilisateur (à lui rappeler, PAS à faire soi-même)

- Après approbation SignPath : créer le secret de dépôt `SIGNPATH_API_TOKEN`
  (GitHub → Settings → Secrets → Actions) et fournir `organization-id`,
  `project-slug` (`gvue`), `signing-policy-slug` (`release-signing`) à insérer
  dans le YAML. **Ne jamais** écrire le token dans un fichier.
- Installer la GitHub App SignPath et configurer le Trusted Build System
  « GitHub.com » (côté portail SignPath).

## Implémentation, dans l'ordre

### Étape 1 — `gen-whatsnew.cjs` : plage explicite `--since`

Le script actuel lit `scripts/.last-release` (SHA local, gitignoré) et retombe
sur `-25` sinon. Ajouter, AVANT le bloc « Plage de commits » existant :

```js
// Plage explicite : gen-whatsnew.cjs --since v0.1.12  (utilisé par la CI, où
// le marqueur local n'existe pas ; on borne au tag précédent).
const sinceArg = process.argv.indexOf('--since')
```

puis modifier la sélection de plage :

```js
let range = '-25'
if (sinceArg >= 0 && process.argv[sinceArg + 1]) {
  range = `${process.argv[sinceArg + 1]}..HEAD`
} else {
  try {
    const last = fs.readFileSync(markerPath, 'utf8').trim()
    if (last) range = `${last}..HEAD`
  } catch { /* pas de marqueur */ }
}
```

Ne PAS toucher au reste (filtrage SKIP, dédoublonnage, écriture JSON, mise à
jour du marqueur — le marqueur reste utile au flux local `publish.bat`).

### Étape 2 — réécrire `release.yml`

Points structurants (garder `permissions: contents: write`, Node 20, cache npm) :

```yaml
on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # nécessaire : tags + historique pour gen-whatsnew

      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }

      - name: Verifier tag = version package.json
        if: startsWith(github.ref, 'refs/tags/v')
        shell: bash
        run: |
          TAG="${GITHUB_REF#refs/tags/v}"
          PKG=$(node -p "require('./package.json').version")
          if [ "$TAG" != "$PKG" ]; then
            echo "::error::Tag v$TAG != package.json $PKG"; exit 1
          fi

      - name: Notes de version (depuis le tag precedent)
        shell: bash
        run: |
          PREV=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          if [ -n "$PREV" ]; then node scripts/gen-whatsnew.cjs --since "$PREV"; else node scripts/gen-whatsnew.cjs; fi

      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npx electron-vite build

      - name: Package (sans publier)
        run: npx electron-builder --win --publish never

      # ---- Signature (ne tourne que si le secret existe) ----
      - name: Upload unsigned artifact
        id: unsigned
        if: env.HAVE_SIGNPATH == 'true'
        uses: actions/upload-artifact@v4
        with: { name: unsigned-installer, path: dist/*.exe, if-no-files-found: error }

      - name: Sign with SignPath
        if: env.HAVE_SIGNPATH == 'true'
        uses: signpath/github-action-submit-signing-request@v2
        with:
          api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
          organization-id: '<organization-id>'   # fourni par l'utilisateur
          project-slug: 'gvue'
          signing-policy-slug: 'release-signing'
          github-artifact-id: ${{ steps.unsigned.outputs.artifact-id }}
          wait-for-completion: true
          output-artifact-directory: dist-signed

      - name: Reconcilier latest.yml avec le binaire signe
        if: env.HAVE_SIGNPATH == 'true'
        run: node scripts/fix-latest-yml.cjs

      # ---- Publication (brouillon ; l'utilisateur clique Publish) ----
      - name: Create draft release
        if: startsWith(github.ref, 'refs/tags/v')
        shell: bash
        env: { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
        run: |
          gh release create "${GITHUB_REF#refs/tags/}" --draft --title "GVue ${GITHUB_REF#refs/tags/}" \
            dist/*.exe dist/latest.yml dist/*.blockmap
```

Définir `HAVE_SIGNPATH` en tête de job :

```yaml
    env:
      HAVE_SIGNPATH: ${{ secrets.SIGNPATH_API_TOKEN != '' }}
```

### Étape 3 — créer `scripts/fix-latest-yml.cjs`

Rôle : après signature, le hash de l'exe a changé → remplacer l'exe de `dist/`
par la version signée, régénérer le `.blockmap`, et réécrire `sha512`/`size`/
`blockMapSize` dans `dist/latest.yml`. Sans dépendance npm nouvelle :

```js
#!/usr/bin/env node
// Remplace l'installeur par sa version signee (dist-signed/) puis met a jour
// dist/latest.yml + .blockmap. L'auto-update verifie le sha512 : sans cette
// etape, une mise a jour signee serait REJETEE par les clients.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const dist = path.join(__dirname, '..', 'dist')
const signedDir = path.join(__dirname, '..', 'dist-signed')
const exeName = fs.readdirSync(dist).find((f) => f.endsWith('.exe'))
if (!exeName) throw new Error('Aucun .exe dans dist/')
const signed = path.join(signedDir, exeName)
if (!fs.existsSync(signed)) throw new Error(`Binaire signe introuvable : ${signed}`)

// 1) Remplace l'exe par la version signee.
fs.copyFileSync(signed, path.join(dist, exeName))

// 2) Regenere le blockmap (app-builder est livre avec electron-builder) et
//    recupere size/sha512/blockMapSize depuis sa sortie JSON.
const appBuilder = path.join(
  __dirname, '..', 'node_modules', 'app-builder-bin', 'win', 'x64', 'app-builder.exe'
)
const out = execFileSync(appBuilder, [
  'blockmap', '--input', path.join(dist, exeName),
  '--output', path.join(dist, exeName + '.blockmap')
]).toString()
const { size, sha512, blockMapSize } = JSON.parse(out)

// 3) Patch latest.yml (une seule entree de fichier dans ce projet).
const ymlPath = path.join(dist, 'latest.yml')
let yml = fs.readFileSync(ymlPath, 'utf8')
yml = yml
  .replace(/sha512: .+/g, `sha512: ${sha512}`)
  .replace(/size: \d+/g, `size: ${size}`)
  .replace(/blockMapSize: \d+/g, `blockMapSize: ${blockMapSize}`)
fs.writeFileSync(ymlPath, yml)
console.log(`[fix-latest-yml] ${exeName} signe : sha512/size/blockMapSize mis a jour.`)
```

### Étape 4 — vérifier

- Sans secrets SignPath : `workflow_dispatch` manuel → build + package OK,
  aucune étape de signature exécutée, pas de release créée (pas de tag).
- Le flux local `publish.bat` reste fonctionnel (rien n'y change) — le déclarer
  « secours local » dans le README si souhaité.

## Pièges relevés (qu'un modèle moins attentif raterait)

1. **`fetch-depth: 0` est indispensable** : par défaut actions/checkout fait un
   clone superficiel sans tags → `git describe --tags HEAD^` échoue et
   gen-whatsnew prendrait une plage fausse.
2. **Signer APRÈS `electron-builder` casse l'auto-update si on ne répare pas
   `latest.yml`** : electron-updater vérifie le sha512 du téléchargement ; le
   binaire signé a un hash différent de celui calculé au packaging. C'est tout
   l'objet de `fix-latest-yml.cjs` — et il faut régénérer le `.blockmap` aussi
   (mises à jour différentielles).
3. **Le sha512 de latest.yml est en base64, pas en hex.** Ne PAS le recalculer
   avec `crypto` à la main : `app-builder blockmap` renvoie exactement le format
   attendu (et le blockMapSize). `app-builder-bin` est déjà dans node_modules
   (dépendance d'electron-builder), aucun ajout au package.json.
4. **La garde tag/version** : electron-updater compare `version` de latest.yml
   à la version installée ; un tag `v0.2.0` sur un package.json `0.1.13`
   produirait une release incohérente jamais proposée aux clients (ou pire,
   en boucle). Échouer tôt.
5. **`secrets.X != ''` ne peut pas s'utiliser directement dans `if:` d'un step**
   sur certaines versions du runner — d'où le passage par `env.HAVE_SIGNPATH`
   au niveau du job (pattern fiable).
6. **`whatsNew.json` généré en CI n'est PAS commité** : les notes sont embarquées
   dans le binaire (le JSON est importé au build) mais le dépôt ne bouge pas.
   C'est voulu (un workflow ne doit pas pousser sur main). Conséquence à
   documenter : le `whatsNew.json` du dépôt peut être en retard d'une version —
   sans impact fonctionnel (le générateur réécrit l'entrée de la version
   courante à chaque publication).
7. La release **brouillon** est créée sur un tag déjà poussé — `gh release
   create <tag>` s'attache au tag existant (ne pas utiliser `--target`).

## Critères d'acceptation

1. Pousser un tag `vX.Y.Z` ≠ version de package.json → run rouge à l'étape
   « Verifier tag », message explicite.
2. Pousser un tag cohérent (sans secrets SignPath) → run vert : tests passés,
   brouillon de release créé avec **exactement** 3 types de fichiers (`.exe`,
   `latest.yml`, `.exe.blockmap`) ; la pop-up « Nouveautés » du binaire liste
   les commits depuis le tag précédent (vérifiable en installant le build).
3. `workflow_dispatch` manuel (pas de tag) → build complet, **aucune** release
   créée.
4. (Après approbation SignPath + secret posé) même tag → l'exe du brouillon est
   signé (Propriétés → Signatures numériques) ET `latest.yml` contient le
   sha512 du fichier signé : installer la version N-1, publier N, vérifier que
   l'auto-update télécharge et installe N sans erreur de checksum.
5. `publish.bat` local fonctionne toujours à l'identique.
