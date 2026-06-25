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
(« hier », « lun. »), bascule des éléments masqués.

**Terminal intégré** — pseudo-terminal réel (`node-pty` + `xterm`), détection
dynamique des shells (PowerShell, PowerShell 7, cmd, Git Bash, WSL), **plusieurs
onglets**, panneau réductible qui **préserve l'historique**, barre de commande qui
exécute une commande dans le terminal actif.

**Multi-volets** — ouvre **jusqu'à 3 dossiers côte à côte**, chacun avec sa
navigation, son historique et sa sélection. Le volet « actif » (cliqué) est celui
que pilotent la barre d'adresse, Git et la palette — idéal pour comparer ou
déplacer entre dossiers. Bouton « diviser » et fermeture par volet.

**Manipulation de fichiers** — **multi-sélection** (Ctrl/Maj+clic, Ctrl+A),
**renommer** en place (F2), **glisser-déposer natif** : entre volets, **entre
instances de GVue** et **depuis/vers l'explorateur Windows** (drag de sortie via
`webContents.startDrag`, drop entrant via `webUtils`). Maj = déplacer, sinon
copier. **Couper / copier / coller** (Ctrl+X/C/V ou menu contextuel). Menu sur la
**zone vide** (nouveau fichier/dossier, coller, actualiser). Jamais d'écrasement :
collision → « nom (copie) ». Suppression vers la corbeille (Suppr).

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

**Accès rapide** — page d'accueil façon explorateur Windows : **dossiers
fréquents** et **fichiers récents**, alimentés automatiquement au fil de l'usage.

**Personnalisation** — panneau Apparence pleinement fonctionnel : couleur d'accent
(6 pastilles + sélecteur libre), thème clair / sombre / auto, densité (confort /
compact), coins (arrondis / carrés), police et taille. Tout est peint via des
**variables CSS** et **persisté** entre les sessions ; la taille et la position de
la fenêtre sont également mémorisées.

**Sidebar** — accès rapide (accueil, téléchargements), lecteurs détectés, favoris.

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
├─ run.bat                     # lancement guidé (vérif Node, install, rebuild, dev)
├─ src/
│  ├─ main/
│  │  ├─ index.ts              # bootstrap app + IPC
│  │  ├─ window.ts             # fenêtre frameless + état persistant
│  │  ├─ ipc/                  # fs, terminal, search, git, config, window
│  │  └─ services/             # filesystem, pty-manager, shell-detect, search, git, config-store
│  ├─ preload/
│  │  └─ index.ts              # contextBridge → window.api
│  ├─ renderer/
│  │  └─ src/
│  │     ├─ App.tsx
│  │     ├─ components/        # TitleBar, Toolbar, CommandBar, Sidebar, FileList, GitWidget,
│  │     │                     #   ContextMenu, SearchPanel, QuickAccessPanel, Terminal, TerminalPanel, AppearancePanel
│  │     ├─ state/             # stores zustand (nav, terminal, search, git, appearance, ui)
│  │     ├─ theme/             # variables CSS, presets, application du thème
│  │     └─ lib/               # helpers (format, icônes, registre xterm)
│  └─ shared/                  # types.ts, ipc.ts
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
npm run build       # build de production
npm start           # prévisualise le build
npm run rebuild     # recompile node-pty pour l'ABI d'Electron
```

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
| **5. Personnalisation** | ✅ **Fait** | Apparence, presets nommés, opacité réelle ; reste : dispositions par espace de travail (avec phase 6) |
| **6. Pro** | 🟡 **Partiel** | Palette, aperçu, multi-volets (jusqu'à 3) faits ; reste : espaces de travail, barre IA, carte disque, SSH/SFTP |

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

### ⏳ Ce qu'il reste à faire

- **Phase 5 (reliquat)** : persistance des dispositions de panneaux par espace de
  travail (dépend des espaces de travail, cf. phase 6).
- **Phase 6 — Pro** : vue par projet + actions rapides, palette de commandes (Ctrl+P),
  barre IA (Ollama, commande validée avant exécution), panneau d'aperçu (code coloré,
  Markdown, images, JSON, PDF), espaces de travail, carte de l'espace disque, double
  panneau + renommage en masse, accès SSH/SFTP.
- **Transverse** : surveillance disque temps réel (`chokidar` → rafraîchissement
  automatique de la vue), gestion des favoris/récents depuis l'UI, suppression vers la
  corbeille (`shell.trashItem`), tests des services (parsing Git, construction des requêtes).

---

## Sécurité

Garde-fous Electron non négociables, en place dès le départ :

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Toute l'API exposée via `preload` + `contextBridge`, jamais d'accès Node depuis le renderer.
- Content-Security-Policy stricte côté renderer.
- Validation des chemins côté services (chemins absolus contrôlés).
- Liens externes ouverts dans le navigateur système, jamais dans la fenêtre app.

---

## Hors périmètre (pour l'instant)

- Édition de fichiers complète (GVue *aperçoit*, un éditeur *édite*).
- Synchronisation cloud.
- Système de plugins tiers (à envisager si l'architecture services le permet proprement).

---

## Licence

MIT.
"# gvue" 
"# gvue" 
"# gvue" 
"# gvue" 
