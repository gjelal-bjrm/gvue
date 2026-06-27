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
import FileFinder from './components/FileFinder'
import DiskUsage from './components/DiskUsage'
import GitPanel from './components/GitPanel'
import UpdateBanner from './components/UpdateBanner'
import { useNavStore, activePane } from './state/useNavStore'
import { useGitStore } from './state/useGitStore'
import { useFavoritesStore } from './state/useFavoritesStore'
import { useAppsStore } from './state/useAppsStore'
import { useOpenWithStore } from './state/useOpenWithStore'
import { useWorkspaceStore } from './state/useWorkspaceStore'
import { useRunnerStore } from './state/useRunnerStore'
import { useAppearanceStore } from './state/useAppearanceStore'
import { useUiStore } from './state/useUiStore'
import { useSearchStore } from './state/useSearchStore'
import { useUpdateStore } from './state/useUpdateStore'
import { pathKey, baseName } from './lib/format'
import { clipFiles, pasteInto } from './lib/fileActions'

export default function App(): JSX.Element {
  const initNav = useNavStore((s) => s.init)
  const initAppearance = useAppearanceStore((s) => s.init)
  const initSearch = useSearchStore((s) => s.init)
  const initFavorites = useFavoritesStore((s) => s.init)
  const initApps = useAppsStore((s) => s.init)
  const initOpenWith = useOpenWithStore((s) => s.init)
  const initWorkspaces = useWorkspaceStore((s) => s.init)
  const initRunner = useRunnerStore((s) => s.init)
  const terminalOpen = useUiStore((s) => s.terminalOpen)
  const terminalSize = useUiStore((s) => s.terminalSize)
  const terminalGrow = useUiStore((s) => s.terminalGrow)
  const appearanceOpen = useUiStore((s) => s.appearanceOpen)
  const previewOpen = useUiStore((s) => s.previewOpen)
  const gitViewOpen = useUiStore((s) => s.gitViewOpen)
  const searchActive = useSearchStore((s) => s.active)
  const panes = useNavStore((s) => s.panes)
  const terminalPanelRef = useRef<ImperativePanelHandle>(null)

  useEffect(() => {
    void initAppearance()
    void initNav()
    void initFavorites()
    void initApps()
    void initOpenWith()
    void initWorkspaces()
    void initRunner()
    // Abonne le store de recherche aux flux IPC (une seule fois).
    return initSearch()
  }, [
    initAppearance,
    initNav,
    initSearch,
    initFavorites,
    initApps,
    initOpenWith,
    initWorkspaces,
    initRunner
  ])

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
  // Ctrl+Maj+N : nouvelle fenêtre GVue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        useUiStore.getState().togglePalette()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        void window.api.window.new()
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault()
        useUiStore.getState().toggleFileFinder()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Raccourcis fichiers : Ctrl+X/C/V/A, F2 (renommer), Suppr (corbeille).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const s = useNavStore.getState()
      const pane = activePane(s)
      if (pane.quickAccess) return
      const ctrl = (e.ctrlKey || e.metaKey) && !e.altKey

      if (ctrl && !e.shiftKey) {
        const k = e.key.toLowerCase()
        if (k === 'c' && pane.selected.length) {
          e.preventDefault()
          clipFiles(pane.selected, 'copy')
        } else if (k === 'x' && pane.selected.length) {
          e.preventDefault()
          clipFiles(pane.selected, 'cut')
        } else if (k === 'v' && pane.path) {
          e.preventDefault()
          void pasteInto(pane.path)
        } else if (k === 'a' && pane.path) {
          e.preventDefault()
          const ignored = useGitStore.getState().ignored
          const all = pane.entries.filter(
            (en) =>
              (s.showHidden || !en.hidden) &&
              !(s.hideGitIgnored && ignored.has(pathKey(en.path)))
          )
          s.setSelected(all.map((en) => en.path))
        }
      } else if (e.key === 'F2' && pane.selected.length === 1) {
        e.preventDefault()
        s.setRenaming(pane.selected[0])
      } else if (e.key === 'Delete' && pane.selected.length) {
        e.preventDefault()
        const toTrash = pane.selected
        void (async () => {
          for (const p of toTrash) {
            try {
              await window.api.fs.trash(p)
            } catch {
              /* ignore */
            }
          }
          s.setSelected([])
          s.refreshAll()
        })()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Actions du plateau système (tray) : ouvrir un dossier, lancer un lancement/
  // profil, charger un espace de travail. Les stores sont (ré)initialisés si
  // l'action arrive avant leur chargement (fenêtre fraîchement ouverte).
  useEffect(() => {
    // Tolère un preload plus ancien (décalage HMR en dev) : pas de plantage.
    const tray = window.api.tray
    if (!tray) return
    const offOpen = tray.onOpenPath((path) => {
      useSearchStore.getState().close()
      void useNavStore.getState().navigate(path)
    })
    const offRun = tray.onRunTask(async (id) => {
      let r = useRunnerStore.getState()
      if (!r.tasks.length && !r.profiles.length) {
        await r.init()
        r = useRunnerStore.getState()
      }
      if (r.tasks.some((t) => t.id === id)) void r.runTask(id)
      else if (r.profiles.some((p) => p.id === id)) void r.runProfile(id)
    })
    const offRunProj = tray.onRunProject(async (root) => {
      let r = useRunnerStore.getState()
      if (!Object.keys(r.projectLaunch).length) {
        await r.init()
        r = useRunnerStore.getState()
      }
      void r.runProject(root, baseName(root))
    })
    const offWs = tray.onLoadWorkspace(async (name) => {
      let w = useWorkspaceStore.getState()
      if (!w.workspaces[name]) {
        await w.init()
        w = useWorkspaceStore.getState()
      }
      void w.load(name)
    })
    return () => {
      offOpen()
      offRun()
      offRunProj()
      offWs()
    }
  }, [])

  // Système de mise à jour : statut courant + abonnement aux changements.
  useEffect(() => {
    return useUpdateStore.getState().init()
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
      <UpdateBanner />
      <CommandPalette />
      <FileFinder />
      <DiskUsage />

      <div className="min-h-0 flex-1">
        <PanelGroup key={vKey} autoSaveId="gvue:vertical" direction="vertical">
          <Panel minSize={30}>
            <PanelGroup key={hKey} autoSaveId="gvue:horizontal" direction="horizontal">
              <Panel defaultSize={18} minSize={12} maxSize={32}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

              <Panel minSize={30}>
                {gitViewOpen ? (
                  <GitPanel />
                ) : searchActive ? (
                  <SearchPanel />
                ) : (
                  <PanelGroup key={`panes-${panes.length}`} autoSaveId="gvue:panes" direction="horizontal">
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
