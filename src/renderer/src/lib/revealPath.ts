import { useNavStore, activePane } from '../state/useNavStore'
import { useUiStore } from '../state/useUiStore'
import { pathKey } from './format'
import { t } from '../i18n'

/**
 * Montre un chemin dans GVue : un dossier s'ouvre, un fichier voit son dossier
 * s'ouvrir puis se retrouve sélectionné, un chemin introuvable le dit.
 * Partagé par l'outil MCP « reveal » et le clic droit du terminal.
 */
export async function revealPath(p: string, missingLabel?: string): Promise<void> {
  const norm = p.replace(/\//g, '\\')
  const kind = await window.api.fs.probe(norm).catch(() => 'missing' as const)
  const s = useNavStore.getState()
  if (kind === 'directory') {
    s.navigate(norm)
    return
  }
  if (kind === 'missing') {
    useUiStore.getState().showToast(missingLabel ?? t('Chemin introuvable — {path}', { path: p }))
    return
  }
  const cut = norm.lastIndexOf('\\')
  const parent = cut > 2 ? norm.slice(0, cut) : norm
  s.navigate(parent)
  // Attend la fin de la navigation puis sélectionne le fichier révélé.
  const t0 = Date.now()
  const tick = (): void => {
    const st = useNavStore.getState()
    const pane = activePane(st)
    if (pathKey(pane.path) === pathKey(parent) && !pane.loading) {
      const en = pane.entries.find((e) => pathKey(e.path) === pathKey(norm))
      if (en) st.setSelected([en.path])
      return
    }
    if (Date.now() - t0 < 3000) window.setTimeout(tick, 120)
  }
  tick()
}
