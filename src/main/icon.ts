import { app } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Chemin de l'icône de l'application, utilisable en dev comme en production.
 * - Dev : `build/icon.png` à la racine du projet.
 * - Packagé : `resources/icon.png` (copié via `extraResources`, car `build/`
 *   est exclu de l'asar).
 * Renvoie null si introuvable (l'appelant peut alors s'en passer).
 */
export function appIconPath(): string | null {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'icon.png')]
    : [join(app.getAppPath(), 'build', 'icon.png')]
  return candidates.find((p) => existsSync(p)) ?? null
}
