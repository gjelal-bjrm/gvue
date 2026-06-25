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

/** Résultat d'une création/renommage : chemin produit, ou erreur. */
export interface CreateResult {
  ok: boolean
  path?: string
  error?: string
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

/** Premier nom libre dans `dir` pour `name` (« nom », « nom (2) », « nom (3) »…). */
export async function freeName(dir: string, name: string): Promise<string> {
  const direct = path.join(dir, name)
  if (!(await exists(direct))) return direct
  const ext = path.extname(name)
  const base = path.basename(name, ext)
  for (let i = 2; ; i++) {
    const cand = path.join(dir, `${base} (${i})${ext}`)
    if (!(await exists(cand))) return cand
  }
}

function validName(name: string): boolean {
  // Pas de séparateur ni de caractère interdit par Windows.
  return name.length > 0 && !/[\\/:*?"<>|]/.test(name)
}

/** Renomme un élément dans son dossier. Erreur si le nom existe déjà ou est invalide. */
export async function rename(input: string, newName: string): Promise<CreateResult> {
  try {
    const src = assertAbsolute(input)
    const name = newName.trim()
    if (!validName(name)) return { ok: false, error: 'Nom invalide.' }
    const target = path.join(path.dirname(src), name)
    if (target === src) return { ok: true, path: src }
    if (await exists(target)) return { ok: false, error: 'Un élément porte déjà ce nom.' }
    await fs.rename(src, target)
    return { ok: true, path: target }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Crée un dossier (nom rendu unique). */
export async function createDir(dirInput: string, base: string): Promise<CreateResult> {
  try {
    const dir = assertAbsolute(dirInput)
    const target = await freeName(dir, base)
    await fs.mkdir(target)
    return { ok: true, path: target }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Crée un fichier vide (nom rendu unique). */
export async function createFile(dirInput: string, base: string): Promise<CreateResult> {
  try {
    const dir = assertAbsolute(dirInput)
    const target = await freeName(dir, base)
    await fs.writeFile(target, '', { flag: 'wx' })
    return { ok: true, path: target }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
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
