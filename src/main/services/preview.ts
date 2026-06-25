import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { assertAbsolute } from './filesystem'
import type { PreviewData, PreviewKind } from '@shared/types'

/**
 * Service d'aperçu de fichier — lit un extrait sûr et borné selon le type.
 * 100 % local, jamais bloquant. Pas de dépendance : la coloration/markdown se
 * fait côté renderer.
 */

const TEXT_MAX = 512 * 1024 // 512 Ko de texte lus au plus
const IMAGE_MAX = 8 * 1024 * 1024 // 8 Mo pour un aperçu image
const SNIFF = 8192 // octets échantillonnés pour deviner texte/binaire

const IMG_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml'
}

const CODE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'py', 'rs', 'go',
  'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'php', 'rb', 'sh', 'bash',
  'zsh', 'ps1', 'bat', 'html', 'css', 'scss', 'sass', 'less', 'sql', 'lua',
  'r', 'swift', 'dart', 'yml', 'yaml', 'toml', 'ini', 'xml', 'gradle', 'dockerfile'
])
const TEXT_EXT = new Set(['txt', 'log', 'csv', 'tsv', 'env', 'gitignore', 'gitattributes', 'editorconfig'])

function extOf(name: string): string {
  const base = name.toLowerCase()
  // Fichiers « dotfiles » sans extension classique (.gitignore, Dockerfile…).
  if (base === 'dockerfile') return 'dockerfile'
  const dot = base.lastIndexOf('.')
  return dot >= 0 ? base.slice(dot + 1) : base.replace(/^\./, '')
}

/** Lit au plus `maxBytes` octets d'un fichier (UTF-8), en signalant la troncature. */
async function readHead(file: string, size: number, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (size <= maxBytes) {
    return { text: await fs.readFile(file, 'utf8'), truncated: false }
  }
  const handle = await fs.open(file, 'r')
  try {
    const buf = Buffer.alloc(maxBytes)
    const { bytesRead } = await handle.read(buf, 0, maxBytes, 0)
    return { text: buf.subarray(0, bytesRead).toString('utf8'), truncated: true }
  } finally {
    await handle.close()
  }
}

/** Échantillonne le début du fichier pour distinguer texte et binaire. */
async function looksBinary(file: string): Promise<boolean> {
  const handle = await fs.open(file, 'r')
  try {
    const buf = Buffer.alloc(SNIFF)
    const { bytesRead } = await handle.read(buf, 0, SNIFF, 0)
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true // octet nul → binaire
    }
    return false
  } finally {
    await handle.close()
  }
}

export async function readPreview(input: string): Promise<PreviewData> {
  const file = assertAbsolute(input)
  const st = await fs.stat(file)
  const name = path.basename(file)
  const base: Omit<PreviewData, 'kind'> = {
    name,
    path: file,
    size: st.size,
    modifiedMs: st.mtimeMs
  }

  if (st.isDirectory()) {
    return { ...base, kind: 'binary', note: 'Dossier' }
  }

  const ext = extOf(name)

  // Image → data URL (bornée en taille).
  if (IMG_MIME[ext]) {
    if (st.size > IMAGE_MAX) {
      return { ...base, kind: 'binary', lang: ext, note: 'Image trop volumineuse pour l’aperçu.' }
    }
    const buf = await fs.readFile(file)
    return { ...base, kind: 'image', lang: ext, content: `data:${IMG_MIME[ext]};base64,${buf.toString('base64')}` }
  }

  // Catégorie texte selon l'extension, sinon détection texte/binaire.
  let kind: PreviewKind | null = null
  if (ext === 'json') kind = 'json'
  else if (ext === 'md' || ext === 'markdown') kind = 'markdown'
  else if (CODE_EXT.has(ext)) kind = 'code'
  else if (TEXT_EXT.has(ext)) kind = 'text'

  if (kind === null) {
    if (st.size === 0) return { ...base, kind: 'text', content: '' }
    kind = (await looksBinary(file)) ? 'binary' : 'text'
  }

  if (kind === 'binary') {
    return { ...base, kind: 'binary', lang: ext, note: 'Fichier binaire — aperçu indisponible.' }
  }

  const { text, truncated } = await readHead(file, st.size, TEXT_MAX)
  return { ...base, kind, lang: ext, content: text, truncated }
}
