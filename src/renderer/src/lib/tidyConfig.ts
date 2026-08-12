import type { TidyConfig } from '@shared/types'

/**
 * Accès à la config du rangement auto avec la règle d'or : toute BASCULE
 * relit l'état FRAIS du disque au moment du clic. Un composant monté depuis
 * longtemps (item de sidebar…) qui écrirait son objet local périmé
 * écraserait les règles éditées entre-temps ailleurs — vécu : l'activation
 * depuis la sidebar effaçait les règles, donc le watcher ne démarrait pas.
 */

const DEFAULT: TidyConfig = { enabled: false, watchDir: '', rules: [] }

export async function readTidy(): Promise<TidyConfig> {
  try {
    return (await window.api.config.get('tidy')) ?? DEFAULT
  } catch {
    return DEFAULT
  }
}

/** Active/désactive sur la base de l'état frais ; renvoie le nouvel état. */
export async function setTidyEnabled(enabled: boolean): Promise<TidyConfig> {
  const cur = await readTidy()
  const next = { ...cur, enabled }
  await window.api.config.set('tidy', next)
  return next
}
