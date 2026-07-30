import { safeStorage } from 'electron'
import { getConfig, setConfig } from './config-store'
import { logError } from './logger'

/**
 * Mots de passe SFTP enregistrés — chiffrés par l'OS (DPAPI sous Windows,
 * Keychain sous macOS, portefeuille sous Linux) via `safeStorage` d'Electron.
 *
 * Ce que ça protège : le fichier de config ne contient QUE des blobs chiffrés,
 * illisibles depuis une autre session Windows ou une autre machine.
 * Ce que ça ne protège PAS : un programme lancé sous VOTRE session peut
 * demander le déchiffrement (même garantie que les mots de passe enregistrés
 * des navigateurs, ou de WinSCP). Les clés SSH restent préférables.
 *
 * Fonctionnalité 100 % opt-in : rien n'est enregistré sans case cochée.
 */

/** Le chiffrement OS est-il disponible (sinon : pas d'enregistrement du tout) ? */
export function secretsAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/** Enregistre (chiffré) le mot de passe d'un hôte. */
export function savePassword(hostKey: string, password: string): boolean {
  if (!secretsAvailable() || !password) return false
  try {
    const blob = safeStorage.encryptString(password).toString('base64')
    setConfig('sshPasswords', { ...getConfig('sshPasswords'), [hostKey]: blob })
    return true
  } catch (e) {
    logError('secrets', e)
    return false
  }
}

/** Mot de passe enregistré d'un hôte, ou null. */
export function loadPassword(hostKey: string): string | null {
  if (!secretsAvailable()) return null
  const blob = getConfig('sshPasswords')[hostKey]
  if (!blob) return null
  try {
    return safeStorage.decryptString(Buffer.from(blob, 'base64'))
  } catch (e) {
    // Blob illisible (profil Windows changé, config copiée d'une autre machine).
    logError('secrets', e)
    forgetPassword(hostKey)
    return null
  }
}

/** Un mot de passe est-il enregistré pour cet hôte ? */
export function hasPassword(hostKey: string): boolean {
  return Boolean(getConfig('sshPasswords')[hostKey])
}

/** Oublie le mot de passe enregistré d'un hôte. */
export function forgetPassword(hostKey: string): void {
  const all = { ...getConfig('sshPasswords') }
  if (!(hostKey in all)) return
  delete all[hostKey]
  setConfig('sshPasswords', all)
}
