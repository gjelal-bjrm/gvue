set windows-shell := ["cmd", "/c"]

# Dossier de données de GVue (config, journal).
appdata := join(env_var('APPDATA'), 'gvue')

# Tout ce qui exigerait des guillemets imbriqués vit dans scripts/dev.cjs :
# sous Windows, `just` exécute chaque ligne via `cmd /c`, qui mange les
# guillemets internes (vérifié : `node -e "console.log('x')"` arrive tronqué).
dev_script := "node scripts/dev.cjs"

# Affiche la liste des commandes
default:
  @just --list --unsorted

# =============================================================================
# Développement
# =============================================================================

# Lance GVue en mode développement (HMR)
dev: _need-node
  npm run dev

# Prévisualise le build de production (sans installeur)
start: _need-node
  npm run start

# Installe les dépendances et recompile node-pty pour Electron
setup: _need-node
  npm install --no-audit --no-fund
  @just rebuild

# Recompile node-pty pour l'ABI d'Electron (terminal intégré ; échec toléré)
rebuild:
  -npm run rebuild

# =============================================================================
# Qualité
# =============================================================================

# Vérifie les types (processus main + renderer)
typecheck: _need-node
  npm run typecheck

# Lance les tests unitaires
test *args: _need-node
  npx vitest run {{args}}

# Relance les tests à chaque modification
test-watch:
  npx vitest

# Porte d'entrée avant commit : types + tests + build de production
check: typecheck test
  npx electron-vite build

# =============================================================================
# Distribution
# =============================================================================

# Construit l'installeur Windows (dist/GVue-Setup-x.y.z.exe)
dist: _need-node
  npm run dist

# Construit l'app décompressée (dist/win-unpacked) — plus rapide, pour tester
dist-dir: _need-node
  npm run dist:dir

# Construit l'installeur puis ouvre le dossier dist
build: dist
  @echo Installeur genere :
  @dir /b dist\*.exe
  explorer dist

# Publie une mise à jour sur GitHub (reste en .bat : token + menu interactif)
publish:
  publish.bat

# Régénère les notes « Nouveautés » depuis les messages de commit
notes: _need-node
  node scripts/gen-whatsnew.cjs

# Incrémente la version sans créer de tag git (patch | minor | major | 1.2.3)
bump level="patch": _need-node
  npm version {{level}} --no-git-tag-version
  @just notes
  @{{dev_script}} version

# =============================================================================
# Maintenance
# =============================================================================

# Supprime les artefacts de build (out/, dist/)
clean:
  -rmdir /s /q out
  -rmdir /s /q dist
  @echo Artefacts supprimes.

# Supprime aussi node_modules (réinstallation complète ensuite : just setup)
clean-all: clean
  -rmdir /s /q node_modules
  @echo node_modules supprime. Lance « just setup » pour reinstaller.

# Affiche le journal de l'application (dernières lignes)
logs lines="40":
  @{{dev_script}} logs {{lines}}

# Ouvre le dossier de données de GVue (config, journal)
data-dir:
  explorer "{{appdata}}"

# Vérifie l'environnement de développement (Node, dépendances, outils)
doctor:
  @{{dev_script}} doctor

# Affiche la commande d'enregistrement du serveur MCP dans Claude Code
mcp-cmd:
  @{{dev_script}} mcp-cmd

# Garde-fou : Node 18+ requis (dépendance des recettes qui appellent npm)
_need-node:
  @{{dev_script}} check-node
