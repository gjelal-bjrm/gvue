import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Server,
  X,
  ArrowUp,
  RotateCw,
  Download,
  Upload,
  FolderPlus,
  Pencil,
  Trash2,
  Loader2,
  Folder,
  File,
  Link2,
  FileEdit,
  ShieldQuestion,
  KeyRound,
  Rocket,
  FolderInput,
  TerminalSquare,
  History
} from 'lucide-react'
import type { SftpEntry, SftpProgress } from '@shared/types'
import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { formatSize, formatDate, baseName } from '../lib/format'
import { sshSubtitle, sshCdCommandFor, hostKeyOf } from '../lib/ssh'
import { useTerminalStore } from '../state/useTerminalStore'
import { t, tn } from '../i18n'

/** Chemin parent d'un chemin distant POSIX (« / » reste « / »). */
function remoteParent(p: string): string {
  if (p === '/' || !p.includes('/')) return '/'
  const cut = p.replace(/\/+$/, '').lastIndexOf('/')
  return cut <= 0 ? '/' : p.slice(0, cut)
}

type Phase =
  | { step: 'connecting' }
  | { step: 'fingerprint'; fingerprint: string }
  | { step: 'password'; message?: string; canSave?: boolean }
  | { step: 'error'; message: string }
  | { step: 'ready' }

interface Deploy {
  paths: string[]
  remoteDir: string
  contents: boolean
}

/** Nombre de dossiers distants gardés dans l'historique, par serveur. */
const RECENT_MAX = 12

/**
 * Volet SFTP latéral — les fichiers locaux restent visibles À CÔTÉ (façon
 * WinSCP) : on glisse depuis le volet local vers le serveur, on télécharge
 * vers le dossier local actif. Pensé déploiement : dossier distant mémorisé
 * par serveur, envoi du CONTENU d'un dossier (dist/ → /var/www sans dossier
 * imbriqué), et « Redéployer » qui rejoue le dernier envoi en un clic.
 */
export default function RemoteExplorer(): JSX.Element | null {
  const host = useUiStore((s) => s.remoteHost)
  const close = (): void => useUiStore.getState().setRemoteHost(null)
  const localDir = useNavStore((s) => activePane(s).path)
  const localSel = useNavStore((s) => activePane(s).selected)
  const localEntries = useNavStore((s) => activePane(s).entries)

  const [phase, setPhase] = useState<Phase>({ step: 'connecting' })
  const [hostKey, setHostKey] = useState('')
  const [path, setPath] = useState('/')
  const [entries, setEntries] = useState<SftpEntry[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState<SftpEntry | null>(null)
  const [transfer, setTransfer] = useState<SftpProgress | null>(null)
  const [dropOver, setDropOver] = useState(false)
  const [lastDeploy, setLastDeploy] = useState<Deploy | null>(null)
  const [recentDirs, setRecentDirs] = useState<string[]>([])
  const [recentOpen, setRecentOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  // Retenir le mot de passe (chiffré par l'OS) + présence d'un enregistrement.
  const [remember, setRemember] = useState(true)
  const [savedPwd, setSavedPwd] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  // Empreinte acceptée dans CE flux : re-transmise avec le mot de passe.
  const acceptedFpRef = useRef<string | undefined>(undefined)

  const toast = (m: string): void => useUiStore.getState().showToast(m)

  // Sélection locale : un unique DOSSIER sélectionné → bouton « Contenu → ».
  const localSingleDir =
    localSel.length === 1 &&
    localEntries.find((e) => e.path === localSel[0])?.kind === 'directory'
      ? localSel[0]
      : null

  const refresh = useCallback(async (key: string, dir: string): Promise<void> => {
    setLoading(true)
    const r = await window.api.sftp.list(key, dir)
    setLoading(false)
    if (r.error) {
      toast(t('SFTP : {error}', { error: r.error }))
      setEntries([])
    } else {
      setEntries(r.entries ?? [])
    }
    setSel(new Set())
  }, [])

  // Connexion (machine à états : empreinte → mot de passe → prêt).
  const attempt = useCallback(
    async (opts?: {
      password?: string
      acceptFingerprint?: string
      savePassword?: boolean
    }): Promise<void> => {
      if (!host) return
      setPhase({ step: 'connecting' })
      const r = await window.api.sftp.connect(host, opts)
      if (r.status === 'ok') {
        const key = hostKeyOf(host)
        setHostKey(key)
        setPhase({ step: 'ready' })
        void window.api.sftp.hasPassword(key).then(setSavedPwd).catch(() => setSavedPwd(false))
        // Reprend le dernier dossier visité sur CE serveur (déploiements répétés).
        const lastDirs = await window.api.config
          .get('sftpLastDirs')
          .catch(() => ({}) as Record<string, string>)
        const start = lastDirs[key] ?? r.home
        const listed = await window.api.sftp.list(key, start)
        if (listed.error || !listed.entries) {
          setPath(r.home)
          void refresh(key, r.home)
        } else {
          setPath(start)
          setEntries(listed.entries)
        }
        const deploys = await window.api.config
          .get('sftpLastDeploy')
          .catch(() => ({}) as Record<string, Deploy>)
        setLastDeploy(deploys[key] ?? null)
      } else if (r.status === 'fingerprint') {
        setPhase({ step: 'fingerprint', fingerprint: r.fingerprint })
      } else if (r.status === 'password') {
        setPhase({ step: 'password', message: r.message, canSave: r.canSave })
      } else {
        setPhase({ step: 'error', message: r.message })
      }
    },
    [host, refresh]
  )

  useEffect(() => {
    if (host) void attempt()
  }, [host, attempt])

  // Progression des transferts (throttlée côté main).
  useEffect(() => {
    const off = window.api.sftp.onProgress((p) => {
      setTransfer(p)
      if (p.done >= p.total && p.index >= p.count) {
        window.setTimeout(() => setTransfer(null), 1500)
      }
    })
    return off
  }, [])

  // Mémoire de session : le dossier courant et l'historique sont persistés à
  // CHAQUE changement de dossier (et non dans la seule fonction de navigation,
  // que certains chemins de code contournaient — d'où l'oubli constaté).
  useEffect(() => {
    if (!hostKey || !path) return
    void (async () => {
      const [dirs, recents] = await Promise.all([
        window.api.config.get('sftpLastDirs').catch(() => ({}) as Record<string, string>),
        window.api.config.get('sftpRecentDirs').catch(() => ({}) as Record<string, string[]>)
      ])
      void window.api.config.set('sftpLastDirs', { ...dirs, [hostKey]: path })
      const list = [path, ...(recents[hostKey] ?? []).filter((d) => d !== path)].slice(0, RECENT_MAX)
      setRecentDirs(list)
      void window.api.config.set('sftpRecentDirs', { ...recents, [hostKey]: list })
    })()
  }, [hostKey, path])

  // Serveur dont le volet est ouvert : rouvert au prochain démarrage.
  useEffect(() => {
    if (host) void window.api.config.set('sftpLastHost', host)
  }, [host])

  if (!host) return null

  const navigate = (dir: string): void => {
    setPath(dir)
    void refresh(hostKey, dir)
  }

  const selected = entries.filter((e) => sel.has(e.path))

  const onRowClick = (e: React.MouseEvent, entry: SftpEntry): void => {
    if (e.ctrlKey || e.metaKey) {
      setSel((prev) => {
        const n = new Set(prev)
        n.has(entry.path) ? n.delete(entry.path) : n.add(entry.path)
        return n
      })
    } else {
      setSel(new Set([entry.path]))
    }
  }

  const onActivate = (entry: SftpEntry): void => {
    if (entry.kind === 'directory') navigate(entry.path)
    else void editEntry(entry)
  }

  const editEntry = async (entry: SftpEntry): Promise<void> => {
    setBusy(true)
    const r = await window.api.sftp.edit(hostKey, entry)
    setBusy(false)
    if (r.error) toast(t('Édition : {error}', { error: r.error }))
    else
      toast(
        t('{name} ouvert — chaque sauvegarde est ré-téléversée sur le serveur.', {
          name: entry.name
        })
      )
  }

  const downloadSel = async (): Promise<void> => {
    if (!selected.length || !localDir) return
    setBusy(true)
    const r = await window.api.sftp.download(hostKey, selected, localDir)
    setBusy(false)
    toast(
      r.errors.length
        ? t('Téléchargement : {ok} OK, {count} échec(s) — {err}', {
            ok: r.ok,
            count: r.errors.length,
            err: r.errors[0]
          })
        : tn(r.ok, '{n} élément téléchargé.', '{n} éléments téléchargés.')
    )
    useNavStore.getState().refreshAll()
  }

  // Téléversement (+ mémorisation du couple pour « Redéployer »).
  const uploadPaths = async (paths: string[], contents = false): Promise<void> => {
    if (!paths.length) return
    setBusy(true)
    const r = await window.api.sftp.upload(hostKey, paths, path, contents)
    setBusy(false)
    toast(
      r.errors.length
        ? t('Téléversement : {ok} OK, {count} échec(s) — {err}', {
            ok: r.ok,
            count: r.errors.length,
            err: r.errors[0]
          })
        : tn(r.ok, '{n} élément téléversé vers {path}', '{n} éléments téléversés vers {path}', {
            path
          })
    )
    if (r.ok > 0) {
      const deploy: Deploy = { paths, remoteDir: path, contents }
      setLastDeploy(deploy)
      void window.api.config.get('sftpLastDeploy').then((d) =>
        window.api.config.set('sftpLastDeploy', { ...d, [hostKey]: deploy })
      )
    }
    void refresh(hostKey, path)
  }

  const redeploy = async (): Promise<void> => {
    if (!lastDeploy) return
    setBusy(true)
    const r = await window.api.sftp.upload(
      hostKey,
      lastDeploy.paths,
      lastDeploy.remoteDir,
      lastDeploy.contents
    )
    setBusy(false)
    toast(
      r.errors.length
        ? t('Redéploiement : {ok} OK, {count} échec(s) — {err}', {
            ok: r.ok,
            count: r.errors.length,
            err: r.errors[0]
          })
        : tn(r.ok, 'Redéployé : {n} élément → {dir}', 'Redéployé : {n} éléments → {dir}', {
            dir: lastDeploy.remoteDir
          })
    )
    if (path === lastDeploy.remoteDir) void refresh(hostKey, path)
  }

  const deployLabel = lastDeploy
    ? `${lastDeploy.paths.map((p) => baseName(p)).join(', ')}${lastDeploy.contents ? '/*' : ''} → ${lastDeploy.remoteDir}`
    : ''

  // Création d'un dossier distant : saisie EN LIGNE en tête de liste.
  // (window.prompt n'existe pas dans Electron : le bouton ne faisait rien.)
  const mkdirHere = async (name: string): Promise<void> => {
    setCreating(false)
    const clean = name.trim()
    if (!clean) return
    const r = await window.api.sftp.mkdir(hostKey, path === '/' ? `/${clean}` : `${path}/${clean}`)
    if (r.error) toast(t('Nouveau dossier : {error}', { error: r.error }))
    else void refresh(hostKey, path)
  }

  const commitRename = async (entry: SftpEntry, newName: string): Promise<void> => {
    setRenaming(null)
    const name = newName.trim()
    if (!name || name === entry.name) return
    const to = `${remoteParent(entry.path)}/${name}`.replace('//', '/')
    const r = await window.api.sftp.rename(hostKey, entry.path, to)
    if (r.error) toast(t('Renommage : {error}', { error: r.error }))
    else void refresh(hostKey, path)
  }

  const deleteSel = async (): Promise<void> => {
    if (!selected.length) return
    const n = selected.length
    if (
      !window.confirm(
        tn(
          n,
          "Supprimer {n} élément du SERVEUR ? Pas de corbeille en SFTP : c'est définitif.",
          "Supprimer {n} éléments du SERVEUR ? Pas de corbeille en SFTP : c'est définitif."
        )
      )
    )
      return
    setBusy(true)
    const r = await window.api.sftp.delete(hostKey, selected)
    setBusy(false)
    if (r.errors.length)
      toast(
        t('Suppression : {ok} OK, {count} échec(s) — {err}', {
          ok: r.ok,
          count: r.errors.length,
          err: r.errors[0]
        })
      )
    void refresh(hostKey, path)
  }

  const disconnect = (): void => {
    if (hostKey) void window.api.sftp.disconnect(hostKey)
    // Fermeture EXPLICITE : on ne rouvrira pas ce volet au prochain démarrage
    // (seule une app quittée volet ouvert le restaure).
    void window.api.config.set('sftpLastHost', null)
    close()
  }

  const IconBtn = (p: {
    onClick: () => void
    title: string
    disabled?: boolean
    danger?: boolean
    children: React.ReactNode
  }): JSX.Element => (
    <button
      onClick={p.onClick}
      disabled={p.disabled}
      title={p.title}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-app hover:bg-bg-hover disabled:opacity-30 ${
        p.danger ? 'text-fg-muted hover:text-danger-fg' : 'text-fg-secondary'
      }`}
    >
      {p.children}
    </button>
  )

  return (
    <aside
      className={`flex h-full w-full flex-col border-l border-border bg-bg-secondary ${
        dropOver ? 'ring-2 ring-inset ring-accent' : ''
      }`}
      onDragOver={(e) => {
        if (phase.step !== 'ready') return
        e.preventDefault()
        setDropOver(true)
      }}
      onDragLeave={(e) => {
        if (e.target === e.currentTarget) setDropOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDropOver(false)
        if (phase.step !== 'ready') return
        const internal = e.dataTransfer.getData('application/x-gvue-paths')
        const paths = internal
          ? (JSON.parse(internal) as string[])
          : Array.from(e.dataTransfer.files)
              .map((f) => window.api.fs.pathForFile(f))
              .filter(Boolean)
        void uploadPaths(paths)
      }}
    >
      {/* En-tête */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <Server size={15} className="shrink-0 text-accent" />
        <span className="min-w-0 truncate text-[13px] font-medium text-fg">{host.name}</span>
        <span className="min-w-0 truncate text-[11px] text-fg-muted">{sshSubtitle(host)}</span>
        {phase.step === 'ready' && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 text-[10px] leading-[16px] text-success-fg"
            title={t('Session SFTP active')}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success-fg" />
            {t('connecté')}
          </span>
        )}
        {phase.step === 'ready' && savedPwd && (
          <button
            onClick={() => {
              void window.api.sftp.forgetPassword(hostKey)
              setSavedPwd(false)
              toast(t('Mot de passe enregistré oublié.'))
            }}
            title={t('Oublier le mot de passe enregistré pour ce serveur')}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg"
          >
            <KeyRound size={13} />
          </button>
        )}
        {phase.step === 'ready' && (
          <button
            onClick={() => {
              // Terminal SSH déjà positionné dans le dossier distant affiché.
              useUiStore.getState().setTerminalOpen(true)
              void useTerminalStore.getState().openTaskTab({
                cwd: localDir || '.',
                title: `${host.name}:${path}`,
                command: sshCdCommandFor(host, path),
                sshHostKey: hostKey
              })
            }}
            title={t('Ouvrir un terminal SSH dans {path}', { path })}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-accent"
          >
            <TerminalSquare size={14} />
          </button>
        )}
        <button
          onClick={disconnect}
          title={t('Se déconnecter et fermer')}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg ${
            phase.step === 'ready' ? '' : 'ml-auto'
          }`}
        >
          <X size={15} />
        </button>
      </div>

      {phase.step === 'connecting' && (
        <p className="flex items-center justify-center gap-2 py-14 text-[13px] text-fg-muted">
          <Loader2 size={15} className="animate-spin" /> {t('Connexion à {host}…', { host: host.name })}
        </p>
      )}

      {phase.step === 'fingerprint' && (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <ShieldQuestion size={26} className="text-warning-fg" />
          <p className="text-[13px] text-fg">{t('Première connexion à ce serveur.')}</p>
          <p className="break-all text-[11px] text-fg-secondary">
            {t('Empreinte :')} <code className="font-mono">{phase.fingerprint}</code>
          </p>
          <p className="text-[11px] text-fg-muted">
            {t('Mémorisée après validation ; toute future différence bloquera la connexion.')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                acceptedFpRef.current = phase.fingerprint
                void attempt({ acceptFingerprint: phase.fingerprint })
              }}
              className="rounded-app bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
            >
              {t('Faire confiance')}
            </button>
            <button
              onClick={disconnect}
              className="rounded-app border border-border px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
            >
              {t('Annuler')}
            </button>
          </div>
        </div>
      )}

      {phase.step === 'password' && (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <KeyRound size={24} className="text-accent" />
          <p className="text-[13px] text-fg">
            {t('Mot de passe —')} {host.user ? `${host.user}@` : ''}
            {host.hostName ?? host.name}
          </p>
          {phase.message && <p className="text-[12px] text-danger-fg">{phase.message}</p>}
          <input
            ref={passwordRef}
            type="password"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter')
                void attempt({
                  password: passwordRef.current?.value ?? '',
                  acceptFingerprint: acceptedFpRef.current,
                  savePassword: remember && phase.canSave === true
                })
            }}
            className="w-full max-w-[240px] rounded-app border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
          />
          {phase.canSave ? (
            <label className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              {t('Retenir le mot de passe (chiffré par Windows)')}
            </label>
          ) : (
            <p className="text-[11px] text-fg-muted">
              {t('Utilisé pour cette session, jamais stocké.')}
            </p>
          )}
          <button
            onClick={() =>
              void attempt({
                password: passwordRef.current?.value ?? '',
                acceptFingerprint: acceptedFpRef.current,
                savePassword: remember && phase.canSave === true
              })
            }
            className="rounded-app bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
          >
            {t('Se connecter')}
          </button>
        </div>
      )}

      {phase.step === 'error' && (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="max-w-full break-words text-[12px] text-danger-fg">{phase.message}</p>
          {/timed out/i.test(phase.message) && (
            <p className="text-[11px] text-fg-muted">
              {t("Le serveur n'a pas répondu — beaucoup limitent les connexions rapprochées (anti-abus). Patientez ~30 secondes avant de réessayer.")}
            </p>
          )}
          <button
            onClick={() => void attempt({ acceptFingerprint: acceptedFpRef.current })}
            className="rounded-app border border-border px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
          >
            {t('Réessayer')}
          </button>
        </div>
      )}

      {phase.step === 'ready' && (
        <>
          {/* Rangée 1 : navigation distante */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
            <IconBtn
              onClick={() => navigate(remoteParent(path))}
              title={t('Dossier parent')}
              disabled={path === '/'}
            >
              <ArrowUp size={15} />
            </IconBtn>
            <IconBtn onClick={() => void refresh(hostKey, path)} title={t('Actualiser')}>
              <RotateCw size={13} />
            </IconBtn>
            {/* Chemin + historique des dossiers récents de CE serveur. */}
            <div className="relative min-w-0 flex-1">
              <button
                onClick={() => setRecentOpen((o) => !o)}
                title={t('{path}\nCliquer : dossiers récents sur ce serveur', { path })}
                className="flex w-full items-center gap-1 rounded-app border border-border bg-bg px-2 py-1 text-left"
              >
                <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-secondary">
                  {path}
                </code>
                <History size={11} className="shrink-0 text-fg-muted" />
              </button>
              {recentOpen && recentDirs.length > 0 && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setRecentOpen(false)} />
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-auto rounded-app border border-border bg-bg-secondary py-1 shadow-lg">
                    {recentDirs.map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setRecentOpen(false)
                          if (d !== path) navigate(d)
                        }}
                        title={d}
                        className={`block w-full truncate px-2 py-1 text-left font-mono text-[11px] hover:bg-bg-hover ${
                          d === path ? 'text-accent' : 'text-fg-secondary'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <IconBtn
              onClick={() => setCreating(true)}
              title={t('Nouveau dossier distant')}
              disabled={busy}
            >
              <FolderPlus size={14} />
            </IconBtn>
            <IconBtn
              onClick={() => selected.length === 1 && setRenaming(selected[0])}
              title={t('Renommer')}
              disabled={busy || selected.length !== 1}
            >
              <Pencil size={13} />
            </IconBtn>
            <IconBtn
              onClick={() => void deleteSel()}
              title={t('Supprimer du serveur (définitif)')}
              disabled={busy || selected.length === 0}
              danger
            >
              <Trash2 size={13} />
            </IconBtn>
          </div>

          {/* Rangée 2 : transferts (le cœur du flux de déploiement) */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5">
            <button
              onClick={() => void downloadSel()}
              disabled={busy || selected.length === 0}
              title={t('Télécharger la sélection distante vers {dir}', {
                dir: localDir || t('le volet local')
              })}
              className="flex items-center gap-1 rounded-app border border-border px-2 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
            >
              <Download size={12} /> ← {t('Télécharger')}
              {selected.length > 0 ? ` (${selected.length})` : ''}
            </button>
            <button
              onClick={() => void uploadPaths(localSel)}
              disabled={busy || localSel.length === 0}
              title={t('Téléverser la sélection du volet local ici (ou glissez-déposez)')}
              className="flex items-center gap-1 rounded-app border border-border px-2 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
            >
              <Upload size={12} /> {t('Téléverser')} →{localSel.length > 0 ? ` (${localSel.length})` : ''}
            </button>
            {localSingleDir && (
              <button
                onClick={() => void uploadPaths([localSingleDir], true)}
                disabled={busy}
                title={t('Envoyer le CONTENU de {name}/ dans {path} (sans créer le dossier — le geste « déployer dist »)', { name: baseName(localSingleDir), path })}
                className="flex items-center gap-1 rounded-app border border-accent px-2 py-1 text-[11px] text-accent hover:bg-accent-soft disabled:opacity-40"
              >
                <FolderInput size={12} /> {t('Contenu de {name}/ →', { name: baseName(localSingleDir) })}
              </button>
            )}
            {lastDeploy && (
              <button
                onClick={() => void redeploy()}
                disabled={busy}
                title={t('Rejouer le dernier envoi : {label}', { label: deployLabel })}
                className="flex items-center gap-1 rounded-app bg-accent px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <Rocket size={12} /> {t('Redéployer')}
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-fg-muted">
                <Loader2 size={14} className="animate-spin" /> {t('Chargement…')}
              </p>
            ) : entries.length === 0 && !creating ? (
              <p className="px-3 py-10 text-center text-[13px] text-fg-muted">
                {t('Dossier vide — glissez des fichiers du volet local pour les téléverser.')}
              </p>
            ) : (
              <table className="w-full text-[12px]">
                {/* En-têtes de colonnes — mêmes codes que la liste locale. */}
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-fg-muted">
                    <th className="w-6 px-1.5 py-1.5" />
                    <th className="px-0.5 py-1.5 text-left font-medium">{t('Nom')}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t('Taille')}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t('Modifié')}</th>
                    <th className="w-6 px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {creating && (
                    <tr className="border-b border-border/40 bg-accent-soft">
                      <td className="w-6 px-1.5 py-1.5">
                        <Folder size={14} className="text-accent" />
                      </td>
                      <td colSpan={4} className="px-0.5 py-1.5">
                        <input
                          autoFocus
                          placeholder={t('Nom du nouveau dossier…')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void mkdirHere((e.target as HTMLInputElement).value)
                            if (e.key === 'Escape') setCreating(false)
                          }}
                          onBlur={(e) => void mkdirHere(e.target.value)}
                          className="w-full rounded border border-accent bg-bg px-1 py-0.5 text-[12px] text-fg outline-none"
                        />
                      </td>
                    </tr>
                  )}
                  {entries.map((entry) => {
                    const isSel = sel.has(entry.path)
                    const Icon =
                      entry.kind === 'directory' ? Folder : entry.kind === 'symlink' ? Link2 : File
                    return (
                      <tr
                        key={entry.path}
                        onClick={(e) => onRowClick(e, entry)}
                        onDoubleClick={() => onActivate(entry)}
                        title={
                          entry.kind === 'file'
                            ? t('{path}\nDouble-clic : modifier (ré-téléversé à la sauvegarde)', {
                                path: entry.path
                              })
                            : entry.path
                        }
                        className={`cursor-default border-b border-border/40 ${
                          isSel ? 'bg-accent-soft' : 'hover:bg-bg-hover'
                        }`}
                      >
                        <td className="w-6 px-1.5 py-1.5">
                          <Icon
                            size={14}
                            className={entry.kind === 'directory' ? 'text-accent' : 'text-fg-muted'}
                          />
                        </td>
                        {/* w-full : la colonne prend TOUTE la place restante ;
                            max-w-0 : le texte s'ellipse au lieu de l'élargir. */}
                        <td className="w-full max-w-0 truncate px-0.5 py-1.5">
                          {renaming?.path === entry.path ? (
                            <input
                              autoFocus
                              defaultValue={entry.name}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  void commitRename(entry, (e.target as HTMLInputElement).value)
                                if (e.key === 'Escape') setRenaming(null)
                              }}
                              onBlur={() => setRenaming(null)}
                              className="w-full rounded border border-accent bg-bg px-1 py-0.5 text-[12px] text-fg outline-none"
                            />
                          ) : (
                            <span className={isSel ? 'text-accent' : 'text-fg'}>{entry.name}</span>
                          )}
                        </td>
                        <td className="w-px whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-[11px] text-fg-muted">
                          {entry.kind === 'file' ? formatSize(entry.size, 'file') : ''}
                        </td>
                        <td className="w-px whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-[11px] text-fg-muted">
                          {entry.modifiedMs ? formatDate(entry.modifiedMs) : ''}
                        </td>
                        <td className="w-6 px-1 py-1.5 text-right">
                          {entry.kind === 'file' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                void editEntry(entry)
                              }}
                              title={t('Modifier (ré-téléversé à chaque sauvegarde)')}
                              className="grid h-5 w-5 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-accent"
                            >
                              <FileEdit size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {transfer && (
            <div className="shrink-0 border-t border-border bg-bg px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] text-fg-secondary">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Loader2 size={11} className="shrink-0 animate-spin text-accent" />
                  <span className="min-w-0 truncate">{transfer.file}</span>
                  {transfer.count > 1 && (
                    <span className="shrink-0 tabular-nums text-fg-muted">
                      ({transfer.index}/{transfer.count})
                    </span>
                  )}
                </span>
                <span className="shrink-0 pl-2 tabular-nums">
                  {transfer.total > 0 ? Math.round((transfer.done / transfer.total) * 100) : 0} % ·{' '}
                  {formatSize(transfer.done, 'file')} / {formatSize(transfer.total, 'file')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${transfer.total > 0 ? Math.round((transfer.done / transfer.total) * 100) : 0}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Barre d'état du volet : compteurs à gauche, geste-clé à droite. */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-[11px] text-fg-muted">
            <span className="shrink-0 tabular-nums">
              {tn(entries.length, '{n} élément', '{n} éléments')}
              {selected.length > 0 &&
                ` · ${tn(selected.length, '{n} sélectionné', '{n} sélectionnés')}`}
            </span>
            <span className="min-w-0 truncate text-right">
              {t('Glisser-déposer pour téléverser · téléchargements → dossier local actif')}
            </span>
          </div>
        </>
      )}
    </aside>
  )
}
