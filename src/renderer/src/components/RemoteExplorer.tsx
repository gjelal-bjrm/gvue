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
  KeyRound
} from 'lucide-react'
import type { SftpEntry, SftpProgress } from '@shared/types'
import { useUiStore } from '../state/useUiStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { formatSize, formatDate } from '../lib/format'
import { sshSubtitle } from '../lib/ssh'

/** Chemin parent d'un chemin distant POSIX (« / » reste « / »). */
function remoteParent(p: string): string {
  if (p === '/' || !p.includes('/')) return '/'
  const cut = p.replace(/\/+$/, '').lastIndexOf('/')
  return cut <= 0 ? '/' : p.slice(0, cut)
}

type Phase =
  | { step: 'connecting' }
  | { step: 'fingerprint'; fingerprint: string }
  | { step: 'password'; message?: string }
  | { step: 'error'; message: string }
  | { step: 'ready' }

/**
 * Explorateur SFTP (phase 2 de l'accès distant) : navigation dans les dossiers
 * du serveur, téléchargement vers le dossier local actif, téléversement
 * (bouton ou glisser-déposer local → distant), renommer/supprimer/mkdir, et
 * « Modifier » = ouverture locale avec ré-téléversement à chaque sauvegarde.
 */
export default function RemoteExplorer(): JSX.Element | null {
  const host = useUiStore((s) => s.remoteHost)
  const close = (): void => useUiStore.getState().setRemoteHost(null)
  const localDir = useNavStore((s) => activePane(s).path)

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
  const passwordRef = useRef<HTMLInputElement>(null)
  // Empreinte acceptée dans CE flux : re-transmise avec le mot de passe.
  const acceptedFpRef = useRef<string | undefined>(undefined)

  const toast = (m: string): void => useUiStore.getState().showToast(m)

  const refresh = useCallback(
    async (key: string, dir: string): Promise<void> => {
      setLoading(true)
      const r = await window.api.sftp.list(key, dir)
      setLoading(false)
      if (r.error) {
        toast(`SFTP : ${r.error}`)
        setEntries([])
      } else {
        setEntries(r.entries ?? [])
      }
      setSel(new Set())
    },
    []
  )

  // Connexion (machine à états : empreinte → mot de passe → prêt).
  const attempt = useCallback(
    async (opts?: { password?: string; acceptFingerprint?: string }): Promise<void> => {
      if (!host) return
      setPhase({ step: 'connecting' })
      const r = await window.api.sftp.connect(host, opts)
      if (r.status === 'ok') {
        const key = `${host.hostName ?? host.name}:${host.port ?? 22}:${host.user ?? ''}`
        setHostKey(key)
        setPhase({ step: 'ready' })
        setPath(r.home)
        void refresh(key, r.home)
      } else if (r.status === 'fingerprint') {
        setPhase({ step: 'fingerprint', fingerprint: r.fingerprint })
      } else if (r.status === 'password') {
        setPhase({ step: 'password', message: r.message })
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

  useEffect(() => {
    if (!host) return
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
    if (r.error) toast(`Édition : ${r.error}`)
    else toast(`${entry.name} ouvert — chaque sauvegarde est ré-téléversée sur le serveur.`)
  }

  const downloadSel = async (): Promise<void> => {
    if (!selected.length || !localDir) return
    setBusy(true)
    const r = await window.api.sftp.download(hostKey, selected, localDir)
    setBusy(false)
    toast(
      r.errors.length
        ? `Téléchargement : ${r.ok} OK, ${r.errors.length} échec(s) — ${r.errors[0]}`
        : `${r.ok} élément${r.ok > 1 ? 's' : ''} téléchargé${r.ok > 1 ? 's' : ''} dans ${localDir}`
    )
    useNavStore.getState().refreshAll()
  }

  const uploadPaths = async (paths: string[]): Promise<void> => {
    if (!paths.length) return
    setBusy(true)
    const r = await window.api.sftp.upload(hostKey, paths, path)
    setBusy(false)
    toast(
      r.errors.length
        ? `Téléversement : ${r.ok} OK, ${r.errors.length} échec(s) — ${r.errors[0]}`
        : `${r.ok} élément${r.ok > 1 ? 's' : ''} téléversé${r.ok > 1 ? 's' : ''}.`
    )
    void refresh(hostKey, path)
  }

  const uploadFromLocalSel = (): void => {
    const localSel = activePane(useNavStore.getState()).selected
    if (!localSel.length) {
      toast('Sélectionnez d’abord des fichiers dans le volet local.')
      return
    }
    void uploadPaths(localSel)
  }

  const mkdirHere = async (): Promise<void> => {
    const name = window.prompt('Nom du nouveau dossier distant :')
    if (!name?.trim()) return
    const r = await window.api.sftp.mkdir(hostKey, path === '/' ? `/${name}` : `${path}/${name}`)
    if (r.error) toast(`mkdir : ${r.error}`)
    else void refresh(hostKey, path)
  }

  const commitRename = async (entry: SftpEntry, newName: string): Promise<void> => {
    setRenaming(null)
    const name = newName.trim()
    if (!name || name === entry.name) return
    const to = `${remoteParent(entry.path)}/${name}`.replace('//', '/')
    const r = await window.api.sftp.rename(hostKey, entry.path, to)
    if (r.error) toast(`Renommage : ${r.error}`)
    else void refresh(hostKey, path)
  }

  const deleteSel = async (): Promise<void> => {
    if (!selected.length) return
    const n = selected.length
    if (
      !window.confirm(
        `Supprimer ${n} élément${n > 1 ? 's' : ''} du SERVEUR ? Pas de corbeille en SFTP : c'est définitif.`
      )
    )
      return
    setBusy(true)
    const r = await window.api.sftp.delete(hostKey, selected)
    setBusy(false)
    if (r.errors.length) toast(`Suppression : ${r.ok} OK, ${r.errors.length} échec(s) — ${r.errors[0]}`)
    void refresh(hostKey, path)
  }

  const disconnect = (): void => {
    if (hostKey) void window.api.sftp.disconnect(hostKey)
    close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onMouseDown={disconnect}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 flex max-h-[88vh] w-[min(880px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          if (phase.step !== 'ready') return
          e.preventDefault()
          setDropOver(true)
        }}
        onDragLeave={() => setDropOver(false)}
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
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Server size={15} className="shrink-0 text-accent" />
          <span className="text-[13px] font-medium text-fg">{host.name}</span>
          <span className="min-w-0 truncate text-[11px] text-fg-muted">{sshSubtitle(host)}</span>
          <button
            onClick={disconnect}
            title="Se déconnecter et fermer (Échap)"
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        {/* Étapes de connexion */}
        {phase.step === 'connecting' && (
          <p className="flex items-center justify-center gap-2 py-14 text-[13px] text-fg-muted">
            <Loader2 size={15} className="animate-spin" /> Connexion à {host.name}…
          </p>
        )}

        {phase.step === 'fingerprint' && (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <ShieldQuestion size={28} className="text-warning-fg" />
            <p className="text-[13px] text-fg">Première connexion à ce serveur.</p>
            <p className="text-[12px] text-fg-secondary">
              Empreinte de sa clé : <code className="font-mono text-[11px]">{phase.fingerprint}</code>
            </p>
            <p className="max-w-md text-[11px] text-fg-muted">
              Vérifiez-la auprès de l'administrateur si le serveur est sensible. Elle sera
              mémorisée : toute future différence bloquera la connexion.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  acceptedFpRef.current = phase.fingerprint
                  void attempt({ acceptFingerprint: phase.fingerprint })
                }}
                className="rounded-app bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
              >
                Faire confiance et continuer
              </button>
              <button
                onClick={disconnect}
                className="rounded-app border border-border px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {phase.step === 'password' && (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <KeyRound size={26} className="text-accent" />
            <p className="text-[13px] text-fg">
              Mot de passe pour {host.user ? `${host.user}@` : ''}
              {host.hostName ?? host.name}
            </p>
            {phase.message && <p className="text-[12px] text-danger-fg">{phase.message}</p>}
            <input
              ref={passwordRef}
              type="password"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void attempt({
                  password: passwordRef.current?.value ?? '',
                  acceptFingerprint: acceptedFpRef.current
                })
              }}
              className="w-64 rounded-app border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
            />
            <p className="text-[11px] text-fg-muted">Utilisé pour cette session, jamais stocké.</p>
            <button
              onClick={() => void attempt({
                  password: passwordRef.current?.value ?? '',
                  acceptFingerprint: acceptedFpRef.current
                })}
              className="rounded-app bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
            >
              Se connecter
            </button>
          </div>
        )}

        {phase.step === 'error' && (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="max-w-lg break-words text-[12px] text-danger-fg">{phase.message}</p>
            {/timed out/i.test(phase.message) && (
              <p className="max-w-md text-[11px] text-fg-muted">
                Le serveur n'a pas répondu — beaucoup limitent les connexions rapprochées
                (anti-abus). Patientez ~30 secondes avant de réessayer.
              </p>
            )}
            <button
              onClick={() => void attempt({ acceptFingerprint: acceptedFpRef.current })}
              className="rounded-app border border-border px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Explorateur */}
        {phase.step === 'ready' && (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
              <button
                onClick={() => navigate(remoteParent(path))}
                disabled={path === '/'}
                title="Dossier parent"
                className="grid h-7 w-7 place-items-center rounded-app text-fg-secondary hover:bg-bg-hover disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                onClick={() => void refresh(hostKey, path)}
                title="Actualiser"
                className="grid h-7 w-7 place-items-center rounded-app text-fg-secondary hover:bg-bg-hover"
              >
                <RotateCw size={13} />
              </button>
              <code className="min-w-0 flex-1 truncate rounded-app border border-border bg-bg px-2 py-1 font-mono text-[12px] text-fg-secondary">
                {path}
              </code>
              <button
                onClick={() => void downloadSel()}
                disabled={busy || selected.length === 0}
                title={`Télécharger la sélection vers ${localDir || 'le volet actif'}`}
                className="flex items-center gap-1.5 rounded-app bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <Download size={13} /> Télécharger{selected.length > 0 ? ` (${selected.length})` : ''}
              </button>
              <button
                onClick={uploadFromLocalSel}
                disabled={busy}
                title="Téléverser la sélection du volet local vers ce dossier distant (ou glissez-déposez)"
                className="flex items-center gap-1.5 rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
              >
                <Upload size={13} /> Téléverser
              </button>
              <button
                onClick={() => void mkdirHere()}
                disabled={busy}
                title="Nouveau dossier distant"
                className="grid h-7 w-7 place-items-center rounded-app text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
              >
                <FolderPlus size={14} />
              </button>
              <button
                onClick={() => selected.length === 1 && setRenaming(selected[0])}
                disabled={busy || selected.length !== 1}
                title="Renommer"
                className="grid h-7 w-7 place-items-center rounded-app text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => void deleteSel()}
                disabled={busy || selected.length === 0}
                title="Supprimer du serveur (définitif)"
                className="grid h-7 w-7 place-items-center rounded-app text-fg-muted hover:bg-bg-hover hover:text-danger-fg disabled:opacity-40"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div
              className={`min-h-0 flex-1 overflow-auto ${dropOver ? 'ring-2 ring-inset ring-accent' : ''}`}
            >
              {loading ? (
                <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-fg-muted">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </p>
              ) : entries.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-fg-muted">
                  Dossier vide — glissez des fichiers ici pour les téléverser.
                </p>
              ) : (
                <table className="w-full text-[12px]">
                  <tbody>
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
                              ? `${entry.path}\nDouble-clic : ouvrir en édition (ré-téléversé à la sauvegarde)`
                              : entry.path
                          }
                          className={`cursor-default border-b border-border/40 ${
                            isSel ? 'bg-accent-soft' : 'hover:bg-bg-hover'
                          }`}
                        >
                          <td className="w-7 px-2 py-1.5">
                            <Icon
                              size={14}
                              className={entry.kind === 'directory' ? 'text-accent' : 'text-fg-muted'}
                            />
                          </td>
                          <td className="max-w-[300px] truncate px-1 py-1.5">
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
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-fg-secondary">
                            {entry.kind === 'file' ? formatSize(entry.size, 'file') : '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-fg-muted">
                            {entry.modifiedMs ? formatDate(entry.modifiedMs) : ''}
                          </td>
                          <td className="w-8 px-2 py-1.5 text-right">
                            {entry.kind === 'file' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void editEntry(entry)
                                }}
                                title="Modifier (ré-téléversé à chaque sauvegarde)"
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

            {/* Barre de progression des transferts */}
            {transfer && (
              <div className="shrink-0 border-t border-border px-3 py-1.5">
                <div className="mb-1 flex items-center justify-between text-[11px] text-fg-secondary">
                  <span className="min-w-0 truncate">
                    {transfer.file}
                    {transfer.count > 1 && ` (${transfer.index}/${transfer.count})`}
                  </span>
                  <span className="shrink-0 pl-2 tabular-nums">
                    {formatSize(transfer.done, 'file')} / {formatSize(transfer.total, 'file')}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{
                      width: `${transfer.total > 0 ? Math.round((transfer.done / transfer.total) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>
            )}

            <div className="shrink-0 border-t border-border px-3 py-1.5 text-[11px] text-fg-muted">
              Double-clic : ouvrir un dossier / modifier un fichier · glisser-déposer depuis le
              volet local pour téléverser · téléchargements vers le dossier local actif
            </div>
          </>
        )}
      </div>
    </div>
  )
}
