import { promises as fsp } from 'node:fs'
import { join, dirname } from 'node:path'
import { assertAbsolute } from './filesystem'
import type { JustRecipe } from '@shared/types'

/**
 * Détection et lecture des `justfile` (https://just.systems) — très répandus
 * dans les projets de l'utilisateur. Le terminal s'en sert pour proposer les
 * recettes après « just … » (nom, paramètres, commentaire de description).
 *
 * Parsing volontairement autonome (pas d'appel à `just --dump`) : instantané,
 * sans dépendre de la présence du binaire, et tolérant aux justfiles invalides.
 */

// Noms acceptés par just (insensible à la casse selon les plateformes).
const NAMES = ['justfile', '.justfile', 'Justfile', 'JUSTFILE']

/**
 * Extrait les recettes d'un justfile. Une recette = une ligne non indentée
 * `nom param1 param2="défaut": [dépendances]`, précédée éventuellement de
 * lignes `# commentaire` qui servent de description (comme `just --list`).
 * Ignore les assignations (`x := …`), les settings (`set …`), les exports,
 * le corps des recettes (indenté) et les recettes privées (`_nom`).
 */
/**
 * Index du « : » séparant l'en-tête de recette de ses dépendances, en ignorant
 * les « := » (assignations) et le contenu des chaînes (`version="a:b"`).
 * -1 si la ligne n'est pas un en-tête de recette.
 */
function findRecipeColon(line: string): number {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      continue
    }
    if (c === ':') return line[i + 1] === '=' ? -1 : i
  }
  return -1
}

export function parseJustfile(text: string): JustRecipe[] {
  const out: JustRecipe[] = []
  const lines = text.split(/\r?\n/)
  let comment = ''

  for (const raw of lines) {
    // Corps de recette (indenté) : ne casse pas le commentaire courant.
    if (/^[ \t]/.test(raw)) continue

    const line = raw.trim()
    if (line === '') {
      comment = ''
      continue
    }
    if (line.startsWith('#')) {
      comment = line.replace(/^#+\s?/, '').trim()
      // Les bandeaux décoratifs (« ==== ») ne sont pas des descriptions.
      if (/^[=\-*_]{3,}$/.test(comment)) comment = ''
      continue
    }
    // Directives et assignations : `set x`, `export A := …`, `x := …`, `x: =`…
    if (/^(set|export|import|alias|mod)\b/.test(line) || /^[^:]*:=/.test(line)) {
      comment = ''
      continue
    }

    // Recette : « nom params... : deps ». Les paramètres peuvent contenir un
    // « = » (valeur par défaut : `version="dev"`), donc on coupe au premier
    // « : » qui n'est pas un « := ».
    const colon = findRecipeColon(line)
    if (colon < 0) {
      comment = ''
      continue
    }
    const head = line.slice(0, colon)
    const m = /^@?([A-Za-z0-9_][A-Za-z0-9_-]*)(\s.*)?$/.exec(head.trim())
    if (!m) {
      comment = ''
      continue
    }
    const name = m[1]
    const params = (m[2] ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    if (!name.startsWith('_')) {
      out.push({ name, params, description: comment })
    }
    comment = ''
  }

  // Dédoublonnage : la dernière définition d'un nom gagne (comme just).
  const byName = new Map<string, JustRecipe>()
  for (const r of out) byName.set(r.name, r)
  return [...byName.values()]
}

/** Cherche un justfile dans `dir` puis ses parents ; renvoie son chemin ou null. */
export async function findJustfile(dir: string): Promise<string | null> {
  let cur: string
  try {
    cur = assertAbsolute(dir)
  } catch {
    return null
  }
  for (let depth = 0; depth < 12; depth++) {
    for (const n of NAMES) {
      const candidate = join(cur, n)
      try {
        const st = await fsp.stat(candidate)
        if (st.isFile()) return candidate
      } catch {
        /* absent : on continue */
      }
    }
    const parent = dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return null
}

// Cache par fichier (invalidé sur mtime) : l'autocomplétion interroge à chaque
// frappe, on ne relit le disque que si le justfile a changé.
const cache = new Map<string, { mtimeMs: number; recipes: JustRecipe[] }>()

/** Recettes du justfile gouvernant `dir` (recherche ascendante), ou liste vide. */
export async function justRecipes(dir: string): Promise<JustRecipe[]> {
  const file = await findJustfile(dir)
  if (!file) return []
  try {
    const st = await fsp.stat(file)
    const hit = cache.get(file)
    if (hit && hit.mtimeMs === st.mtimeMs) return hit.recipes
    const recipes = parseJustfile(await fsp.readFile(file, 'utf8'))
    cache.set(file, { mtimeMs: st.mtimeMs, recipes })
    return recipes
  } catch {
    return []
  }
}
