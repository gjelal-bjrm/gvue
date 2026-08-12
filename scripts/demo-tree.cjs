#!/usr/bin/env node
/*
 * Crée l'arborescence de DÉMO utilisée par le mode démo de GVue
 * (C:\Dev\gvue-demo par défaut) : trois projets fictifs, dont deux vrais
 * dépôts Git avec un historique et des modifications en cours — pour que le
 * panneau Git, le graphe et les badges soient crédibles sur les captures.
 *
 * Aucune donnée réelle : noms, contenus et messages de commit sont inventés.
 * Usage : node scripts/demo-tree.cjs [chemin]
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = process.argv[2] || 'C:\\Dev\\gvue-demo'

/** Écrit un fichier en créant les dossiers manquants. */
function write(rel, content) {
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
}

function git(cwd, args) {
  execFileSync('git', args, { cwd, stdio: 'ignore' })
}

/** Dépôt fictif avec un historique lisible. */
function repo(name, files, commits, dirtyFiles) {
  const dir = path.join(root, name)
  fs.mkdirSync(dir, { recursive: true })
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 'demo@exemple.com'])
  git(dir, ['config', 'user.name', 'Démo'])
  for (const [rel, content] of Object.entries(files)) write(path.join(name, rel), content)
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', commits[0]])
  for (const msg of commits.slice(1)) {
    write(path.join(name, 'CHANGELOG.md'), `# Journal\n\n- ${msg}\n`)
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', msg])
  }
  // Modifications non validées → badges et panneau Git non vides.
  for (const [rel, content] of Object.entries(dirtyFiles || {})) write(path.join(name, rel), content)
  return dir
}

fs.mkdirSync(root, { recursive: true })

repo(
  'boutique-web',
  {
    'README.md': '# Boutique web\n\nSite de vente en ligne (démonstration).\n',
    'package.json': JSON.stringify(
      { name: 'boutique-web', version: '2.1.0', scripts: { dev: 'vite', build: 'vite build' } },
      null,
      2
    ),
    'src/App.tsx': "export default function App() {\n  return <h1>Boutique</h1>\n}\n",
    'src/panier.ts': 'export const total = (l) => l.reduce((s, a) => s + a.prix, 0)\n',
    'src/styles.css': ':root {\n  --marque: #2f6f4f;\n}\n'
  },
  [
    'Première version de la boutique',
    'Panier : calcul du total',
    'Page produit et fiche détaillée',
    'Paiement en ligne'
  ],
  {
    'src/panier.ts': 'export const total = (l) => l.reduce((s, a) => s + a.prix * a.qte, 0)\n',
    'src/livraison.ts': 'export const fraisPort = (poids) => (poids > 2 ? 9.9 : 4.9)\n'
  }
)

repo(
  'api-commandes',
  {
    'README.md': '# API commandes\n\nService de gestion des commandes (démonstration).\n',
    'src/serveur.js': "const express = require('express')\nconst app = express()\napp.listen(3000)\n",
    'src/routes.js': "module.exports = { commandes: '/api/commandes' }\n"
  },
  ['Squelette du service', 'Routes des commandes', 'Validation des paiements'],
  {}
)

// Dossier simple (sans dépôt) pour montrer une navigation ordinaire.
write('site-vitrine/index.html', '<!doctype html>\n<h1>Site vitrine</h1>\n')
write('site-vitrine/style.css', 'body { font-family: system-ui; }\n')
write('site-vitrine/notes.md', '# Notes\n\n- Maquette validée\n- Textes à relire\n')
write('documents/facture-2026-08.pdf', '%PDF-1.4 démonstration\n')
write('documents/contrat-type.docx', 'démonstration\n')
write('images/photo-produit.png', 'démonstration\n')

console.log(`Arborescence de démo créée : ${root}`)
