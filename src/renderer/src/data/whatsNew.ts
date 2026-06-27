import data from './whatsNew.json'

/**
 * Notes de version (« Nouveautés ») affichées une fois après une mise à jour.
 * Le contenu vit dans `whatsNew.json`, généré automatiquement à partir des
 * messages de commit par `scripts/gen-whatsnew.cjs` (lancé par `publish.bat`).
 * Tu peux aussi l'éditer à la main pour curer les notes.
 */
export interface ReleaseNote {
  version: string
  date?: string
  notes: string[]
}

export const WHATS_NEW: ReleaseNote[] = data as ReleaseNote[]
