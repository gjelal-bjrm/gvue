#!/usr/bin/env node
// Remplace l'installeur par sa version signée (dist-signed/) puis met à jour
// dist/latest.yml + .blockmap. L'auto-update vérifie le sha512 : sans cette
// étape, une mise à jour signée serait REJETÉE par les clients (le hash de
// l'exe change à la signature). Utilisé par release.yml après SignPath.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const dist = path.join(__dirname, '..', 'dist')
const signedDir = path.join(__dirname, '..', 'dist-signed')
const exeName = fs.readdirSync(dist).find((f) => f.endsWith('.exe'))
if (!exeName) throw new Error('Aucun .exe dans dist/')
const signed = path.join(signedDir, exeName)
if (!fs.existsSync(signed)) throw new Error(`Binaire signé introuvable : ${signed}`)

// 1) Remplace l'exe par la version signée.
fs.copyFileSync(signed, path.join(dist, exeName))

// 2) Régénère le blockmap (app-builder est livré avec electron-builder) et
//    récupère size/sha512/blockMapSize depuis sa sortie JSON — le sha512 est
//    en base64, exactement le format attendu par latest.yml.
const appBuilder = path.join(
  __dirname, '..', 'node_modules', 'app-builder-bin', 'win', 'x64', 'app-builder.exe'
)
const out = execFileSync(appBuilder, [
  'blockmap',
  '--input', path.join(dist, exeName),
  '--output', path.join(dist, exeName + '.blockmap')
]).toString()
const { size, sha512, blockMapSize } = JSON.parse(out)

// 3) Patch latest.yml (une seule entrée de fichier dans ce projet).
const ymlPath = path.join(dist, 'latest.yml')
let yml = fs.readFileSync(ymlPath, 'utf8')
yml = yml
  .replace(/sha512: .+/g, `sha512: ${sha512}`)
  .replace(/size: \d+/g, `size: ${size}`)
  .replace(/blockMapSize: \d+/g, `blockMapSize: ${blockMapSize}`)
fs.writeFileSync(ymlPath, yml)
console.log(`[fix-latest-yml] ${exeName} signé : sha512/size/blockMapSize mis à jour.`)
