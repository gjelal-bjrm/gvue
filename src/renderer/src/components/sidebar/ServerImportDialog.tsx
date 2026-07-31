import { useEffect, useMemo, useState } from 'react'
import { DownloadCloud, X, Loader2, Server } from 'lucide-react'
import type { SshHost } from '@shared/types'
import { sshSubtitle } from '../../lib/ssh'
import { t } from '../../i18n'

/**
 * Import des sessions PuTTY/WinSCP — le dialogue façon WinSCP, en mieux :
 * tout est pré-coché, groupé par source, dédupliqué à l'import, et on dit
 * clairement que les mots de passe ne voyagent pas (GVue n'en stocke aucun).
 */
export default function ServerImportDialog(props: {
  /** Hôtes déjà présents (pour griser ceux qui existent déjà). */
  existing: SshHost[]
  onImport: (hosts: SshHost[]) => void
  onClose: () => void
}): JSX.Element {
  const [sources, setSources] = useState<{
    putty: SshHost[]
    winscp: SshHost[]
    sshConfig: SshHost[]
  } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const keyOf = (source: string, h: SshHost): string => `${source}:${h.name}`
  const existingNames = useMemo(() => new Set(props.existing.map((h) => h.name)), [props.existing])

  useEffect(() => {
    void Promise.all([
      window.api.ssh.importSources(),
      window.api.ssh.configHosts().catch(() => [] as SshHost[])
    ]).then(([s, sshConfig]) => {
      setSources({ ...s, sshConfig })
      // Tout pré-cocher, sauf ce qui existe déjà sous le même nom.
      const all = new Set<string>()
      for (const h of s.putty) if (!existingNames.has(h.name)) all.add(keyOf('putty', h))
      for (const h of s.winscp) if (!existingNames.has(h.name)) all.add(keyOf('winscp', h))
      for (const h of sshConfig) if (!existingNames.has(h.name)) all.add(keyOf('sshConfig', h))
      setChecked(all)
    })
  }, [existingNames])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  const toggle = (key: string): void =>
    setChecked((prev) => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })

  const total =
    (sources?.putty.length ?? 0) + (sources?.winscp.length ?? 0) + (sources?.sshConfig.length ?? 0)

  const doImport = (): void => {
    if (!sources) return
    const picked: SshHost[] = [
      ...sources.putty.filter((h) => checked.has(keyOf('putty', h))),
      ...sources.winscp.filter((h) => checked.has(keyOf('winscp', h))),
      // Les hôtes du ssh_config gardent source:'config' → connexion par alias.
      ...sources.sshConfig.filter((h) => checked.has(keyOf('sshConfig', h)))
    ]
    props.onImport(picked)
    props.onClose()
  }

  const Group = ({ title, source, hosts }: { title: string; source: string; hosts: SshHost[] }):
    | JSX.Element
    | null => {
    if (hosts.length === 0) return null
    return (
      <div className="mb-2">
        <p className="mb-1 px-1 text-[11px] uppercase tracking-wider text-fg-muted">{title}</p>
        {hosts.map((h) => {
          const key = keyOf(source, h)
          const already = existingNames.has(h.name)
          return (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-2 rounded-app px-1.5 py-1 hover:bg-bg-hover ${
                already ? 'opacity-50' : ''
              }`}
              title={already ? t('Un serveur de ce nom existe déjà dans GVue') : sshSubtitle(h)}
            >
              <input
                type="checkbox"
                checked={checked.has(key)}
                onChange={() => toggle(key)}
                className="accent-[var(--accent)]"
              />
              <Server size={13} className="shrink-0 text-fg-muted" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-fg">{h.name}</span>
              <span className="max-w-[45%] shrink-0 truncate text-[11px] text-fg-muted">
                {sshSubtitle(h)}
              </span>
            </label>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onMouseDown={props.onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 flex max-h-[80vh] w-[min(460px,92vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <DownloadCloud size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">{t('Importer des serveurs')}</span>
          <button
            onClick={props.onClose}
            title={t('Fermer (Échap)')}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {!sources ? (
            <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-fg-muted">
              <Loader2 size={14} className="animate-spin" /> {t('Recherche des sessions PuTTY/WinSCP…')}
            </p>
          ) : total === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-fg-muted">
              {t('Aucune session PuTTY ou WinSCP trouvée sur cette machine (registre et WinSCP.ini vérifiés).')}
            </p>
          ) : (
            <>
              <Group title="PuTTY" source="putty" hosts={sources.putty} />
              <Group title="WinSCP" source="winscp" hosts={sources.winscp} />
              <Group title={t('Fichier ~/.ssh/config')} source="sshConfig" hosts={sources.sshConfig} />
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-2.5">
          {total > 0 && sources && (
            <button
              onClick={() => {
                if (checked.size > 0) {
                  setChecked(new Set())
                } else {
                  const all = new Set<string>()
                  for (const h of sources.putty) all.add(keyOf('putty', h))
                  for (const h of sources.winscp) all.add(keyOf('winscp', h))
                  for (const h of sources.sshConfig) all.add(keyOf('sshConfig', h))
                  setChecked(all)
                }
              }}
              className="mb-2 text-[11px] text-fg-muted hover:text-fg"
            >
              {checked.size > 0 ? t('Tout décocher') : t('Tout cocher')}
            </button>
          )}
          <p className="mb-2 text-[11px] text-fg-muted">
            {t('Nom, hôte, utilisateur et port uniquement — les mots de passe ne sont jamais importés : GVue utilise vos clés SSH ou le demande à la connexion.')}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={doImport}
              disabled={checked.size === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {t('Importer ({count})', { count: checked.size })}
            </button>
            <button
              onClick={props.onClose}
              className="flex-1 rounded-app border border-border px-2 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
            >
              {t('Annuler')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
