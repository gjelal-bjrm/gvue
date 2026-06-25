import { useUiStore } from '../state/useUiStore'
import { useNavStore } from '../state/useNavStore'

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
