import { useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import CommandBar from './components/CommandBar'
import Sidebar from './components/Sidebar'
import FileList from './components/FileList'
import SearchPanel from './components/SearchPanel'
import QuickAccessPanel from './components/QuickAccessPanel'
import AppearancePanel from './components/AppearancePanel'
import TerminalPanel from './components/TerminalPanel'
import CommandPalette from './components/CommandPalette'
import { useNavStore } from './state/useNavStore'
import { useAppearanceStore } from './state/useAppearanceStore'
import { useUiStore } from './state/useUiStore'
import { useSearchStore } from './state/useSearchStore'
import { pathKey } from './lib/format'

export default function App(): JSX.Element {
  const initNav = useNavStore((s) => s.init)
  const initAppearance = useAppearanceStore((s) => s.init)
  const initSearch = useSearchStore((s) => s.init)
  const terminalOpen = useUiStore((s) => s.terminalOpen)
  const terminalSize = useUiStore((s) => s.terminalSize)
  const terminalGrow = useUiStore((s) => s.terminalGrow)
  const appearanceOpen = useUiStore((s) => s.appearanceOpen)
  const searchActive = useSearchStore((s) => s.active)
  const quickAccess = useNavStore((s) => s.quickAccess)
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

  // Surveillance disque : rafraîchit la vue si le dossier affiché change.
  useEffect(() => {
    return window.api.fs.onChange((changedDir) => {
      const { path, silentRefresh } = useNavStore.getState()
      if (pathKey(changedDir) === pathKey(path)) void silentRefresh()
    })
  }, [])

  // Agrandit le panneau terminal à l'exécution d'une commande, y compris quand
  // il était déjà ouvert (la taille par défaut au montage couvre le cas fermé).
  useEffect(() => {
    if (terminalGrow > 0) terminalPanelRef.current?.resize(terminalSize)
  }, [terminalGrow, terminalSize])

  // Clé de remontage : garde une disposition propre quand un panneau apparaît/disparaît.
  const vKey = `v-${terminalOpen ? 't' : ''}`
  const hKey = `h-${appearanceOpen ? 'a' : ''}`

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
                ) : quickAccess ? (
                  <QuickAccessPanel />
                ) : (
                  <FileList />
                )}
              </Panel>

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
