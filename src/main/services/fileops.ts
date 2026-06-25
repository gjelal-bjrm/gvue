import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { assertAbsolute } from './filesystem'

/**
 * Opérations sur fichiers (copier / déplacer) pour le glisser-déposer et le
 * presse-papiers interne. Jamais d'écrasement : en cas de collision on génère
 * un nom libre (« nom (copie) »). Gardes contre la copie/déplacement d'un
 * dossier dans lui-même ou un de ses descendants.
 */

export interface FileOpResult {
  ok: number
  errors: string[]
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/** Premier chemin libre dans `destDir` pour `name` (« nom (copie) », « (copie 2) »…). */
async function uniqueTarget(destDir: string, name: string): Promise<string> {
  const direct = path.join(destDir, name)
  if (!(await exists(direct))) return direct
  const ext = path.extname(name)
  const base = path.basename(name, ext)
  for (let i = 1; ; i++) {
    const suffix = i === 1 ? ' (copie)' : ` (copie ${i})`
    const cand = path.join(destDir, `${base}${suffix}${ext}`)
    if (!(await exists(cand))) return cand
  }
}

/** Vrai si `child` est égal à `parent` ou situé sous lui. */
function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

async function eachInto(
  paths: string[],
  destDirInput: string,
  op: (src: string, target: string) => Promise<void>,
  sameDirIsNoop: boolean
): Promise<FileOpResult> {
  const destDir = assertAbsolute(destDirInput)
  const res: FileOpResult = { ok: 0, errors: [] }
  for (const raw of paths) {
    try {
      const src = assertAbsolute(raw)
      if (isInside(destDir, src)) {
        res.errors.push(`« ${path.basename(src)} » ne peut pas être placé dans lui-même.`)
        continue
      }
      if (sameDirIsNoop && path.dirname(src) === destDir) {
        res.ok++ // déplacer dans le même dossier : rien à faire
        continue
      }
      const target = await uniqueTarget(destDir, path.basename(src))
      await op(src, target)
      res.ok++
    } catch (e) {
      res.errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  return res
}

/** Copie (récursive) une liste de chemins dans un dossier. */
export function copy(paths: string[], destDir: string): Promise<FileOpResult> {
  return eachInto(paths, destDir, (src, target) => fs.cp(src, target, { recursive: true }), false)
}

/** Déplace une liste de chemins dans un dossier (rename, repli copie+suppr inter-volumes). */
export function move(paths: string[], destDir: string): Promise<FileOpResult> {
  return eachInto(
    paths,
    destDir,
    async (src, target) => {
      try {
        await fs.rename(src, target)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
          // Volumes différents : rename impossible → copie puis suppression.
          await fs.cp(src, target, { recursive: true })
          await fs.rm(src, { recursive: true, force: true })
        } else {
          throw e
        }
      }
    },
    true
  )
}
