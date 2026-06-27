# GVue

**Explorateur de fichiers de bureau pensé pour les développeurs.**

Un explorateur aussi familier que celui de Windows, mais qui *comprend* le code et
s'adapte à son utilisateur : navigation classique, barre de commande shell intégrée,
terminal réductible, conscience Git, recherche `ripgrep`, et interface entièrement
personnalisable. 100 % local, aucun appel réseau sortant hors fonctions explicites.

> Projet construit **par phases** : chaque phase est un livrable fonctionnel et
> lançable. Plateforme cible principale : **Windows 10/11** (macOS / Linux suivront,
> l'architecture Electron le permet).

---

## Sommaire

- [Aperçu des fonctionnalités](#aperçu-des-fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Prérequis & démarrage](#prérequis--démarrage)
- [Terminal natif (node-pty)](#terminal-natif-node-pty)
- [Feuille de route — ce qui est fait / ce qu'il reste](#feuille-de-route)
- [Sécurité](#sécurité)
- [Hors périmètre](#hors-périmètre)

---

## Aperçu des fonctionnalités

**Navigation** — barre de titre custom (fenêtre sans cadre), fil d'Ariane cliquable
et éditable, boutons précédent/suivant/parent/accueil, double-clic pour ouvrir
(dossier ou application par défaut), liste **virtualisée** fluide même sur des
milliers d'entrées, tri par colonne (nom, taille, date), dates relatives
(« hier », « lun. »), bascule des éléments masqués. **Navigation au clavier**
(flèches, Entrée, Retour arrière, **taper-pour-sélectionner**), **filtre instantané**
du dossier (**Ctrl+F**) et **recherche de fichiers par nom** récursive et floue
(**Ctrl+E**, façon « Aller au fichier »). Menu **« Ouvrir un terminal ici »** sur
les dossiers.

**Terminal intégré** — pseudo-terminal réel (`node-pty` + `xterm`), détection
dynamique des shells (PowerShell, PowerShell 7, cmd, Git Bash, WSL, **Python**) avec
**shell par défaut configurable** (★ dans les sélecteurs), **plusieurs onglets** ou
affichage **côte à côte** (colonnes redimensionnables), panneau réductible qui
**préserve l'historique**, barre de commande qui exécute une commande dans le terminal
actif. **Autocomplétion fantôme** (ghost text, façon fish) : suggestion en gris (couleur
adaptée au shell) des **commandes connues** du shell et des **fichiers/dossiers du cwd**,
validée par **Tab**.

**Lanceur** — définis des **lancements** (commande + dossier, avec un **projet** et/ou
une **catégorie**, ou un script `package.json` auto-détecté) et des **profils** (groupes
lancés ensemble : front + back…), puis lance/arrête via **Play/Stop**. Tout tourne dans
le **terminal intégré** (un onglet par lancement). Sous « Lanceur » dans la sidebar, une
**liste repliable** de tous les lancements, **regroupés par projet ou par catégorie**.
Chaque **dépôt** de la sidebar a un **▶** qui exécute une **commande définie** d'un clic
(bouton ⚙ pour la définir / la changer).

**Multi-volets** — ouvre **jusqu'à 3 dossiers côte à côte**, chacun avec sa
navigation, son historique et sa sélection. Le volet « actif » (cliqué) est celui
que pilotent la barre d'adresse, Git et la palette — idéal pour comparer ou
déplacer entre dossiers. Bouton « diviser » et fermeture par volet.

**Plusieurs fenêtres & arrière-plan** — ouvre **plusieurs fenêtres GVue**
(barre d'outils, palette, **Ctrl+Maj+N**). GVue reste en **arrière-plan dans le
plateau système** (icône en bas à droite) quand toutes les fenêtres sont fermées :
**clic droit** sur l'icône → **Accès rapide, Projets, Lancements, Espaces de
travail** ; clic gauche pour rouvrir ; « Quitter GVue » pour fermer réellement.

**Manipulation de fichiers** — **multi-sélection** (Ctrl/Maj+clic, Ctrl+A),
**renommer** en place (F2), **glisser-déposer natif** : entre volets, **entre
instances de GVue** et **depuis/vers l'explorateur Windows** (drag de sortie via
`webContents.startDrag`, drop entrant via `webUtils`). Maj = déplacer, sinon
copier. Les **copies volumineuses** (> 20 Mo) affichent une **barre de
progression annulable**. **Couper / copier / coller** (Ctrl+X/C/V ou menu contextuel). Menu sur la
**zone vide** (nouveau fichier/dossier, coller, actualiser). Jamais d'écrasement :
collision → « nom (copie) ». Suppression vers la corbeille (Suppr). **Annuler la
dernière opération** (**Ctrl+Z** ou palette) : renommage (simple ou en masse),
déplacement, copie et création de dossiers/fichiers reviennent en arrière (les
créations/copies repartent à la corbeille), avec confirmation par message éphémère.
**Renommage en masse** (rechercher/remplacer + regex, préfixe/suffixe,
numérotation, avec aperçu).
**Analyse de l'espace disque** : tailles des dossiers calculées récursivement, triées,
avec barres proportionnelles et descente dans l'arborescence (menu dossier ou palette).
**Création de dossiers en lot** : motif avec jetons (`{n}` numéro, `{name}` depuis une
liste, `{date}`, `{i}`) + numérotation + **sous-structure répliquée** (sous-dossiers),
avec aperçu (menu de la zone vide ou palette).

**Recherche** — recherche de contenu via **ripgrep** (`@vscode/ripgrep`), lancée
depuis la barre d'outils sur le dossier courant : bascules casse / mot entier /
regex, résultats **streamés en temps réel** et **groupés par fichier**, surlignage
des correspondances, liste virtualisée. Clic sur un fichier → ouvre son dossier ;
clic sur une ligne → ouvre le fichier. Annulable, plafonnée contre le flot.

**Git** — conscience Git intégrée (pilotage du binaire `git` du système) :
**badges de statut** par fichier (modifié / non suivi / indexé / supprimé /
conflit), nom teinté, point sur les dossiers contenant des changements, **branche
+ avance/retard** dans la barre d'état. Panneau **commit / pull / push** (avec
retour de git), **menu contextuel** par fichier (indexer / désindexer / annuler,
ouvrir, révéler, copier le chemin, **corbeille**). **Masquage** des fichiers
ignorés par `.gitignore` (bascule persistée) et **détection des dépôts** visités
dans la sidebar (section Projets, branche + indicateur de modifications).
**Vue Git détaillée** (façon GitHub Desktop, en plein centre) : barre de branche
(**changer / créer de branche**, **fetch**, pull/push), liste des fichiers **indexés /
modifiés** avec statut coloré (A/M/D/U…), **indexer/désindexer** par fichier ou en bloc,
**annuler** (discard), **cases à cocher par fichier** (cochée = indexée = sera commitée,
+ case maître), **diff façon GitHub Desktop** (numéros de ligne ancien/nouveau + fonds
vert/rouge) du fichier sélectionné, et zone de commit (depuis l'indicateur Git ou la palette).
**Multi-sélection** (Ctrl/Maj+clic) et **menu contextuel** par fichier(s) : indexer/
désindexer, annuler, **ignorer** (fichier / dossier / `*.ext` → `.gitignore`), copier
le chemin (absolu/relatif), révéler dans l'explorateur, ouvrir avec VS Code / par défaut.

**Accès rapide** — page d'accueil façon explorateur Windows : **dossiers
fréquents** et **fichiers récents**, alimentés automatiquement au fil de l'usage.

**Personnalisation** — panneau Apparence pleinement fonctionnel : couleur d'accent
(6 pastilles + sélecteur libre), thème clair / sombre / auto, densité (confort /
compact), coins (arrondis / carrés), police et taille, **presets nommés**. Tout est
peint via des **variables CSS** et **persisté** entre les sessions ; la taille/position
de la fenêtre **et les tailles des zones** (sidebar, volets, panneaux, terminal) sont
mémorisées. Section **« À propos »** : version de l'app + état des mises à jour + bouton
« Vérifier ».

**Sidebar** — accès rapide (accueil, téléchargements), lecteurs détectés, favoris.
Les sections (Ce PC, Lecteurs, Favoris, Projets) sont **repliables** et **réordonnables**
par glisser-déposer (ordre et repli mémorisés). La section **Lecteurs** est un **arbre**
(lecteurs → sous-dossiers chargés à la demande) avec une option **« Suivre le dossier
ouvert »** qui déplie automatiquement jusqu'au dossier du volet actif (activable/
désactivable, mémorisée).

---

## Stack technique

| Domaine | Choix |
|---|---|
| Runtime desktop | **Electron** |
| Build / bundler | **electron-vite** (HMR renderer, build main/preload/renderer) |
| UI | **React + TypeScript** (strict) |
| Styles | **Tailwind CSS** + variables CSS |
| Icônes | **lucide-react** |
| État | **Zustand** |
| Terminal | **node-pty** + **@xterm/xterm** (+ addons `fit`, `web-links`) |
| Recherche | **@vscode/ripgrep** (binaire `rg` par plateforme) |
| Git | binaire **`git`** du système (CLI, sans dépendance npm) |
| Virtualisation liste | **@tanstack/react-virtual** |
| Panneaux redimensionnables | **react-resizable-panels** |
| Config persistée | **electron-store** |
| Recompilation native | **@electron/rebuild** (pour `node-pty`) |
| Empaquetage | **electron-builder** (installeur Windows NSIS) |
| Mises à jour auto | **electron-updater** (flux GitHub Releases) |

*Git utilise le binaire `git` du système plutôt que `simple-git` : zéro
dépendance native, zéro téléchargement. À venir selon les phases : `chokidar`
(surveillance fs), `ssh2` (SFTP), Ollama (barre IA).*

---

## Architecture

Trois processus, séparation stricte. La logique métier vit dans des **services purs
et testables** ; les handlers IPC sont de fins adaptateurs ; le renderer ne touche
jamais à Node directement.

```
┌──────────────┐   invoke / on    ┌──────────────┐   appelle    ┌───────────────┐
│   Renderer   │ ────────────────▶│   Preload    │─────────────▶│  Main (IPC →  │
│  (React/UI)  │◀──────────────── │ contextBridge│◀─────────────│   services)   │
└──────────────┘  résultat/event  └──────────────┘              └───────────────┘
```

- **`src/main`** — seul à toucher Node/OS. Services (`filesystem`, `pty-manager`,
  `shell-detect`, `config-store`) + handlers IPC fins.
- **`src/preload`** — expose `window.api`, typé et restreint, via `contextBridge`.
  Aucune fuite de `require` / `ipcRenderer` brut.
- **`src/renderer`** — React pur ; ne connaît que `window.api`.
- **`src/shared`** — types et noms de canaux IPC partagés.

---

## Structure du projet

```
gvue/
├─ electron.vite.config.ts
├─ electron-builder.yml         # config installeur NSIS + publication GitHub
├─ run.bat                      # lancement guidé (vérif Node, install, rebuild, dev)
├─ build.bat                    # build de l'installeur Windows
├─ publish.bat                  # assistant de publication d'une mise à jour
├─ scripts/
│  └─ gen-whatsnew.cjs          # génère les notes « Nouveautés » depuis les commits
├─ build/icon.png               # icône de l'app (badge circulaire)
├─ src/
│  ├─ main/
│  │  ├─ index.ts               # bootstrap app + IPC + instance unique
│  │  ├─ window.ts              # fenêtre frameless (multi-fenêtres) + état persistant
│  │  ├─ tray.ts                # plateau système (arrière-plan, actions rapides)
│  │  ├─ icon.ts                # résolution de l'icône (dev vs packagé)
│  │  ├─ ipc/                   # fs, terminal, search, git, config, window, apps
│  │  └─ services/              # filesystem, pty-manager, shell-detect, search, git,
│  │  │                         #   config-store, fileops, fs-watch, preview, apps, updater
│  ├─ preload/
│  │  └─ index.ts               # contextBridge → window.api
│  ├─ renderer/
│  │  └─ src/
│  │     ├─ App.tsx
│  │     ├─ components/         # TitleBar, Toolbar, CommandBar, CommandPalette, Sidebar, FolderTree,
│  │     │                      #   FileList, FilePickerDialog, GitWidget, ContextMenu, SearchPanel,
│  │     │                      #   QuickAccessPanel, Terminal, TerminalPanel, LauncherPanel, Toast,
│  │     │                      #   AppearancePanel, PreviewPanel, WorkspaceMenu, UpdateBanner, Logo
│  │     │   └─ filelist/        #   FileList éclaté : Row, RenameInput, ColumnHeader, StatusBar,
│  │     │                      #     menus (contextuels), useFileListKeyboard, helpers
│  │     ├─ state/              # stores zustand (nav, terminal, search, git, appearance, ui,
│  │     │                      #   favorites, apps, openWith, workspace, runner, sidebar, update)
│  │     ├─ theme/              # variables CSS, presets, application du thème
│  │     └─ lib/                # helpers (format, icônes, registre xterm, runfile)
│  └─ shared/                   # types.ts, ipc.ts
└─ resources/
```

---

## Prérequis & démarrage

- **Node.js ≥ 18 (20 LTS recommandé).** Node 16 n'est pas supporté.
- Windows 10/11 (cible principale).

```bash
npm install      # dépendances + binaire Electron
npm run dev      # lance l'app (HMR renderer)
```

Ou, sous Windows, un simple double-clic sur **`run.bat`** : il vérifie la version de
Node, installe les dépendances si besoin, tente la recompilation native, puis lance
l'app.

Autres scripts :

```bash
npm run typecheck   # typage strict (main + renderer)
npm test            # tests unitaires (vitest) de la logique pure
npm run build       # build de production
npm start           # prévisualise le build
npm run rebuild     # recompile node-pty pour l'ABI d'Electron
npm run dist        # construit l'installeur Windows (NSIS) dans dist/
npm run dist:dir    # build non empaqueté (dossier, pour tester)
npm run publish     # build + publie une release sur GitHub (auto-update)
```

Ou, pour produire l'**installeur**, double-clic sur **`build.bat`** (vérif Node,
install si besoin, `npm run dist`, puis ouverture du dossier `dist/`). Au premier
build, electron-builder télécharge ses outils (NSIS) ; l'app n'étant pas signée,
Windows SmartScreen peut afficher un avertissement au premier lancement.

### Mises à jour automatiques

GVue intègre **electron-updater** (flux **GitHub Releases**) : l'app installée
**vérifie au démarrage** (puis toutes les 6 h) s'il existe une version plus récente,
la **télécharge** et propose **« Redémarrer et installer »** (bandeau en haut). On
peut aussi vérifier à la demande via la **palette** ou le **plateau système**. En
dev (non empaqueté) ou si la dépendance est absente, l'auto-update est simplement
inactif — l'app fonctionne normalement. Après une mise à jour, une **pop-up
« Nouveautés »** s'affiche **une seule fois** ; réaccessible via la palette. Les
notes de version (`src/renderer/src/data/whatsNew.json`) sont **générées
automatiquement** à partir des messages de commit lors du `publish` (voir
ci-dessous) — pas besoin de les écrire à la main.

**Publier une mise à jour** — le plus simple : double-clic sur **`publish.bat`**
(assistant guidé : choix de la version, **génération des notes « Nouveautés »**,
build, téléversement de la release GitHub). Il lit le token depuis la variable
`GH_TOKEN` (sinon il le demande). Pour ne plus jamais le saisir, enregistre-le une
fois :

```cmd
setx GH_TOKEN <ton_token_github>   :: token = PAT GitHub avec le scope repo
```

Équivalent en ligne de commande :

```bash
# bump du numéro de version dans package.json (doit être > version installée)
set GH_TOKEN=<token GitHub>        # PowerShell : $env:GH_TOKEN="<token>"
npm run publish                    # build + téléverse installeur + latest.yml
                                   #   sur une release GitHub (gjelal-bjrm/gvue)
```

Le build est téléversé en **brouillon** sur GitHub ; dernière étape (1 clic) :
ouvrir le brouillon dans **Releases** → **« Publish release »** (cela crée le tag).
Les apps déjà installées **en version auto-update** détectent alors la nouvelle
release et se mettent à jour seules. ⚠️ La **toute première** installation doit se
faire à la main (une version sans auto-update ne peut pas se mettre à jour toute
seule). Ne mets **jamais** le token dans un fichier versionné.

**Publication par CI (GitHub Actions)** — pousser un tag `vX.Y.Z` (correspondant à
la version de `package.json`) déclenche [`release.yml`](.github/workflows/release.yml)
qui construit, teste et publie l'installeur. C'est aussi le **socle de la signature
de code** : SignPath Foundation (gratuit pour l'open-source) ne signe que des
artefacts produits par une CI vérifiée — voir [SIGNING.md](SIGNING.md).

**Notes de version automatiques** — `publish.bat` lance `scripts/gen-whatsnew.cjs`,
qui collecte les messages de commit **depuis la dernière publication** (repère dans
`scripts/.last-release`, non versionné), les nettoie et écrit l'entrée de la nouvelle
version dans `whatsNew.json`. Tes commits *sont* donc les notes affichées dans la
pop-up : garde des messages clairs. Tu peux aussi éditer `whatsNew.json` à la main
avant de publier pour curer le résultat.

---

## Terminal natif (node-pty)

Le terminal repose sur **node-pty**, un module natif recompilé pour l'ABI d'Electron
via `@electron/rebuild`. Il est déclaré en **`optionalDependencies`** : si les
**outils de build C++ Windows** sont absents, l'installation **n'échoue pas** —
l'explorateur fonctionne et seul le terminal affiche un message d'aide.

Pour l'activer (si la recompilation a échoué) : installer les *Build Tools* puis
`npm run rebuild`. `run.bat` tente cette étape automatiquement.

---

## Feuille de route

| Phase | État | Contenu |
|---|---|---|
| **1. Coquille** | ✅ **Fait** | Fenêtre frameless + barre de titre, navigation, liste virtualisée, sidebar |
| **2. Terminal** | ✅ **Fait** | node-pty + xterm, détection des shells, onglets, barre de commande |
| **3. Recherche** | ✅ **Fait** | `@vscode/ripgrep`, recherche contenu streamée, résultats cliquables groupés par fichier |
| **4. Git** | ✅ **Fait** | Badges par fichier, branche + avance/retard, commit/pull/push, menu contextuel, masquage `.gitignore`, détection des dépôts |
| **5. Personnalisation** | ✅ **Fait** | Apparence, presets nommés, opacité réelle, tailles de zones mémorisées |
| **6. Pro** | 🟡 **Partiel** | Palette, aperçu, multi-volets, intégrations, espaces de travail enrichis, Lanceur, multi-fenêtres, plateau système, packaging + auto-update, renommage en masse, analyse d'espace disque faits ; reste : commandes perso, barre IA, SSH/SFTP |

### ✅ Ce qui est fait

- **Phase 1 — Coquille**
  - Fenêtre sans cadre, barre de titre custom (réduire / agrandir / fermer, zone de drag).
  - Taille et position de la fenêtre mémorisées et restaurées.
  - Navigation : fil d'Ariane cliquable + éditable, précédent / suivant / parent / accueil, rafraîchir.
  - Liste virtualisée, tri par colonne, dates relatives, icônes par type, bascule des éléments masqués.
  - Ouverture des fichiers avec l'application par défaut, mise en évidence dans l'explorateur OS.
  - Sidebar : accès rapide, lecteurs détectés, favoris (lus de la config).
- **Phase 2 — Terminal**
  - Pseudo-terminaux réels (node-pty), chargement paresseux et tolérant aux pannes natives.
  - Détection dynamique des shells disponibles.
  - Onglets multiples, historique préservé à la réduction du panneau (registre xterm persistant).
  - Barre de commande câblée au terminal actif.
- **Phase 3 — Recherche**
  - Service ripgrep (`@vscode/ripgrep`) : résolution paresseuse et tolérante du binaire (dégrade comme node-pty si absent).
  - Construction de requêtes : casse, mot entier, regex / littéral, inclusion des fichiers ignorés.
  - Sortie `--json` parsée en flux, correspondances streamées par lots, plafonnées et annulables.
  - Champ de recherche de la barre d'outils câblé ; panneau de résultats virtualisé, groupés par fichier, surlignage des correspondances.
- **Phase 4 — Git** (pilotage du binaire `git` du système)
  - Service `git status --porcelain -z --branch --ignored` parsé (branche, avance/retard, fichiers, ignorés).
  - Badges de statut par fichier + nom teinté, point sur les dossiers modifiés, branche + avance/retard dans la barre d'état.
  - Panneau commit (add -A + commit) / pull / push avec retour de git ; menu contextuel par fichier (indexer / désindexer / annuler).
  - Masquage des fichiers ignorés par `.gitignore` (bascule persistée) ; suppression vers la corbeille (`shell.trashItem`).
  - Détection des dépôts visités dans la sidebar (section Projets, branche + indicateur de modifications).
  - Rafraîchissement automatique de la vue (surveillance disque `fs.watch`, débattue).
- **Accès rapide & navigation**
  - Page « Accès rapide » (dossiers fréquents + fichiers récents) en vue par défaut, bouton dédié dans la sidebar.
  - Barre d'adresse éditable façon Windows (validation par Entrée avec vérification d'existence), boutons souris précédent/suivant.
- **Phase 5 — Apparence**
  - Accent, thème, densité, coins, police, taille ; appliqués via variables CSS et persistés.
  - Presets d'apparence nommés (enregistrer / appliquer / supprimer).
  - Opacité réelle de la fenêtre (`win.setOpacity`, niveau OS) réglable au curseur.
- **Phase 6 (début) — Pro**
  - Palette de commandes (Ctrl+Maj+P / Ctrl+P) : recherche floue d'actions (navigation, vue, panneaux, Git, thème) et de projets, navigation clavier.
  - Panneau d'aperçu (façon Quick Look) : image, JSON coloré, Markdown rendu, texte/code, carte d'infos pour les binaires — sans dépendance (coloration/markdown maison, sans HTML brut).
  - Multi-volets (1 à 3 dossiers côte à côte) : navigation indépendante par volet, volet actif piloté par la barre d'outils / Git / la palette ; bouton « diviser » et fermeture des volets.
  - Glisser-déposer natif (entre volets, entre instances, depuis/vers l'explorateur Windows) ; couper/copier/coller (Ctrl+X/C/V) ; copie/déplacement sans écrasement (« nom (copie) »), garde anti-cycle.
  - Multi-sélection (Ctrl/Maj+clic, Ctrl+A), renommer en place (F2), suppression (Suppr) ; menu contextuel sur la zone vide (nouveau fichier/dossier, coller, actualiser) ; menu qui se ferme au clic ailleurs.
  - Icônes système façon Windows (`app.getFileIcon` : logos exe/rdp/types associés, raccourcis `.lnk` résolus vers leur cible) + vignettes d'images (`nativeImage.createThumbnailFromPath`) dans la liste, mémoïsées par extension/chemin, repli sur l'icône lucide.
  - Favoris gérables depuis l'UI (ajout/retrait via le menu contextuel et la sidebar) ; masquage des fichiers système (`desktop.ini`, `Thumbs.db`…).
  - Intégrations applications (détectées par chemin d'install) : ouvrir avec VS Code, éditer avec Notepad++, compresser/extraire avec 7-Zip (interface graphique `7zG.exe` → progression native).
  - « Ouvrir avec… » : sélecteur de programme (`.exe`), association **mémorisée par type de fichier** (proposée ensuite pour tous les fichiers du même type).
  - Espaces de travail nommés : enregistrent/restaurent un environnement complet — dossiers ouverts par volet + Accès rapide + volet actif, panneaux terminal/aperçu/apparence, **thème & couleur d'accent**, **ordre/repli des sections de la sidebar**, **suivi du dossier ouvert**, et les **terminaux ouverts** (shells + affichage onglets/côte à côte) ; réenregistrement d'un espace existant ; bouton dédié dans la barre d'outils + entrées dans la palette. Les **tailles des zones** sont mémorisées entre les sessions.
  - Lanceur : lancements (commande ou script package.json **ou fichier choisi via un sélecteur intégré**, avec projet/catégorie) et profils, exécutés dans le terminal intégré (Play/Stop) ; vue dédiée + liste repliable regroupée (projet/catégorie) sous « Lanceur » + ▶ configurable par dépôt (⚙) dans la sidebar + lancement via la palette.
  - Terminal : **shell par défaut configurable** (★), shell **Python** (REPL), affichage en **onglets ou côte à côte** (colonnes redimensionnables).
  - Sidebar : sections **repliables** et **réordonnables** (glisser-déposer, persistées) ; section Lecteurs en **arbre** avec **« Suivre le dossier ouvert »**.
  - **Plusieurs fenêtres** (Ctrl+Maj+N) + **plateau système** : GVue tourne en arrière-plan, clic droit → Accès rapide / Projets / Lancements / Espaces de travail.
  - Espaces de travail **enrichis** : thème/accent, config sidebar, suivi du dossier, terminaux ouverts (shells + onglets/côte à côte) ; réenregistrement d'un espace.
  - **Packaging** (electron-builder NSIS) + **mises à jour automatiques** (electron-updater / GitHub Releases) avec bandeau « Redémarrer et installer », section « À propos » (version + vérif), assistant `publish.bat`.
  - **Tailles des zones** mémorisées entre les sessions ; **logo** en badge circulaire (icône système sans cadre carré).

### ⏳ Ce qu'il reste à faire

- **Phase 6 — Pro (reliquat)** : commandes personnalisées, barre IA (Ollama,
  commande validée avant exécution), accès SSH/SFTP.
- **Affinages possibles** : taille des zones **par espace de travail** (aujourd'hui
  globale), surveillance disque temps réel via `chokidar` (au lieu de `fs.watch`),
  treemap visuel pour l'espace disque, signature de code (supprimer l'avertissement
  SmartScreen), élargissement de la couverture de tests (UI, services Git réels).

---

## Sécurité

Garde-fous Electron non négociables, en place dès le départ :

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Toute l'API exposée via `preload` + `contextBridge`, jamais d'accès Node depuis le renderer.
- Content-Security-Policy stricte côté renderer.
- Validation des chemins côté services (chemins absolus contrôlés).
- Liens externes ouverts dans le navigateur système, jamais dans la fenêtre app.
- **Garde-fous anti-crash** : `ErrorBoundary` React (écran de repli + « Recharger »
  au lieu d'une fenêtre blanche) et handlers globaux du processus principal
  (`uncaughtException` / `unhandledRejection` / `render-process-gone`). Tout est
  journalisé dans `userData/logs/gvue.log` (ouvrable via la palette → « Ouvrir le
  journal de diagnostic »).
- **Config auto-réparée** : au démarrage, la configuration est assainie (clés
  manquantes complétées, types invalides rejetés, JSON corrompu réinitialisé via
  `clearInvalidConfig`) — une config abîmée ne peut donc pas figer l'app.

---

## Hors périmètre (pour l'instant)

- Édition de fichiers complète (GVue *aperçoit*, un éditeur *édite*).
- Synchronisation cloud.
- Système de plugins tiers (à envisager si l'architecture services le permet proprement).

---

## Licence

MIT.
