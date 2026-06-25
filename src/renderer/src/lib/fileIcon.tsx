import {
  Folder,
  FolderGit2,
  FolderX,
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  FileArchive,
  FileCog,
  type LucideIcon
} from 'lucide-react'
import type { DirEntry } from '@shared/types'

const CODE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'py', 'rs', 'go',
  'java', 'kt', 'c', 'h', 'cpp', 'cs', 'php', 'rb', 'sh', 'ps1', 'html', 'css',
  'scss', 'sass', 'less', 'sql'
])
const IMG_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'])
const ARCHIVE_EXT = new Set(['zip', 'tar', 'gz', 'rar', '7z', 'xz'])
const CONFIG_EXT = new Set(['yml', 'yaml', 'toml', 'ini', 'env', 'lock'])

interface IconSpec {
  Icon: LucideIcon
  /** Couleur CSS (variable de thème). */
  color: string
}

/** Détermine l'icône et la couleur d'une entrée selon son type/extension. */
export function fileIconSpec(entry: DirEntry): IconSpec {
  if (entry.kind === 'directory') {
    const name = entry.name.toLowerCase()
    if (name === '.git') return { Icon: FolderGit2, color: 'var(--fg-muted)' }
    if (name === 'node_modules' || name === 'dist' || name === 'out' || name === 'build') {
      return { Icon: FolderX, color: 'var(--fg-muted)' }
    }
    return { Icon: Folder, color: 'var(--accent)' }
  }

  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'json') return { Icon: FileJson, color: 'var(--warning-fg)' }
  if (CODE_EXT.has(ext)) return { Icon: FileCode, color: 'var(--info-fg)' }
  if (IMG_EXT.has(ext)) return { Icon: FileImage, color: 'var(--success-fg)' }
  if (ARCHIVE_EXT.has(ext)) return { Icon: FileArchive, color: 'var(--fg-muted)' }
  if (CONFIG_EXT.has(ext)) return { Icon: FileCog, color: 'var(--fg-muted)' }
  if (ext === 'md' || ext === 'txt' || ext === 'log') {
    return { Icon: FileText, color: 'var(--fg-secondary)' }
  }
  return { Icon: File, color: 'var(--fg-secondary)' }
}
