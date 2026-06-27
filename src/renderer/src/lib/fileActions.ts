import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { useGitStore } from '../state/useGitStore'

/**
 * Actions de presse-papiers de fichiers (couper / copier / coller), partagées
 * entre le menu contextuel et les raccourcis clavier. Le collage utilise le
 * mode mémorisé (copier ou déplacer) puis rafraîchit tous les volets.
 */

export function clipFiles(paths: string[], mode: 'copy' | 'cut'): void {
  if (paths.length > 0) useUiStore.getState().setClipboard({ paths, mode })
}

export async function pasteInto(destDir: string): Promise<void> {
  const clip = useUiStore.getState().clipboard
  if (!clip || !destDir) return
  const op = clip.mode === 'cut' ? window.api.fs.move : window.api.fs.copy
  await op(clip.paths, destDir)
  if (clip.mode === 'cut') useUiStore.getState().setClipboard(null)
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
