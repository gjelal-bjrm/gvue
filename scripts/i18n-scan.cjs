#!/usr/bin/env node
/*
 * Filet de couverture i18n : liste les chaînes visiblement françaises
 * (caractères accentués ou guillemets « ») qui ne passent PAS par t()/tn().
 *
 * Heuristique, pas un parseur : les commentaires sont retirés, puis chaque
 * littéral de chaîne ou texte JSX accentué est signalé sauf si l'appel t(
 * le précède immédiatement. Les journaux développeur (logInfo, console…)
 * et les tests sont ignorés — ils restent en français à dessein.
 *
 * Usage : node scripts/i18n-scan.cjs [--count]
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOTS = ['src/renderer/src', 'src/main', 'src/preload']
const IGNORE_DIRS = new Set(['i18n'])
// updater-errors.ts : renvoie des clés françaises traduites PAR L'APPELANT
// (t(friendlyUpdateError(msg))) — même statut que les dictionnaires.
const IGNORE_FILES = [/\.test\.tsx?$/, /i18n-en\.ts$/, /updater-errors\.ts$/]
// Lignes développeur : jamais montrées à l'utilisateur.
const DEV_LINE = /logInfo|logError|logWarn|console\.|\.report\(|throw new Error/

const ACCENTED = /[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ«»]/

function stripComments(src) {
  // Chaînes préservées, commentaires // et /* */ remplacés par des espaces.
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))
}

function scanFile(file) {
  const src = stripComments(fs.readFileSync(file, 'utf8'))
  const lines = src.split('\n')
  const hits = []
  const litRe = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g
  const jsxRe = />([^<>{}\n]*[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ«»][^<>{}\n]*)</g

  lines.forEach((line, i) => {
    if (DEV_LINE.test(line)) return
    let m
    litRe.lastIndex = 0
    while ((m = litRe.exec(line))) {
      if (!ACCENTED.test(m[2])) continue
      const before = line.slice(Math.max(0, m.index - 4), m.index)
      if (/\bt\($|\btn\($|,\s?$/.test(before) && /\b(t|tn)\(/.test(line.slice(0, m.index)))
        continue
      hits.push({ line: i + 1, text: m[2].slice(0, 70) })
    }
    jsxRe.lastIndex = 0
    while ((m = jsxRe.exec(line))) {
      const text = m[1].trim()
      if (text) hits.push({ line: i + 1, text: text.slice(0, 70) })
    }
  })
  return hits
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) walk(full, out)
    } else if (/\.(ts|tsx)$/.test(e.name) && !IGNORE_FILES.some((r) => r.test(e.name))) {
      out.push(full)
    }
  }
  return out
}

const root = path.resolve(__dirname, '..')
let total = 0
const byFile = []
for (const r of ROOTS) {
  for (const f of walk(path.join(root, r))) {
    const hits = scanFile(f)
    if (hits.length) {
      total += hits.length
      byFile.push({ file: path.relative(root, f), hits })
    }
  }
}

byFile.sort((a, b) => b.hits.length - a.hits.length)

if (process.argv.includes('--count')) {
  for (const { file, hits } of byFile) console.log(`${String(hits.length).padStart(4)}  ${file}`)
  console.log(`\nTotal : ${total} chaînes hors t()`)
} else {
  for (const { file, hits } of byFile) {
    console.log(`\n${file} (${hits.length})`)
    for (const h of hits.slice(0, 12)) console.log(`  ${String(h.line).padStart(4)}: ${h.text}`)
    if (hits.length > 12) console.log(`  … et ${hits.length - 12} autres`)
  }
  console.log(`\nTotal : ${total} chaînes hors t()`)
}
