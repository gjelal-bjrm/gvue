import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { assertAbsolute, normalize } from './filesystem'

/**
 * Opérations sur fichiers (copier / déplacer) pour le glisser-déposer et le
 * presse-papiers interne. Jamais d'écrasement : en cas de collision on génère
 * un nom libre (« nom (copie) »). Gardes contre la copie/déplacement d'un
 * dossier dans lui-même ou un de ses descendants.
 */

export interface FileOpResult {
  ok: number
  errors: string[]
  /** Couples source→cible réellement effectués (pour l'annulation). */
  ops?: { from: string; to: string }[]
  /** Vrai si l'opération a été interrompue par l'utilisateur. */
  cancelled?: boolean
}

/** Au-delà de ce volume, une copie remonte sa progression (sinon trop rapide). */
export const COPY_PROGRESS_MIN = 20 * 1024 * 1024 // 20 Mo

// Drapeau d'annulation de la copie en cours (une copie à la fois côté UI).
let cancelCopyFlag = false
export function requestCancelCopy(): void {
  cancelCopyFlag = true
}

class CopyCancelled extends Error {}

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
  const res: FileOpResult = { ok: 0, errors: [], ops: [] }
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
      res.ops?.push({ from: src, to: target })
      res.ok++
    } catch (e) {
      res.errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  return res
}

/**
 * Renomme une liste d'éléments en une seule opération (renommage en masse) :
 * applique chaque (chemin → nouveau nom) séquentiellement et renvoie les couples
 * réellement effectués (source→cible) pour permettre une annulation groupée.
 * S'arrête à la première erreur, en conservant ce qui a déjà été fait.
 */
export async function renameMany(
  paths: string[],
  newNames: string[]
): Promise<FileOpResult> {
  const res: FileOpResult = { ok: 0, errors: [], ops: [] }
  for (let i = 0; i < paths.length; i++) {
    const from = paths[i]
    const r = await rename(from, newNames[i])
    if (r.ok && r.path && r.path !== normalize(from)) {
      res.ops?.push({ from: normalize(from), to: r.path })
      res.ok++
    } else if (!r.ok) {
      res.errors.push(`${path.basename(from)} : ${r.error ?? 'échec'}`)
      break
    }
  }
  return res
}

/** Taille récursive (octets) d'un chemin, tolérante aux erreurs. */
async function treeBytes(p: string): Promise<number> {
  let total = 0
  try {
    const st = await fs.lstat(p)
    if (st.isSymbolicLink()) return 0
    if (st.isDirectory()) {
      for (const e of await fs.readdir(p)) total += await treeBytes(path.join(p, e))
    } else if (st.isFile()) {
      total += st.size
    }
  } catch {
    /* chemin illisible : ignoré */
  }
  return total
}

/** Copie récursive avec rapport d'octets et prise en compte de l'annulation. */
async function copyInto(
  src: string,
  dest: string,
  onByte: (n: number, name: string) => void
): Promise<void> {
  if (cancelCopyFlag) throw new CopyCancelled()
  const st = await fs.lstat(src)
  if (st.isDirectory()) {
    await fs.mkdir(dest, { recursive: true })
    for (const e of await fs.readdir(src)) {
      await copyInto(path.join(src, e), path.join(dest, e), onByte)
    }
  } else {
    await fs.copyFile(src, dest)
    onByte(st.isFile() ? st.size : 0, path.basename(src))
    if (cancelCopyFlag) throw new CopyCancelled()
  }
}

/**
 * Copie (récursive) une liste de chemins dans un dossier, sans écrasement.
 * Au-delà de COPY_PROGRESS_MIN, remonte la progression via `onProgress` et peut
 * être interrompue (requestCancelCopy) : le dossier partiellement copié est
 * alors retiré et `cancelled` est positionné.
 */
export async function copy(
  paths: string[],
  destDirInput: string,
  onProgress?: (p: { done: number; total: number; name: string }) => void
): Promise<FileOpResult> {
  cancelCopyFlag = false
  const destDir = assertAbsolute(destDirInput)
  const res: FileOpResult = { ok: 0, errors: [], ops: [] }

  const total = (await Promise.all(paths.map((p) => treeBytes(p)))).reduce((a, b) => a + b, 0)
  const report = onProgress && total > COPY_PROGRESS_MIN ? onProgress : undefined
  let done = 0

  for (const raw of paths) {
    if (cancelCopyFlag) {
      res.cancelled = true
      break
    }
    let src: string
    try {
      src = assertAbsolute(raw)
    } catch (e) {
      res.errors.push(e instanceof Error ? e.message : String(e))
      continue
    }
    if (isInside(destDir, src)) {
      res.errors.push(`« ${path.basename(src)} » ne peut pas être placé dans lui-même.`)
      continue
    }
    const target = await uniqueTarget(destDir, path.basename(src))
    try {
      await copyInto(src, target, (n, name) => {
        done += n
        report?.({ done, total, name })
      })
      res.ops?.push({ from: src, to: target })
      res.ok++
    } catch (e) {
      if (e instanceof CopyCancelled) {
        // Retire la copie partielle (n'a jamais existé pour l'utilisateur).
        await fs.rm(target, { recursive: true, force: true }).catch(() => {})
        res.cancelled = true
        break
      }
      res.errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  return res
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
