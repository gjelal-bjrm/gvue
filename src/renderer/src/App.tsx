import { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import CommandBar from './components/CommandBar'
import Sidebar from './components/Sidebar'
import FileList from './components/FileList'
import SearchPanel from './components/SearchPanel'
import AppearancePanel from './components/AppearancePanel'
import TerminalPanel from './components/TerminalPanel'
import { useNavStore } from './state/useNavStore'
import { useAppearanceStore } from './state/useAppearanceStore'
import { useUiStore } from './state/useUiStore'
import { useSearchStore } from './state/useSearchStore'

export default function App(): JSX.Element {
  const initNav = useNavStore((s) => s.init)
  const initAppearance = useAppearanceStore((s) => s.init)
  const initSearch = useSearchStore((s) => s.init)
  const terminalOpen = useUiStore((s) => s.terminalOpen)
  const appearanceOpen = useUiStore((s) => s.appearanceOpen)
  const searchActive = useSearchStore((s) => s.active)

  useEffect(() => {
    void initAppearance()
    void initNav()
    // Abonne le store de recherche aux flux IPC (une seule fois).
    return initSearch()
  }, [initAppearance, initNav, initSearch])

  // Clé de remontage : garde une disposition propre quand un panneau apparaît/disparaît.
  const vKey = `v-${terminalOpen ? 't' : ''}`
  const hKey = `h-${appearanceOpen ? 'a' : ''}`

  return (
    <div className="flex h-full flex-col bg-bg text-fg" style={{ opacity: 'var(--window-opacity)' }}>
      <TitleBar />
      <Toolbar />
      <CommandBar />

      <div className="min-h-0 flex-1">
        <PanelGroup key={vKey} direction="vertical">
          <Panel minSize={30}>
            <PanelGroup key={hKey} direction="horizontal">
              <Panel defaultSize={18} minSize={12} maxSize={32}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

              <Panel minSize={30}>
                {searchActive ? <SearchPanel /> : <FileList />}
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
              <Panel defaultSize={28} minSize={12} maxSize={60}>
                <TerminalPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  )
}
