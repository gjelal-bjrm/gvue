import { useEffect, useState } from 'react'
import { Server, X, Check, Info, ChevronRight, ChevronDown } from 'lucide-react'
import type { SshHost } from '@shared/types'
import { hostKeyOf, parseForwards, describeForward, forwardsToText } from '../../lib/ssh'
import { t } from '../../i18n'

/**
 * Dialogue d'ajout d'un serveur SSH/SFTP : un champ = un libellé + une aide,
 * seul l'hôte est obligatoire. Le mot de passe est facultatif et, s'il est
 * fourni, stocké CHIFFRÉ par l'OS (jamais dans le fichier de config en clair).
 */
export default function ServerAddForm(props: {
  /** Hôte à modifier (le formulaire arrive pré-rempli) ; absent = ajout. */
  editing?: SshHost | null
  onAdd: (host: SshHost, originalName?: string) => void
  onClose: () => void
}): JSX.Element {
  const e = props.editing
  const [hostName, setHostName] = useState(e?.hostName ?? '')
  const [user, setUser] = useState(e?.user ?? '')
  const [port, setPort] = useState(e?.port ? String(e.port) : '')
  const [label, setLabel] = useState(e?.name ?? '')
  const [password, setPassword] = useState('')
  const [tunnels, setTunnels] = useState(forwardsToText(e?.forwards))
  const [canSave, setCanSave] = useState(false)
  const parsedForwards = parseForwards(tunnels)
  // Options avancées (les panneaux importants de PuTTY : Auth, Proxy, Connection…).
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(e?.keyFile || e?.proxyJump || e?.keepAlive || e?.x11 || e?.compression)
  )
  const [keyFile, setKeyFile] = useState(e?.keyFile ?? '')
  const [proxyJump, setProxyJump] = useState(e?.proxyJump ?? '')
  const [keepAlive, setKeepAlive] = useState(e?.keepAlive ?? true)
  const [x11, setX11] = useState(e?.x11 ?? false)
  const [compression, setCompression] = useState(e?.compression ?? false)

  useEffect(() => {
    void window.api.sftp
      .secretsAvailable()
      .then(setCanSave)
      .catch(() => setCanSave(false))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  const target = hostName.trim()
  const valid = target.length > 0

  const submit = (): void => {
    if (!valid) return
    // Tolère « user@hôte » collé dans le champ hôte (réflexe SSH courant).
    const at = target.indexOf('@')
    const finalUser = at > 0 ? target.slice(0, at) : user.trim() || undefined
    const finalHost = at > 0 ? target.slice(at + 1) : target
    const p = Number(port)
    const host: SshHost = {
      name: label.trim() || finalHost,
      source: 'manual',
      hostName: finalHost,
      user: finalUser,
      port: Number.isInteger(p) && p > 0 && p < 65536 && p !== 22 ? p : undefined,
      forwards: parsedForwards.length ? parsedForwards : undefined,
      keyFile: keyFile.trim() || undefined,
      proxyJump: proxyJump.trim() || undefined,
      keepAlive: keepAlive || undefined,
      x11: x11 || undefined,
      compression: compression || undefined
    }
    if (password) {
      void window.api.sftp.savePassword(hostKeyOf(host), password)
    }
    props.onAdd(host, e?.name)
    props.onClose()
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') submit()
  }

  const field =
    'w-full rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent'

  const Field = (p: {
    label: string
    hint: string
    required?: boolean
    children: React.ReactNode
  }): JSX.Element => (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-fg">
        {p.label}
        {p.required && <span className="text-accent"> *</span>}
      </span>
      {p.children}
      <span className="text-[11px] text-fg-muted">{p.hint}</span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onMouseDown={props.onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 flex max-h-[86vh] w-[min(420px,92vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Server size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">
            {e ? t('Modifier « {name} »', { name: e.name }) : t('Ajouter un serveur')}
          </span>
          <button
            onClick={props.onClose}
            title={t('Fermer (Échap)')}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <Field
            label={t('Serveur (hôte ou IP)')}
            hint={t('Ex. : serveur.exemple.com ou 192.168.1.10 — « user@hôte » est accepté aussi.')}
            required
          >
            <input
              autoFocus
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              onKeyDown={onKey}
              placeholder={t('serveur.exemple.com')}
              spellCheck={false}
              className={field}
            />
          </Field>

          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Field label={t('Utilisateur')} hint={t('Compte de connexion (root, ubuntu, deploy…).')}>
                <input
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="root"
                  spellCheck={false}
                  className={field}
                />
              </Field>
            </div>
            <div className="w-24 shrink-0">
              <Field label={t('Port')} hint={t('22 par défaut.')}>
                <input
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={onKey}
                  placeholder="22"
                  spellCheck={false}
                  className={`${field} text-center`}
                />
              </Field>
            </div>
          </div>

          <Field label={t('Libellé')} hint={t("Nom affiché dans la liste. Vide = le nom d'hôte.")}>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={onKey}
              placeholder={t('Prod — site vitrine')}
              spellCheck={false}
              className={field}
            />
          </Field>

          <Field
            label={t('Mot de passe (facultatif)')}
            hint={
              canSave
                ? e
                  ? t("Laissez vide pour conserver l'existant. S'il est saisi, il est chiffré par Windows.")
                  : t("Laissez vide pour qu'il soit demandé à la connexion. S'il est saisi, il est chiffré par Windows — les clés SSH restent plus sûres.")
                : t('Chiffrement indisponible sur cette machine : le mot de passe sera demandé à chaque connexion.')
            }
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKey}
              disabled={!canSave}
              placeholder={canSave ? '••••••••' : t('indisponible')}
              className={`${field} disabled:opacity-50`}
            />
          </Field>

          <Field
            label={t('Tunnels (redirections de port)')}
            hint={t('Une par ligne. « 3001:localhost:3001 » rend le service distant accessible sur http://localhost:3001. Préfixez par R (distant) ou D (proxy SOCKS).')}
          >
            <textarea
              value={tunnels}
              onChange={(e) => setTunnels(e.target.value)}
              placeholder={'3001:localhost:3001\n8080:localhost:80'}
              spellCheck={false}
              rows={2}
              className={`${field} resize-y font-mono`}
            />
          </Field>
          {parsedForwards.length > 0 && (
            <ul className="-mt-1 flex flex-col gap-0.5 text-[11px] text-accent">
              {parsedForwards.map((f, i) => (
                <li key={i}>✓ {describeForward(f)}</li>
              ))}
            </ul>
          )}

          {/* Options avancées : clé, relais, keep-alive, X11, compression. */}
          <button
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex items-center gap-1 text-left text-[12px] text-fg-secondary hover:text-fg"
          >
            {advancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {t('Options avancées')}
            {!advancedOpen && (keyFile || proxyJump || x11 || compression) && (
              <span className="text-[10px] text-accent">●</span>
            )}
          </button>
          {advancedOpen && (
            <div className="flex flex-col gap-3 rounded-app border border-border bg-bg p-2.5">
              <Field
                label={t('Clé privée')}
                hint={t("Chemin d'une clé OpenSSH (ex. C:\\Users\\vous\\.ssh\\id_ed25519). Les .ppk PuTTY doivent être convertis (PuTTYgen → Export OpenSSH key).")}
              >
                <input
                  value={keyFile}
                  onChange={(ev) => setKeyFile(ev.target.value)}
                  onKeyDown={onKey}
                  placeholder={t('C:\\Users\\vous\\.ssh\\id_ed25519')}
                  spellCheck={false}
                  className={`${field} font-mono`}
                />
              </Field>
              <Field
                label={t('Relais / bastion (ProxyJump)')}
                hint={t('« user@relais » ou « user@relais:port » — la connexion transite par cette machine. Terminal SSH uniquement pour l\'instant.')}
              >
                <input
                  value={proxyJump}
                  onChange={(ev) => setProxyJump(ev.target.value)}
                  onKeyDown={onKey}
                  placeholder={t('user@bastion.exemple.com')}
                  spellCheck={false}
                  className={field}
                />
              </Field>
              <div className="flex flex-col gap-1.5 text-[12px] text-fg-secondary">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={keepAlive}
                    onChange={(ev) => setKeepAlive(ev.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  {t('Keep-alive (recommandé — évite les déconnexions des sessions inactives)')}
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={x11}
                    onChange={(ev) => setX11(ev.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  {t('Transfert X11 (applications graphiques distantes)')}
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={compression}
                    onChange={(ev) => setCompression(ev.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  {t('Compression (liaisons lentes)')}
                </label>
              </div>
            </div>
          )}

          <p className="flex items-start gap-1.5 rounded-app border border-border bg-bg px-2 py-1.5 text-[11px] text-fg-muted">
            <Info size={13} className="mt-px shrink-0" />
            <span>
              {t("Le clic ouvre un terminal SSH, l'icône dossier l'explorateur de fichiers (SFTP). Les hôtes de votre")}{' '}
              <code className="font-mono">~/.ssh/config</code>{' '}
              {t('apparaissent automatiquement, sans passer par ce formulaire.')}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 gap-1.5 border-t border-border px-4 py-2.5">
          <button
            onClick={submit}
            disabled={!valid}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <Check size={13} /> {e ? t('Enregistrer') : t('Ajouter')}
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
  )
}
