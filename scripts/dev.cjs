#!/usr/bin/env node
/**
 * Utilitaires de développement appelés par le justfile.
 *
 * Pourquoi un script plutôt que des one-liners dans le justfile : sous Windows,
 * `just` exécute chaque ligne via `cmd /c`, qui mange les guillemets imbriqués
 * (`node -e "console.log('x')"` arrive tronqué). Tout ce qui a besoin de
 * guillemets vit donc ici, et le justfile n'appelle que `node scripts/dev.cjs …`.
 *
 * Sous-commandes : check-node · doctor · logs [n] · mcp-cmd · version
 */
const fs = require('node:fs')
const path = require('node:path')
const cp = require('node:child_process')

const root = path.join(__dirname, '..')
const MIN_NODE = 18

/** Version majeure de Node en cours. */
function nodeMajor() {
  return Number(process.versions.node.split('.')[0])
}

/** Dossier de données de GVue (electron-store / journal). */
function appDataDir() {
  const appdata =
    process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
  return path.join(appdata, 'gvue')
}

/** Version déclarée dans package.json. */
function pkgVersion() {
  return require(path.join(root, 'package.json')).version
}

/** L'exécutable est-il présent dans le PATH ? */
function hasCommand(exe) {
  try {
    cp.execFileSync(process.platform === 'win32' ? 'where' : 'which', [exe], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Sortie d'une commande, ou un message d'indisponibilité.
 * `shell: true` sous Windows : npm/npx sont des .cmd, introuvables sinon.
 */
function tryExec(cmd, args) {
  try {
    return cp
      .execFileSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' })
      .trim()
  } catch {
    return 'introuvable'
  }
}

/* ------------------------------ Sous-commandes ---------------------------- */

/** Garde-fou : Node 18+ requis (dépendance des recettes qui appellent npm). */
function checkNode() {
  if (nodeMajor() < MIN_NODE) {
    console.error(
      `[ERREUR] Node ${process.versions.node} est trop ancien : GVue exige Node ${MIN_NODE}+ (20 LTS recommande).`
    )
    process.exit(1)
  }
}

function doctor() {
  const ok = (label, value) => console.log(`  ${label.padEnd(14)} ${value}`)

  console.log('=== Environnement ===')
  ok('Node', `${process.versions.node} ${nodeMajor() < MIN_NODE ? '(TROP ANCIEN, 18+ requis)' : 'OK'}`)
  ok('npm', tryExec('npm', ['-v']))
  ok('git', tryExec('git', ['--version']).replace('git version ', ''))
  ok('just', hasCommand('just') ? 'trouve' : 'absent du PATH')

  console.log('\n=== Projet ===')
  ok('GVue', `v${pkgVersion()}`)
  ok(
    'node_modules',
    fs.existsSync(path.join(root, 'node_modules')) ? 'present' : 'ABSENT (lance just setup)'
  )
  ok(
    'node-pty',
    fs.existsSync(path.join(root, 'node_modules', 'node-pty', 'build'))
      ? 'compile (terminal integre OK)'
      : 'non compile (terminal indisponible, lance just rebuild)'
  )
  // Installeurs : seulement le plus récent (le dossier en accumule beaucoup).
  const dist = path.join(root, 'dist')
  const installers = fs.existsSync(dist)
    ? fs
        .readdirSync(dist)
        .filter((f) => f.endsWith('.exe'))
        .map((f) => ({ f, mtime: fs.statSync(path.join(dist, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
    : []
  ok(
    'dist/',
    installers.length
      ? `${installers[0].f}${installers.length > 1 ? ` (+${installers.length - 1} autres)` : ''}`
      : 'aucun installeur'
  )

  console.log('\n=== Outils optionnels ===')
  ok('7-Zip', hasCommand('7z') ? 'trouve' : 'absent (archives limitees au zip)')
  ok('ripgrep', hasCommand('rg') ? 'trouve (systeme)' : 'fourni par @vscode/ripgrep')

  console.log('\n=== Donnees ===')
  const log = path.join(appDataDir(), 'logs', 'gvue.log')
  ok('config', fs.existsSync(appDataDir()) ? appDataDir() : 'aucune (app jamais lancee)')
  ok('journal', fs.existsSync(log) ? log : 'aucun')
}

/** Affiche les N dernières lignes du journal de l'application. */
function logs(arg) {
  const n = Math.max(1, Number(arg) || 40)
  const file = path.join(appDataDir(), 'logs', 'gvue.log')
  if (!fs.existsSync(file)) {
    console.log(`Aucun journal : ${file}`)
    console.log("(le fichier apparait au premier lancement de l'application)")
    return
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)
  console.log(lines.slice(-n).join('\n'))
}

/** Commande d'enregistrement du pont MCP côté Claude Code. */
function mcpCmd() {
  const bridge = path.join(root, 'scripts', 'gvue-mcp.cjs')
  console.log("1. Active le serveur MCP dans GVue : Parametres > General > Serveur MCP")
  console.log('2. Enregistre-le aupres de Claude Code :')
  console.log(`\n   claude mcp add gvue -- node "${bridge}"\n`)
  console.log('3. Ouvre une NOUVELLE session Claude Code (les outils MCP se chargent au demarrage).')
}

/* --------------------------------- Routage -------------------------------- */

const [, , command, arg] = process.argv
switch (command) {
  case 'check-node':
    checkNode()
    break
  case 'doctor':
    doctor()
    break
  case 'logs':
    logs(arg)
    break
  case 'mcp-cmd':
    mcpCmd()
    break
  case 'version':
    console.log(pkgVersion())
    break
  default:
    console.error(`Sous-commande inconnue : ${command ?? '(aucune)'}`)
    console.error('Attendu : check-node | doctor | logs [n] | mcp-cmd | version')
    process.exit(1)
}
