set windows-shell := ["cmd", "/c"]

# Dossier de données de GVue (config, journal) — utile pour doctor/logs/clean-config.
appdata := join(env_var('APPDATA'), 'gvue')

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

# Recompile node-pty pour l'ABI d'Electron (terminal intégré)
rebuild:
  # Échec toléré : sans outils de build C++, seul le terminal est indisponible.
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

# Publie une mise à jour sur GitHub (assistant interactif : version, notes, upload)
publish:
  # Reste en .bat : saisie du token et menu interactif (juste relayé ici).
  publish.bat

# Régénère les notes « Nouveautés » depuis les messages de commit
notes: _need-node
  node scripts/gen-whatsnew.cjs

# Incrémente la version sans créer de tag git (patch | minor | major | 1.2.3)
bump level="patch": _need-node
  npm version {{level}} --no-git-tag-version
  @just notes
  @node -p "'Version : ' + require('./package.json').version"

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
  @powershell -NoProfile -Command "Get-Content -Tail {{lines}} '{{appdata}}\logs\gvue.log'"

# Ouvre le dossier de données de GVue (config, journal)
data-dir:
  explorer "{{appdata}}"

# Vérifie l'environnement de développement (Node, dépendances, outils)
doctor:
  @echo === Environnement ===
  @node -v
  @npm -v
  @git --version
  @echo.
  @echo === Projet ===
  @node -p "'GVue v' + require('./package.json').version"
  @node -e "const e=require('fs').existsSync; console.log(e('node_modules') ? 'node_modules : present' : 'node_modules : ABSENT (lance just setup)'); console.log(e('node_modules/node-pty/build') ? 'node-pty : compile (terminal integre OK)' : 'node-pty : non compile (terminal indisponible, lance just rebuild)')"
  @echo.
  @echo === Outils optionnels ===
  @where 7z >nul 2>nul && echo 7-Zip : trouve || echo 7-Zip : absent (archives limitees au zip)
  @echo ripgrep : fourni par @vscode/ripgrep

# Affiche la commande d'enregistrement du serveur MCP dans Claude Code
mcp-cmd:
  @echo Active d'abord le serveur MCP : GVue - Parametres - General - Serveur MCP
  @echo Puis enregistre-le :
  @echo   claude mcp add gvue -- node "{{justfile_directory()}}\scripts\gvue-mcp.cjs"

# Garde-fou : Node 18+ requis (dépendance des recettes qui appellent npm)
_need-node:
  @node -e "if (+process.versions.node.split('.')[0] < 18) { console.error('[ERREUR] Node ' + process.versions.node + ' est trop ancien : GVue exige Node 18+ (20 LTS recommande).'); process.exit(1) }"
