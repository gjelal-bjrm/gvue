import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import CommandBar from './components/CommandBar'
import { Fragment } from 'react'
import Sidebar from './components/Sidebar'
import Pane from './components/Pane'
import SearchPanel from './components/SearchPanel'
import SettingsPanel from './components/SettingsPanel'
import PreviewPanel from './components/PreviewPanel'
// Chargé à la demande : le chunk xterm (~450 ko) n'est tiré qu'à l'affichage
// du premier terminal (voir aussi lib/terminalBridge, qui découple les stores).
const TerminalPanel = lazy(() => import('./components/TerminalPanel'))
import CommandPalette from './components/CommandPalette'
import FileFinder from './components/FileFinder'
import DiskUsage from './components/DiskUsage'
import RecycleBin from './components/RecycleBin'
import RemoteExplorer from './components/RemoteExplorer'
import FolderCreator from './components/FolderCreator'
import WhatsNew from './components/WhatsNew'
import GitPanel from './components/GitPanel'
import UpdateBanner from './components/UpdateBanner'
import { useNavStore, activePane } from './state/useNavStore'
import { useGitStore } from './state/useGitStore'
import { useTerminalStore } from './state/useTerminalStore'
import { useFavoritesStore } from './state/useFavoritesStore'
import { useAppsStore } from './state/useAppsStore'
import { useOpenWithStore } from './state/useOpenWithStore'
import { useWorkspaceStore } from './state/useWorkspaceStore'
import { useRunnerStore } from './state/useRunnerStore'
import { useAppearanceStore } from './state/useAppearanceStore'
import { useUiStore } from './state/useUiStore'
import { useSearchStore } from './state/useSearchStore'
import { useUpdateStore } from './state/useUpdateStore'
import Toast from './components/Toast'
import CopyProgress from './components/CopyProgress'
import FileHistory from './components/git/FileHistory'
import ComparePanes from './components/ComparePanes'
import ConflictDialog from './components/ConflictDialog'
import CustomCommandsDialog from './components/CustomCommandsDialog'
import ArchiveViewer from './components/ArchiveViewer'
import ShortcutsHelp from './components/ShortcutsHelp'
import { useCustomCommandsStore } from './state/useCustomCommandsStore'
import PaneTabs from './components/PaneTabs'
import Shelf from './components/Shelf'
import { useShelfStore } from './state/useShelfStore'
import { pathKey, baseName } from './lib/format'
import { clipFiles, pasteInto, undoLastOp } from './lib/fileActions'

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
  const terminalMax = useUiStore((s) => s.terminalMax)
  const appearanceOpen = useUiStore((s) => s.appearanceOpen)
  const previewOpen = useUiStore((s) => s.previewOpen)
  const remoteHost = useUiStore((s) => s.remoteHost)
  const gitViewOpen = useUiStore((s) => s.gitViewOpen)
  const searchActive = useSearchStore((s) => s.active)
  const panes = useNavStore((s) => s.panes)
  const groupActive = useNavStore((s) => s.groupActive)
  const terminalPanelRef = useRef<ImperativePanelHandle>(null)

  // Colonnes d'onglets : groupes triés, chacun avec ses onglets dans l'ordre.
  const groups = useMemo(() => {
    const ids = [...new Set(panes.map((p) => p.group))].sort((a, b) => a - b)
    return ids.map((g) => ({ g, tabs: panes.filter((p) => p.group === g) }))
  }, [panes])

  useEffect(() => {
    void initAppearance()
    void initNav()
    void initFavorites()
    void initApps()
    void initOpenWith()
    void initWorkspaces()
    void initRunner()
    void useCustomCommandsStore.getState().init()
    void useShelfStore.getState().init()
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
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        const ui = useUiStore.getState()
        if (!ui.gitViewOpen) useSearchStore.getState().close()
        ui.toggleGitView()
      } else if (e.key === 'F1') {
        e.preventDefault()
        useUiStore.getState().setShortcuts(!useUiStore.getState().shortcutsOpen)
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

      // Annuler la dernière opération sur fichiers (global, même en Accès rapide).
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void undoLastOp()
        return
      }

      // La vue Git remplace les volets : les raccourcis fichiers (Ctrl+A/C/X/V,
      // F2, Suppr, onglets) ne doivent pas agir sur la liste masquée.
      if (useUiStore.getState().gitViewOpen) return

      const s = useNavStore.getState()

      // Onglets : Ctrl+T ouvre, Ctrl+W ferme (colonne de l'onglet actif) —
      // actifs partout, y compris sur les pages Accès rapide / Lanceur.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        const key = e.key.toLowerCase()
        if (key === 't') {
          e.preventDefault()
          void s.addTab()
          return
        }
        if (key === 'w') {
          e.preventDefault()
          s.closePane(s.activeId)
          return
        }
      }

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

  // Contexte MCP (agents IA) : pousse au main un instantané onglets/sélection/
  // dépôt/terminaux à chaque changement (débattu). Ne fait rien si le serveur
  // est désactivé (le main ignore alors simplement le cache).
  useEffect(() => {
    let t: number | null = null
    const push = (): void => {
      if (t) window.clearTimeout(t)
      t = window.setTimeout(() => {
        const nav = useNavStore.getState()
        const git = useGitStore.getState()
        const term = useTerminalStore.getState()
        const ui = useUiStore.getState()
        const ap = useAppearanceStore.getState().appearance
        window.api.mcp.pushContext({
          panes: nav.panes.map((p) => ({
            id: p.id,
            group: p.group,
            path: p.path,
            quickAccess: p.quickAccess,
            active: p.id === nav.activeId,
            selected: p.selected
          })),
          repo: git.repo ? { root: git.repo.root, branch: git.repo.branch } : null,
          terminals: term.tabs.map((tb) => ({
            ptyId: tb.ptyId,
            title: tb.title,
            cwd: tb.cwd,
            exited: tb.exited,
            paneId: tb.paneId
          })),
          ui: {
            gitViewOpen: ui.gitViewOpen,
            previewOpen: ui.previewOpen,
            terminalOpen: ui.terminalOpen,
            searchActive: useSearchStore.getState().active,
            settingsOpen: ui.appearanceOpen,
            viewMode: nav.viewMode,
            gridSize: nav.gridSize,
            theme: ap.themeId || ap.theme,
            shelfCount: useShelfStore.getState().items.length
          }
        })
      }, 400)
    }
    const subs = [
      useNavStore.subscribe(push),
      useGitStore.subscribe(push),
      useTerminalStore.subscribe(push),
      useUiStore.subscribe(push),
      useSearchStore.subscribe(push),
      useShelfStore.subscribe(push),
      useAppearanceStore.subscribe(push)
    ]
    push()
    return () => {
      subs.forEach((u) => u())
      if (t) window.clearTimeout(t)
    }
  }, [])

  // Actions demandées par un agent via MCP : terminal visible, révéler, toast.
  useEffect(() => {
    const offTerm = window.api.mcp.onOpenTerminal(({ cwd, command, title }) => {
      useUiStore.getState().setTerminalOpen(true)
      if (command) {
        void useTerminalStore.getState().openTaskTab({ cwd, title: title || 'Agent', command })
      } else {
        void useTerminalStore.getState().openTab(undefined, cwd)
      }
    })
    const offReveal = window.api.mcp.onReveal((p) => {
      void (async () => {
        const norm = p.replace(/\//g, '\\')
        const kind = await window.api.fs.probe(norm).catch(() => 'missing' as const)
        const s = useNavStore.getState()
        if (kind === 'directory') {
          s.navigate(norm)
          return
        }
        if (kind === 'missing') {
          useUiStore.getState().showToast(`Agent : chemin introuvable — ${p}`)
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
      })()
    })
    const offNotify = window.api.mcp.onNotify((m) =>
      useUiStore.getState().showToast(`Agent : ${m}`)
    )
    return () => {
      offTerm()
      offReveal()
      offNotify()
    }
  }, [])

  // Sauvegarde continue de la session (colonnes/onglets/chemins), débattue :
  // sert à « Rouvrir les dossiers au démarrage ».
  useEffect(() => {
    let t: number | null = null
    const unsub = useNavStore.subscribe((s) => {
      if (t) window.clearTimeout(t)
      t = window.setTimeout(() => {
        const ps = s.panes.map((p) => ({ path: p.path, quickAccess: p.quickAccess, group: p.group }))
        const activeIndex = Math.max(0, s.panes.findIndex((p) => p.id === s.activeId))
        void window.api.config.set('lastSession', { panes: ps, activeIndex })
      }, 800)
    })
    return () => {
      unsub()
      if (t) window.clearTimeout(t)
    }
  }, [])

  // Pop-up « Nouveautés » : une seule fois après une mise à jour (version changée).
  useEffect(() => {
    void (async () => {
      const { version } = await window.api.update.get()
      const last = await window.api.config.get('lastSeenVersion')
      if (last && last !== version) useUiStore.getState().setWhatsNew(last)
      if (last !== version) void window.api.config.set('lastSeenVersion', version)
    })()
  }, [])

  // Progression des copies longues : alimente la barre (null = terminé).
  useEffect(() => {
    return window.api.fs.onCopyProgress((p) => useUiStore.getState().setCopyProgress(p))
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
      <RecycleBin />
      <FolderCreator />
      <WhatsNew />
      <Toast />
      <CopyProgress />
      <FileHistory />
      <ComparePanes />
      <ConflictDialog />
      <CustomCommandsDialog />
      <ArchiveViewer />
      <ShortcutsHelp />

      <div className="min-h-0 flex-1">
        {terminalOpen && terminalMax ? (
          // Terminal maximisé (double-clic sur sa barre) : plein espace de la
          // fenêtre. La disposition normale (tailles persistées via autoSaveId)
          // est restaurée telle quelle en sortant du mode.
          <Suspense fallback={null}>
            <TerminalPanel />
          </Suspense>
        ) : (
        <PanelGroup key={vKey} autoSaveId="gvue:vertical" direction="vertical">
          <Panel minSize={30}>
            <PanelGroup key={hKey} autoSaveId="gvue:horizontal" direction="horizontal">
              <Panel defaultSize={18} minSize={12} maxSize={32}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

              <Panel minSize={30}>
                <div className="relative h-full">
                  {gitViewOpen ? (
                    <GitPanel />
                  ) : searchActive ? (
                    <SearchPanel />
                  ) : (
                    <PanelGroup key={`panes-${groups.length}`} autoSaveId="gvue:panes" direction="horizontal">
                      {groups.map(({ g, tabs }, i) => {
                        const visible = tabs.find((t) => t.id === groupActive[g]) ?? tabs[0]
                        return (
                          <Fragment key={g}>
                            {i > 0 && (
                              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />
                            )}
                            <Panel minSize={20}>
                              <div className="flex h-full flex-col">
                                <PaneTabs group={g} tabs={tabs} visibleId={visible.id} />
                                <div className="min-h-0 flex-1">
                                  <Pane paneId={visible.id} />
                                </div>
                              </div>
                            </Panel>
                          </Fragment>
                        )
                      })}
                    </PanelGroup>
                  )}
                  {/* Étagère flottante (panier de fichiers), masquée en vue Git. */}
                  {!gitViewOpen && <Shelf />}
                </div>
              </Panel>

              {previewOpen && (
                <>
                  <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />
                  <Panel defaultSize={26} minSize={18} maxSize={45}>
                    <PreviewPanel />
                  </Panel>
                </>
              )}

              {/* Volet SFTP : les fichiers locaux restent visibles à côté. */}
              {remoteHost && (
                <>
                  <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />
                  <Panel defaultSize={30} minSize={20} maxSize={50}>
                    <RemoteExplorer />
                  </Panel>
                </>
              )}

              {appearanceOpen && (
                <>
                  <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />
                  <Panel defaultSize={20} minSize={15} maxSize={34}>
                    <SettingsPanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {terminalOpen && (
            <>
              {/* Poignée élargie (zone de 6 px, trait de 1 px) : facile à attraper. */}
              <PanelResizeHandle className="group relative h-1.5 shrink-0">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border transition-colors group-hover:bg-accent group-data-[resize-handle-active]:bg-accent" />
              </PanelResizeHandle>
              <Panel ref={terminalPanelRef} defaultSize={terminalSize} minSize={12} maxSize={80}>
                <Suspense fallback={null}>
                  <TerminalPanel />
                </Suspense>
              </Panel>
            </>
          )}
        </PanelGroup>
        )}
      </div>
    </div>
  )
}
