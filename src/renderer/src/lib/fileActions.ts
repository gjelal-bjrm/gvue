import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { useGitStore } from '../state/useGitStore'
import { t } from '../i18n'
import type { FileOpResult, ConflictMode } from '@shared/types'

/**
 * Actions de presse-papiers de fichiers (couper / copier / coller), partagées
 * entre le menu contextuel et les raccourcis clavier. Le collage utilise le
 * mode mémorisé (copier ou déplacer) puis rafraîchit tous les volets.
 */

export function clipFiles(paths: string[], mode: 'copy' | 'cut'): void {
  if (paths.length === 0) return
  useUiStore.getState().setClipboard({ paths, mode })
  // Écrit aussi le presse-papiers *système* : les fichiers copiés dans GVue
  // se collent dans l'Explorateur Windows (et toute autre application).
  void window.api.clip.writeFiles(paths, mode === 'cut').catch(() => {})
}

/** Message court résumant un résultat d'opération ; null si rien à signaler. */
export function opFeedback(res: FileOpResult, verb: string): string | null {
  if (res.cancelled) return t('{verb} annulé(e).', { verb })
  if (res.errors.length === 0) return null
  const first = res.errors[0].length > 120 ? res.errors[0].slice(0, 120) + '…' : res.errors[0]
  if (res.ok > 0)
    return t('{verb} : {ok} réussi(s), {errCount} échec(s) — {first}', {
      verb,
      ok: res.ok,
      errCount: res.errors.length,
      first
    })
  return t('Échec {verb} : {first}', { verb: verb.toLowerCase(), first })
}

/**
 * Détecte les conflits (cibles existantes) et, s'il y en a, demande à
 * l'utilisateur via le dialogue de conflits (ConflictDialog). Résout avec le
 * mode choisi pour tout le lot, ou null si annulé.
 */
async function resolveConflictMode(paths: string[], destDir: string): Promise<ConflictMode | null> {
  const conflicts = await window.api.fs.conflicts(paths, destDir)
  if (conflicts.length === 0) return 'rename'
  return new Promise((resolve) => {
    useUiStore.getState().setConflictReq({
      conflicts,
      resolve: (m) => {
        useUiStore.getState().setConflictReq(null)
        resolve(m)
      }
    })
  })
}

/**
 * Copie/déplace avec gestion des conflits (dialogue Remplacer / Ignorer /
 * Garder les deux) + toast d'erreurs + rafraîchissement. Renvoie le résultat,
 * ou null si l'utilisateur a annulé au dialogue.
 */
export async function copyOrMove(
  op: 'copy' | 'move',
  paths: string[],
  destDir: string
): Promise<FileOpResult | null> {
  const mode = await resolveConflictMode(paths, destDir)
  if (!mode) return null
  const res = await (op === 'move' ? window.api.fs.move : window.api.fs.copy)(paths, destDir, mode)
  const msg = opFeedback(res, op === 'move' ? t('Déplacement') : t('Copie'))
  if (msg) useUiStore.getState().showToast(msg)
  useNavStore.getState().refreshAll()
  return res
}

export async function pasteInto(destDir: string): Promise<void> {
  if (!destDir) return

  // Source de vérité : le presse-papiers système (l'Explorateur y met ses
  // fichiers, et GVue y écrit aussi les siens). Repli sur le presse-papiers
  // interne si l'interop est indisponible (hors Windows, PowerShell absent…).
  let paths: string[] = []
  let move = false
  let fromSystem = false
  try {
    const sys = await window.api.clip.readFiles()
    if (sys && sys.files.length > 0) {
      paths = sys.files
      move = sys.move
      fromSystem = true
    }
  } catch {
    /* interop indisponible */
  }
  if (paths.length === 0) {
    const clip = useUiStore.getState().clipboard
    if (!clip) {
      useUiStore.getState().showToast(t('Rien à coller.'))
      return
    }
    paths = clip.paths
    move = clip.mode === 'cut'
  }

  const res = await copyOrMove(move ? 'move' : 'copy', paths, destDir)
  // Un couper n'est « consommé » que si au moins un élément a bougé : un échec
  // total (ou une annulation) ne doit pas faire perdre le contenu coupé.
  if (move && res && res.ok > 0) {
    useUiStore.getState().setClipboard(null)
    // Convention Windows : le presse-papiers est vidé après un couper-coller.
    if (fromSystem) void window.api.clip.clear().catch(() => {})
  }
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
    ui.showToast(t('Annulé : {label}', { label: res.label ?? t('dernière opération') }))
    useNavStore.getState().refreshAll()
    const git = useGitStore.getState()
    if (git.repo) void git.refresh(activePane(useNavStore.getState()).path)
  } else {
    ui.showToast(res.error ?? t('Rien à annuler.'))
  }
}
