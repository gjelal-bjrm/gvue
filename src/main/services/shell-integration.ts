import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fsp } from 'node:fs'
import { t } from '../i18n'

/**
 * Intégration à l'Explorateur Windows : entrée « Ouvrir dans GVue » au clic
 * droit sur un dossier (et sur le fond d'un dossier ouvert).
 *
 * Tout vit sous HKCU\Software\Classes (par-utilisateur, AUCUN droit admin),
 * activable/désactivable depuis les Paramètres — opt-in, jamais imposé.
 * L'association « explorateur par défaut » (ouvrir TOUS les dossiers avec
 * GVue) est un chantier distinct, volontairement pas ici.
 */

const exec = promisify(execFile)

const KEYS = [
  'HKCU\\Software\\Classes\\Directory\\shell\\GVue',
  'HKCU\\Software\\Classes\\Directory\\Background\\shell\\GVue',
  'HKCU\\Software\\Classes\\Drive\\shell\\GVue'
] as const

/**
 * Commande de lancement à enregistrer (pure, testable).
 * - Packagé : "GVue.exe" "%V"
 * - Dev     : "electron.exe" "<dossier de l'app>" "%V"
 * %V = dossier cliqué (ou dossier courant pour le clic sur le fond).
 */
export function launchCommand(exePath: string, appPath?: string): string {
  const appArg = appPath ? ` "${appPath}"` : ''
  return `"${exePath}"${appArg} "%V"`
}

/**
 * Les opérations `reg add` d'un enregistrement complet (pures, testables) :
 * pour chaque clé — libellé, icône, et sous-clé command.
 */
export function registryAdds(exePath: string, appPath?: string): string[][] {
  const command = launchCommand(exePath, appPath)
  const label = t('Ouvrir dans GVue')
  const out: string[][] = []
  for (const key of KEYS) {
    out.push(['add', key, '/ve', '/d', label, '/f'])
    out.push(['add', key, '/v', 'Icon', '/d', exePath, '/f'])
    out.push(['add', `${key}\\command`, '/ve', '/d', command, '/f'])
  }
  return out
}

export async function registerExplorerEntry(exePath: string, appPath?: string): Promise<boolean> {
  try {
    for (const args of registryAdds(exePath, appPath)) {
      await exec('reg', args, { windowsHide: true })
    }
    return true
  } catch {
    return false
  }
}

export async function unregisterExplorerEntry(): Promise<boolean> {
  let ok = true
  for (const key of KEYS) {
    try {
      await exec('reg', ['delete', key, '/f'], { windowsHide: true })
    } catch {
      ok = false // clé absente : sans gravité
    }
  }
  return ok
}

/** L'entrée est-elle actuellement enregistrée ? (vérité du registre.) */
export async function explorerEntryRegistered(): Promise<boolean> {
  try {
    await exec('reg', ['query', KEYS[0]], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

/**
 * Extrait le dossier passé en argument de ligne de commande (« Ouvrir dans
 * GVue », jump list…). Les candidats sont filtrés purement (candidateArgs),
 * puis validés sur le disque ici.
 */
export async function dirFromArgv(argv: string[], isPackaged: boolean): Promise<string | null> {
  for (const candidate of candidateArgs(argv, isPackaged)) {
    try {
      if ((await fsp.stat(candidate)).isDirectory()) return candidate
    } catch {
      /* n'existe pas : suivant */
    }
  }
  return null
}

/**
 * Arguments candidats (pur, testable) : ignore l'exécutable, le dossier de
 * l'app en dev, et les options « -- » d'Electron/Chromium.
 */
export function candidateArgs(argv: string[], isPackaged: boolean): string[] {
  // argv[0] = exécutable ; en dev, argv[1] = dossier de l'app.
  return argv.slice(isPackaged ? 1 : 2).filter((a) => a && !a.startsWith('-'))
}

/**
 * Valeur d'une option en ligne de commande, quelle que soit sa forme.
 *
 * Piège vérifié dans les journaux : quand GVue tourne déjà, Electron livre à
 * `second-instance` un argv où IL A INSÉRÉ ses propres options entre l'option
 * et sa valeur —
 *   `--workspace --allow-file-access-from-files --fetch-schemes=… GestFit`
 * Prendre bêtement l'élément suivant renvoyait donc un tiret, et la demande
 * était abandonnée en silence. On enjambe les options pour trouver la valeur.
 * La forme `--option=valeur` est acceptée aussi : elle, rien ne peut la couper.
 */
export function optionValue(argv: string[], option: string): string | null {
  const glued = argv.find((a) => a.startsWith(`${option}=`))
  if (glued) {
    const value = glued.slice(option.length + 1).trim()
    return value === '' ? null : value
  }
  const i = argv.indexOf(option)
  if (i === -1) return null
  for (let k = i + 1; k < argv.length; k++) {
    if (!argv[k].startsWith('-')) return argv[k]
  }
  return null
}

/**
 * Espace de travail demandé en ligne de commande (pur, testable) :
 * « GVue.exe --workspace <nom> » — utilisé par GRay pour ouvrir GVue avec le
 * profil du projet. Renvoie le nom, ou null si l'option est absente/incomplète.
 */
export function workspaceFromArgv(argv: string[]): string | null {
  return optionValue(argv, '--workspace')
}

/**
 * Mode sélecteur (pur, testable) : « GVue.exe --pick --pick-out <fichier> ».
 * Un autre outil G (GRay…) lance GVue pour choisir un fichier ; GVue écrira
 * les chemins choisis dans <fichier> puis se fermera. Renvoie le fichier de
 * sortie, ou null si le mode n'est pas demandé (ou incomplet).
 */
/**
 * « GVue.exe --git » (lancé par GRay, bouton « Git avancé » d'un dépôt) :
 * ouvrir directement le panneau Git une fois le dossier/espace chargé.
 */
export function gitFromArgv(argv: string[]): boolean {
  return argv.includes('--git')
}

export function pickOutFromArgv(argv: string[]): string | null {
  if (!argv.includes('--pick')) return null
  return optionValue(argv, '--pick-out')
}
