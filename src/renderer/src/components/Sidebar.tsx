import { useEffect, useMemo, useState } from 'react'
import {
  Home,
  Monitor,
  FileText,
  Star,
  FolderGit2,
  Rocket,
  ChevronRight,
  ChevronDown,
  Tag,
  Trash2
} from 'lucide-react'
import { useNavStore, activePane } from '../state/useNavStore'
import { useSearchStore } from '../state/useSearchStore'
import { useUiStore } from '../state/useUiStore'
import { useFavoritesStore } from '../state/useFavoritesStore'
import { useRunnerStore } from '../state/useRunnerStore'
import { useSidebarStore } from '../state/useSidebarStore'
import type { GitProject, RunnerTask, SshHost } from '@shared/types'
import { pathKey, baseName } from '../lib/format'
import FolderTree from './FolderTree'
import ContextMenu from './ContextMenu'
import { buildFolderMenu } from '../lib/folderMenu'
import Item from './sidebar/Item'
import Section from './sidebar/Section'
import LaunchRow from './sidebar/LaunchRow'
import FavoriteItem from './sidebar/FavoriteItem'
import ProjectItem from './sidebar/ProjectItem'
import LaunchConfigDialog from './sidebar/LaunchConfigDialog'
import ServerItem from './sidebar/ServerItem'
import ServerManager from './sidebar/ServerManager'
import DownloadsItem from './sidebar/DownloadsItem'
import ServerImportDialog from './sidebar/ServerImportDialog'
import { useTerminalStore } from '../state/useTerminalStore'
import { sshCommandFor, mergeHosts, hostKeyOf, toSshConfigText } from '../lib/ssh'
import { DEMO_PROJECTS, DEMO_SERVERS } from '../data/demoData'
import { useDemoStore, EMPTY_TASKS, EMPTY_FAVORITES } from '../state/useDemoStore'
import { t, tn } from '../i18n'

/**
 * Sidebar : lanceur, accès rapide, lecteurs, favoris et projets — orchestration
 * seule, les sous-composants vivent dans ./sidebar/.
 * - Le bouton ▶ d'un projet exécute une commande définie (⚙ pour la définir).
 * - Sous « Lanceur », une liste repliable de tous les lancements, regroupés
 *   par projet ou par catégorie.
 */
export default function Sidebar(): JSX.Element {
  const locations = useNavStore((s) => s.locations)
  const navigate = useNavStore((s) => s.navigate)
  const showQuickAccess = useNavStore((s) => s.showQuickAccess)
  const showLauncher = useNavStore((s) => s.showLauncher)
  const path = useNavStore((s) => activePane(s).path)
  const quickAccess = useNavStore((s) => activePane(s).quickAccess)
  const launcher = useNavStore((s) => activePane(s).launcher)
  const closeSearch = useSearchStore((s) => s.close)
  const recycleBinOpen = useUiStore((s) => s.recycleBinOpen)
  const demoOn = useDemoStore((s) => s.demo)
  const favorites = useFavoritesStore((s) => (demoOn ? EMPTY_FAVORITES : s.favorites))
  const removeFavorite = useFavoritesStore((s) => s.remove)

  const order = useSidebarStore((s) => s.order)
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed)
  const reorder = useSidebarStore((s) => s.reorder)
  const initSidebar = useSidebarStore((s) => s.init)

  // Mode démo : ni lancements ni favoris réels (noms de projets/chemins).
  const tasks = useRunnerStore((s) => (demoOn ? EMPTY_TASKS : s.tasks))
  const running = useRunnerStore((s) => s.running)
  const runTask = useRunnerStore((s) => s.runTask)
  const stopTask = useRunnerStore((s) => s.stopTask)

  const [projects, setRealProjects] = useState<GitProject[]>([])
  // Mode démo : projets et serveurs FICTIFS à l'écran (captures, démo client).
  const [demo, setDemo] = useState(false)
  const setProjects = setRealProjects
  // Nombre de projets mis de côté pendant cette session (lien « tout réafficher »).
  const [hiddenCount, setHiddenCount] = useState(0)
  // Serveurs SSH : ~/.ssh/config (lecture seule) + ajouts manuels (config GVue).
  const [configHosts, setConfigHosts] = useState<SshHost[]>([])
  const [manualHosts, setManualHosts] = useState<SshHost[]>([])
  const [sshOk, setSshOk] = useState(true)
  const [sshAutoList, setSshAutoList] = useState(true)
  // Ouverture du manager : dans le store UI (pilotable par MCP/agents).
  const addServerOpen = useUiStore((s) => s.serverManagerOpen)
  const setAddServerOpen = useUiStore((s) => s.setServerManager)
  const [editServer, setEditServer] = useState<SshHost | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [launchOpen, setLaunchOpen] = useState(false)
  const [groupAxis, setGroupAxis] = useState<'project' | 'category'>('project')
  const [config, setConfig] = useState<{ root: string; name: string } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; dir: string; project?: string } | null>(null)

  // Ouvre le menu contextuel de dossier (Ce PC, favoris, projets).
  // `project` : renseigné depuis la section Projets, pour proposer « Retirer
  // ce projet de la liste » au clic droit (même action que la croix).
  const openCtx = (e: React.MouseEvent, dir: string, project?: string): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, dir, project })
  }

  // Retrait d'un projet de la liste — le dossier n'est JAMAIS touché ; il
  // réapparaît si on rouvre son dossier, ou via « tout réafficher ».
  const removeProject = (root: string): void => {
    setHiddenCount((n) => n + 1)
    void window.api.git.hideProject(root).then(setProjects)
  }

  // Charge l'ordre et le repli des sections (persistés).
  useEffect(() => {
    void initSidebar()
  }, [initSidebar])

  // Serveurs SSH : hôtes du ~/.ssh/config + manuels + présence d'OpenSSH.
  useEffect(() => {
    void window.api.ssh.configHosts().then(setConfigHosts).catch(() => setConfigHosts([]))
    void window.api.config.get('sshHosts').then(setManualHosts).catch(() => setManualHosts([]))
    void window.api.ssh.available().then(setSshOk).catch(() => setSshOk(false))
    void window.api.config
      .get('sshConfigAutoList')
      .then((v) => setSshAutoList(v !== false))
      .catch(() => setSshAutoList(true))
    void window.api.config
      .get('demoMode')
      .then((v) => setDemo(Boolean(v)))
      .catch(() => setDemo(false))
  }, [])

  // Hôtes du ssh_config affichés : selon le réglage (liste automatique ou
  // import à la demande), et jamais en double d'un hôte déjà importé/stocké.
  // En mode démo, tout est remplacé par des données fictives.
  const shownConfigHosts = demo
    ? []
    : sshAutoList
      ? configHosts.filter((h) => !manualHosts.some((m) => m.name === h.name))
      : []
  const shownManualHosts = demo ? DEMO_SERVERS : manualHosts
  const shownProjects = demo ? DEMO_PROJECTS : projects

  // Clic sur un serveur : terminal intégré + connexion SSH dedans.
  const connectSsh = (host: SshHost): void => {
    useUiStore.getState().setTerminalOpen(true)
    void useTerminalStore.getState().openTaskTab({
      cwd: home || '.',
      title: host.name,
      command: sshCommandFor(host),
      sshHostKey: hostKeyOf(host)
    })
  }

  // Ajout, ou remplacement de l'hôte d'origine en mode édition.
  const addServer = (host: SshHost, originalName?: string): void => {
    const next = [
      ...manualHosts.filter((h) => h.name !== host.name && h.name !== originalName),
      host
    ]
    setManualHosts(next)
    void window.api.config.set('sshHosts', next)
  }

  const removeServer = (name: string): void => {
    const next = manualHosts.filter((h) => h.name !== name)
    setManualHosts(next)
    void window.api.config.set('sshHosts', next)
  }

  // « Tout effacer pour tout ré-importer » (demande utilisateur).
  const removeAllServers = (): void => {
    const n = manualHosts.length
    if (!window.confirm(t('Retirer les {n} serveurs de la liste ? (ré-importables ensuite)', { n })))
      return
    setManualHosts([])
    void window.api.config.set('sshHosts', [])
  }

  // Export au format ssh_config standard (compatible VS Code Remote-SSH).
  const exportServers = (): void => {
    const all = [...manualHosts, ...shownConfigHosts]
    const blob = new Blob([toSshConfigText(all)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gvue-ssh-config'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Recharge la liste des dépôts à chaque navigation (un dépôt fraîchement
  // visité y apparaît). La mémorisation se fait côté main au git:status.
  useEffect(() => {
    let alive = true
    window.api.git
      .projects()
      .then((p) => alive && setProjects(p))
      .catch(() => alive && setProjects([]))
    return () => {
      alive = false
    }
  }, [path])

  const home = locations?.home ?? ''
  // Un dossier n'est « actif » que lorsqu'on l'affiche (pas sur la page Accès rapide).
  const isActive = (p: string): boolean => !quickAccess && path === p

  const openQuickAccess = (): void => {
    closeSearch()
    showQuickAccess()
  }

  const openLauncher = (): void => {
    closeSearch()
    showLauncher()
  }

  // Regroupe les lancements selon l'axe choisi (projet ou catégorie).
  const groups = useMemo(() => {
    const map = new Map<string, RunnerTask[]>()
    for (const task of tasks) {
      const label =
        groupAxis === 'project'
          ? task.project
            ? baseName(task.project)
            : t('Sans projet')
          : task.category || t('Sans catégorie')
      const arr = map.get(label)
      if (arr) arr.push(task)
      else map.set(label, [task])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tasks, groupAxis])

  // Contenu de chaque section réordonnable (clé → titre + corps).
  const sections: Record<string, { title: string; body: React.ReactNode }> = {
    thispc: {
      title: t('Ce PC'),
      body: (
        <>
          {home && (
            <Item
              icon={Home}
              label={t('Accueil')}
              active={isActive(home)}
              onClick={() => navigate(home)}
              onContextMenu={(e) => openCtx(e, home)}
            />
          )}
          {locations?.desktop && (
            <Item
              icon={Monitor}
              label={t('Bureau')}
              active={isActive(locations.desktop)}
              onClick={() => navigate(locations.desktop)}
              onContextMenu={(e) => openCtx(e, locations.desktop)}
            />
          )}
          {locations?.downloads && (
            <DownloadsItem
              active={isActive(locations.downloads)}
              onClick={() => navigate(locations.downloads)}
              onContextMenu={(e) => openCtx(e, locations.downloads)}
            />
          )}
          {locations?.documents && (
            <Item
              icon={FileText}
              label={t('Documents')}
              active={isActive(locations.documents)}
              onClick={() => navigate(locations.documents)}
              onContextMenu={(e) => openCtx(e, locations.documents)}
            />
          )}
          <Item
            icon={Trash2}
            label={t('Corbeille')}
            active={recycleBinOpen}
            onClick={() => useUiStore.getState().setRecycleBin(true)}
          />
        </>
      )
    },
    drives: {
      title: t('Lecteurs'),
      body: <FolderTree />
    },
    favorites: {
      title: t('Favoris'),
      body:
        favorites.length === 0 ? (
          <p className="px-2 text-[12px] text-fg-muted">
            {t('Aucun favori — clic droit sur un dossier → « Ajouter aux favoris ».')}
          </p>
        ) : (
          favorites.map((f) => (
            <FavoriteItem
              key={f}
              path={f}
              active={isActive(f)}
              onOpen={() => navigate(f)}
              onRemove={() => removeFavorite(f)}
              onConfig={(e) => {
                e.stopPropagation()
                setConfig({ root: f, name: baseName(f) })
              }}
              onContextMenu={(e) => openCtx(e, f)}
            />
          ))
        )
    },
    projects: {
      title: t('Projets'),
      body: (
        <>
          {shownProjects.length === 0 ? (
            <p className="px-2 text-[12px] text-fg-muted">{t('Visitez un dépôt Git pour le voir ici.')}</p>
          ) : (
            shownProjects.map((p) => (
              <ProjectItem
                key={p.root}
                project={p}
                active={!quickAccess && !launcher && pathKey(path) === pathKey(p.root)}
                onClick={() => navigate(p.root)}
                onConfig={(e) => {
                  e.stopPropagation()
                  setConfig({ root: p.root, name: p.name })
                }}
                onHide={(e) => {
                  e.stopPropagation()
                  removeProject(p.root)
                }}
                onContextMenu={(e) => openCtx(e, p.root, p.root)}
              />
            ))
          )}
          {hiddenCount > 0 && (
            <button
              onClick={() => {
                setHiddenCount(0)
                void window.api.git.unhideProjects().then(setProjects)
              }}
              title={t('Réafficher les projets retirés de la liste')}
              className="mt-0.5 w-full rounded-app px-2 py-1 text-left text-[11px] text-fg-muted hover:bg-bg-hover hover:text-fg"
            >
              + {tn(hiddenCount, '{n} projet masqué — tout réafficher', '{n} projets masqués — tout réafficher')}
            </button>
          )}
        </>
      )
    },
    servers: {
      // Le libellé nomme les protocoles (sans ambiguïté avec un « serveur » de
      // projet ou un lecteur réseau) ; la clé de section reste « servers »,
      // car elle est persistée dans l'ordre de la sidebar.
      title: t('SSH / SFTP'),
      body: (
        <>
          {!sshOk && (
            <p className="px-2 text-[12px] text-warning-fg">
              {t('OpenSSH introuvable — activez « Client OpenSSH » dans les fonctionnalités facultatives de Windows.')}
            </p>
          )}
          {shownConfigHosts.length === 0 && shownManualHosts.length === 0 && (
            <p className="px-2 text-[12px] text-fg-muted">
              {sshAutoList
                ? t('Les hôtes de ~/.ssh/config apparaissent ici automatiquement.')
                : t('Import à la demande : « ⇪ Importer » liste aussi votre ~/.ssh/config.')}
            </p>
          )}
          {shownConfigHosts.map((h) => (
            <ServerItem
              key={`c-${h.name}`}
              host={h}
              onConnect={() => connectSsh(h)}
              onBrowse={() => useUiStore.getState().setRemoteHost(h)}
            />
          ))}
          {shownManualHosts.map((h) => (
            <ServerItem
              key={`m-${h.name}`}
              host={h}
              onConnect={() => connectSsh(h)}
              onBrowse={() => useUiStore.getState().setRemoteHost(h)}
              // Un hôte importé du ssh_config n'est pas éditable dans GVue
              // (sa vérité vit dans le fichier) — mais il reste retirable.
              onEdit={
                h.source === 'manual'
                  ? (e) => {
                      e.stopPropagation()
                      setEditServer(h)
                    }
                  : undefined
              }
              onRemove={(e) => {
                e.stopPropagation()
                removeServer(h.name)
              }}
            />
          ))}
          {/* Le manager plein écran remplace l'ancien formulaire à défilement :
              ajout, édition, import/export et « tout retirer » vivent dedans. */}
          {(addServerOpen || editServer) && (
            <ServerManager
              // Mode démo : le manager montre AUSSI les serveurs fictifs, et
              // toute écriture est neutralisée — sans quoi il exposerait les
              // vrais serveurs et « enregistrer » polluerait la vraie config.
              manualHosts={shownManualHosts}
              configHosts={shownConfigHosts}
              initial={editServer ? editServer.name : 'new'}
              onSave={demo ? () => undefined : addServer}
              onRemove={demo ? () => undefined : removeServer}
              onRemoveAll={demo ? () => undefined : removeAllServers}
              onExport={demo ? () => undefined : exportServers}
              onOpenImport={() => !demo && setImportOpen(true)}
              onConnect={connectSsh}
              onBrowse={(h) => useUiStore.getState().setRemoteHost(h)}
              onClose={() => {
                setAddServerOpen(false)
                setEditServer(null)
              }}
            />
          )}
          <button
            onClick={() => setAddServerOpen(true)}
            className="mt-0.5 w-full rounded-app px-2 py-1 text-left text-[11px] text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            {t('⚙ Gérer les serveurs…')}
          </button>
          {/* Jamais en mode démo : le dialogue lirait le vrai ssh_config. */}
          {importOpen && !demo && (
            <ServerImportDialog
              existing={[...configHosts, ...manualHosts]}
              onImport={(hosts) => {
                const next = mergeHosts(manualHosts, hosts)
                setManualHosts(next)
                void window.api.config.set('sshHosts', next)
              }}
              onClose={() => setImportOpen(false)}
            />
          )}
        </>
      )
    }
  }

  return (
    <nav className="flex h-full w-full flex-col gap-5 overflow-y-auto bg-bg-secondary p-2.5 text-[13px]">
      <div className="flex flex-col gap-0.5">
        <Item icon={Rocket} label={t('Lanceur')} active={launcher} onClick={openLauncher} />

        {/* Liste repliable des lancements, regroupés par projet/catégorie. */}
        {tasks.length > 0 && (
          <div className="flex flex-col">
            <div className="flex items-center">
              <button
                onClick={() => setLaunchOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-1 rounded-app px-2 py-[var(--row-pad)] text-left text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
              >
                {launchOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span className="truncate">{t('Lancements')}</span>
                <span className="text-[11px] text-fg-muted">({tasks.length})</span>
              </button>
              {launchOpen && (
                <button
                  onClick={() => setGroupAxis((a) => (a === 'project' ? 'category' : 'project'))}
                  title={t('Changer le regroupement (projet / catégorie)')}
                  className="mr-1 flex shrink-0 items-center gap-1 rounded-app px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-bg-hover hover:text-fg"
                >
                  {groupAxis === 'project' ? <FolderGit2 size={11} /> : <Tag size={11} />}
                  {groupAxis === 'project' ? t('Projet') : t('Cat.')}
                </button>
              )}
            </div>

            {launchOpen && (
              <div className="flex flex-col gap-1 pb-1 pl-3">
                {groups.map(([label, items]) => (
                  <div key={label} className="flex flex-col">
                    <div className="px-1 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                      {label}
                    </div>
                    {items.map((t) => (
                      <LaunchRow
                        key={t.id}
                        task={t}
                        running={!!running[t.id]}
                        onRun={() => void runTask(t.id)}
                        onStop={() => stopTask(t.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Item icon={Star} label={t('Accès rapide')} active={quickAccess} onClick={openQuickAccess} />
      </div>

      {order.map((key) => {
        const sec = sections[key]
        if (!sec) return null
        return (
          <Section
            key={key}
            sectionKey={key}
            title={sec.title}
            collapsed={!!collapsed[key]}
            onToggle={() => toggleCollapsed(key)}
            onReorder={(from) => reorder(from, key)}
          >
            {sec.body}
          </Section>
        )
      })}

      {config && (
        <LaunchConfigDialog
          root={config.root}
          name={config.name}
          onClose={() => setConfig(null)}
        />
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={buildFolderMenu(
            menu.dir,
            menu.project ? () => removeProject(menu.project!) : undefined
          )}
          onClose={() => setMenu(null)}
        />
      )}
    </nav>
  )
}
