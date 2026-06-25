import { useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import CommandBar from './components/CommandBar'
import { Fragment } from 'react'
import Sidebar from './components/Sidebar'
import Pane from './components/Pane'
import SearchPanel from './components/SearchPanel'
import AppearancePanel from './components/AppearancePanel'
import PreviewPanel from './components/PreviewPanel'
import TerminalPanel from './components/TerminalPanel'
import CommandPalette from './components/CommandPalette'
import { useNavStore, activePane } from './state/useNavStore'
import { useAppearanceStore } from './state/useAppearanceStore'
import { useUiStore } from './state/useUiStore'
import { useSearchStore } from './state/useSearchStore'
import { pathKey } from './lib/format'
import { clipFiles, pasteInto } from './lib/fileActions'

export default function App(): JSX.Element {
  const initNav = useNavStore((s) => s.init)
  const initAppearance = useAppearanceStore((s) => s.init)
  const initSearch = useSearchStore((s) => s.init)
  const terminalOpen = useUiStore((s) => s.terminalOpen)
  const terminalSize = useUiStore((s) => s.terminalSize)
  const terminalGrow = useUiStore((s) => s.terminalGrow)
  const appearanceOpen = useUiStore((s) => s.appearanceOpen)
  const previewOpen = useUiStore((s) => s.previewOpen)
  const searchActive = useSearchStore((s) => s.active)
  const panes = useNavStore((s) => s.panes)
  const terminalPanelRef = useRef<ImperativePanelHandle>(null)

  useEffect(() => {
    void initAppearance()
    void initNav()
    // Abonne le store de recherche aux flux IPC (une seule fois).
    return initSearch()
  }, [initAppearance, initNav, initSearch])

  // Boutons souris précédent / suivant. Selon le pilote/OS, ils arrivent soit
  // comme événement « app-command » (relayé par le main), soit comme boutons
  // souris standards (3 = précédent, 4 = suivant) dans le renderer. On gère les
  // deux et on déduplique si jamais les deux se déclenchent pour le même clic.
  useEffect(() => {
    let lastCmd = ''
    let lastTime = 0
    const handle = (cmd: 'back' | 'forward'): void => {
      const now = Date.now()
      if (cmd === lastCmd && now - lastTime < 250) return
      lastCmd = cmd
      lastTime = now
      const { goBack, goForward } = useNavStore.getState()
      if (cmd === 'back') goBack()
      else goForward()
    }

    const offIpc = window.api.nav.onCommand(handle)

    const onMouseUp = (e: MouseEvent): void => {
      if (e.button === 3) handle('back')
      else if (e.button === 4) handle('forward')
    }
    // Supprime l'action par défaut éventuelle sur l'appui des boutons latéraux.
    const onMouseDown = (e: MouseEvent): void => {
      if (e.button === 3 || e.button === 4) e.preventDefault()
    }
    window.addEventListener('mouseup', onMouseUp, true)
    window.addEventListener('mousedown', onMouseDown, true)

    return () => {
      offIpc()
      window.removeEventListener('mouseup', onMouseUp, true)
      window.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [])

  // Palette de commandes : Ctrl+P / Ctrl+Maj+P (preventDefault évite l'impression).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        useUiStore.getState().togglePalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Presse-papiers de fichiers : Ctrl+X / Ctrl+C / Ctrl+V (hors champs de saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const pane = activePane(useNavStore.getState())
      const k = e.key.toLowerCase()
      if (k === 'c' && pane.selectedPath) {
        e.preventDefault()
        clipFiles([pane.selectedPath], 'copy')
      } else if (k === 'x' && pane.selectedPath) {
        e.preventDefault()
        clipFiles([pane.selectedPath], 'cut')
      } else if (k === 'v' && pane.path && !pane.quickAccess) {
        e.preventDefault()
        void pasteInto(pane.path)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Surveillance disque : rafraîchit chaque volet affichant le dossier changé.
  useEffect(() => {
    return window.api.fs.onChange((changedDir) => {
      const { panes: ps, silentRefresh } = useNavStore.getState()
      const key = pathKey(changedDir)
      ps.forEach((p) => {
        if (!p.quickAccess && pathKey(p.path) === key) void silentRefresh(p.id)
      })
    })
  }, [])

  // Agrandit le panneau terminal à l'exécution d'une commande, y compris quand
  // il était déjà ouvert (la taille par défaut au montage couvre le cas fermé).
  useEffect(() => {
    if (terminalGrow > 0) terminalPanelRef.current?.resize(terminalSize)
  }, [terminalGrow, terminalSize])

  // Clé de remontage : garde une disposition propre quand un panneau apparaît/disparaît.
  const vKey = `v-${terminalOpen ? 't' : ''}`
  const hKey = `h-${appearanceOpen ? 'a' : ''}-${previewOpen ? 'p' : ''}`

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <TitleBar />
      <Toolbar />
      <CommandBar />
      <CommandPalette />

      <div className="min-h-0 flex-1">
        <PanelGroup key={vKey} direction="vertical">
          <Panel minSize={30}>
            <PanelGroup key={hKey} direction="horizontal">
              <Panel defaultSize={18} minSize={12} maxSize={32}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

              <Panel minSize={30}>
                {searchActive ? (
                  <SearchPanel />
                ) : (
                  <PanelGroup key={`panes-${panes.length}`} direction="horizontal">
                    {panes.map((p, i) => (
                      <Fragment key={p.id}>
                        {i > 0 && (
                          <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />
                        )}
                        <Panel minSize={20}>
                          <Pane paneId={p.id} />
                        </Panel>
                      </Fragment>
                    ))}
                  </PanelGroup>
                )}
              </Panel>

              {previewOpen && (
                <>
                  <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />
                  <Panel defaultSize={26} minSize={18} maxSize={45}>
                    <PreviewPanel />
                  </Panel>
                </>
              )}

              {appearanceOpen && (
                <>
                  <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />
                  <Panel defaultSize={20} minSize={15} maxSize={34}>
                    <AppearancePanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {terminalOpen && (
            <>
              <PanelResizeHandle className="h-px bg-border transition-colors hover:bg-accent" />
              <Panel ref={terminalPanelRef} defaultSize={terminalSize} minSize={12} maxSize={80}>
                <TerminalPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  )
}
