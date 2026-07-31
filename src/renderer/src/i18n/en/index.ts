import { core } from './core'
import { toolbar } from './toolbar'
import { sidebar } from './sidebar'
import { filelist } from './filelist'
import { fileops } from './fileops'
import { git } from './git'
import { terminal } from './terminal'
import { ssh } from './ssh'
import { settings } from './settings'
import { misc } from './misc'

/**
 * Dictionnaire anglais : français (clé exacte, gabarits {x} compris) → anglais.
 * Découpé par domaine pour rester relisible ; en cas de doublon entre parties,
 * la dernière gagne (sans conséquence si les traductions sont identiques).
 */
export const EN: Record<string, string> = {
  ...core,
  ...toolbar,
  ...sidebar,
  ...filelist,
  ...fileops,
  ...git,
  ...terminal,
  ...ssh,
  ...settings,
  ...misc
}
