import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { useGitStore } from '../state/useGitStore'
import type { FileOpResult } from '@shared/types'

/**
 * Actions de presse-papiers de fichiers (couper / copier / coller), partagées
 * entre le menu contextuel et les raccourcis clavier. Le collage utilise le
 * mode mémorisé (copier ou déplacer) puis rafraîchit tous les volets.
 */

export function clipFiles(paths: string[], mode: 'copy' | 'cut'): void {
  if (paths.length > 0) useUiStore.getState().setClipboard({ paths, mode })
}

/** Message court résumant un résultat d'opération ; null si rien à signaler. */
export function opFeedback(res: FileOpResult, verb: string): string | null {
  if (res.cancelled) return `${verb} annulé(e).`
  if (res.errors.length === 0) return null
  const first = res.errors[0].length > 120 ? res.errors[0].slice(0, 120) + '…' : res.errors[0]
  if (res.ok > 0) return `${verb} : ${res.ok} réussi(s), ${res.errors.length} échec(s) — ${first}`
  return `Échec ${verb.toLowerCase()} : ${first}`
}

export async function pasteInto(destDir: string): Promise<void> {
  const clip = useUiStore.getState().clipboard
  if (!clip || !destDir) return
  const op = clip.mode === 'cut' ? window.api.fs.move : window.api.fs.copy
  const res = await op(clip.paths, destDir)
  // Un couper n'est « consommé » que si au moins un élément a bougé : un échec
  // total ne doit pas faire perdre le contenu coupé.
  if (clip.mode === 'cut' && res.ok > 0) useUiStore.getState().setClipboard(null)
  const msg = opFeedback(res, clip.mode === 'cut' ? 'Déplacement' : 'Copie')
  if (msg) useUiStore.getState().showToast(msg)
  useNavStore.getState().refreshAll()
}

/**
 * Annule la dernière opération sur fichiers (Ctrl+Z / palette), affiche un toast
 * de confirmation et rafraîchit les volets + l'état Git. Partagé entre App et la
 * palette de commandes.
 */
export async function undoLastOp(): Promise<void> {
  const res = await window.api.fs.undo()
  const ui = useUiStore.getState()
  if (res.ok) {
    ui.showToast(`Annulé : ${res.label ?? 'dernière opération'}`)
    useNavStore.getState().refreshAll()
    const git = useGitStore.getState()
    if (git.repo) void git.refresh(activePane(useNavStore.getState()).path)
  } else {
    ui.showToast(res.error ?? 'Rien à annuler.')
  }
}
