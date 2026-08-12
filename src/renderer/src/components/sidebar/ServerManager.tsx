import { useEffect, useMemo, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import {
  Server,
  X,
  Check,
  Search,
  Plus,
  Copy,
  Trash2,
  TerminalSquare,
  FolderOpen,
  Upload,
  Download,
  Network,
  KeyRound,
  Info
} from 'lucide-react'
import type { SshHost } from '@shared/types'
import { hostKeyOf, parseForwards, describeForward, forwardsToText, sshSubtitle } from '../../lib/ssh'
import { t, tn } from '../../i18n'

/**
 * Gestionnaire de connexions SSH/SFTP — refonte demandée (« tout est dans la
 * même fenêtre, on est obligé de scroller ») : dialogue plein écran, liste des
 * serveurs à gauche (recherche), édition à droite en ONGLETS — Général,
 * Authentification, Tunnels, Avancé — au lieu du formulaire à défilement.
 * Import/export/tout-retirer vivent ici désormais, plus dans la sidebar.
 *
 * La logique (parseForwards, savePassword, mergeHosts côté appelant) est
 * inchangée : la refonte est ergonomique, pas fonctionnelle.
 */

type Tab = 'general' | 'auth' | 'tunnels' | 'advanced'

/** Brouillon d'édition — miroir plat d'un SshHost + mot de passe saisi. */
interface Draft {
  hostName: string
  user: string
  port: string
  label: string
  password: string
  tunnels: string
  keyFile: string
  proxyJump: string
  keepAlive: boolean
  x11: boolean
  compression: boolean
}

function draftOf(h: SshHost | null): Draft {
  return {
    hostName: h?.hostName ?? '',
    user: h?.user ?? '',
    port: h?.port ? String(h.port) : '',
    label: h?.name ?? '',
    password: '',
    tunnels: forwardsToText(h?.forwards),
    keyFile: h?.keyFile ?? '',
    proxyJump: h?.proxyJump ?? '',
    keepAlive: h?.keepAlive ?? true,
    x11: h?.x11 ?? false,
    compression: h?.compression ?? false
  }
}

export default function ServerManager(props: {
  manualHosts: SshHost[]
  configHosts: SshHost[]
  /** Nom de l'hôte à sélectionner à l'ouverture ; 'new' = création. */
  initial?: string
  onSave: (host: SshHost, originalName?: string) => void
  onRemove: (name: string) => void
  onRemoveAll: () => void
  onExport: () => void
  onOpenImport: () => void
  onConnect: (host: SshHost) => void
  onBrowse: (host: SshHost) => void
  onClose: () => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  // Sélection : nom d'hôte, ou null = éditeur de création.
  const [selected, setSelected] = useState<string | null>(
    props.initial === 'new' ? null : (props.initial ?? props.manualHosts[0]?.name ?? props.configHosts[0]?.name ?? null)
  )
  const [tab, setTab] = useState<Tab>('general')
  const [canSave, setCanSave] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const all = useMemo(
    () => [
      ...props.manualHosts.map((h) => ({ host: h, readonly: false })),
      ...props.configHosts.map((h) => ({ host: h, readonly: true }))
    ],
    [props.manualHosts, props.configHosts]
  )
  const filtered = all.filter(
    ({ host }) =>
      !query.trim() ||
      `${host.name} ${host.hostName ?? ''} ${host.user ?? ''}`.toLowerCase().includes(query.toLowerCase())
  )

  const current = all.find(({ host }) => host.name === selected) ?? null
  const editingHost = current?.host ?? null
  const readonly = current?.readonly ?? false

  const [draft, setDraft] = useState<Draft>(() => draftOf(editingHost))
  const baseline = useMemo(() => JSON.stringify(draftOf(editingHost)), [editingHost])
  const dirty = JSON.stringify(draft) !== baseline

  // Changement de sélection : recharge le brouillon (confirmation si modifié).
  const select = (name: string | null): void => {
    if (dirty && !window.confirm(t('Modifications non enregistrées — les abandonner ?'))) return
    setSelected(name)
    const h = name === null ? null : (all.find(({ host }) => host.name === name)?.host ?? null)
    setDraft(draftOf(h))
    setTab('general')
    setSavedFlash(false)
  }

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

  const parsedForwards = parseForwards(draft.tunnels)
  const target = draft.hostName.trim()
  const valid = target.length > 0

  /** Construit le SshHost depuis le brouillon (mêmes règles que l'ancien formulaire). */
  const buildHost = (): SshHost => {
    const at = target.indexOf('@')
    const finalUser = at > 0 ? target.slice(0, at) : draft.user.trim() || undefined
    const finalHost = at > 0 ? target.slice(at + 1) : target
    const p = Number(draft.port)
    return {
      name: draft.label.trim() || finalHost,
      source: 'manual',
      hostName: finalHost,
      user: finalUser,
      port: Number.isInteger(p) && p > 0 && p < 65536 && p !== 22 ? p : undefined,
      forwards: parsedForwards.length ? parsedForwards : undefined,
      keyFile: draft.keyFile.trim() || undefined,
      proxyJump: draft.proxyJump.trim() || undefined,
      keepAlive: draft.keepAlive || undefined,
      x11: draft.x11 || undefined,
      compression: draft.compression || undefined
    }
  }

  const save = (): void => {
    if (!valid || readonly) return
    const host = buildHost()
    if (draft.password) void window.api.sftp.savePassword(hostKeyOf(host), draft.password)
    props.onSave(host, editingHost?.name)
    setSelected(host.name)
    setDraft({ ...draft, password: '' })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1600)
  }

  /** Copie modifiable d'un hôte du ~/.ssh/config (qui reste en lecture seule). */
  const duplicate = (): void => {
    if (!editingHost) return
    const copy: SshHost = { ...editingHost, source: 'manual', name: `${editingHost.name} (2)` }
    props.onSave(copy)
    setSelected(copy.name)
    setDraft(draftOf(copy))
  }

  const remove = (): void => {
    if (!editingHost || readonly) return
    if (!window.confirm(t('Retirer « {name} » de la liste ?', { name: editingHost.name }))) return
    props.onRemove(editingHost.name)
    setSelected(null)
    setDraft(draftOf(null))
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]): void => setDraft((d) => ({ ...d, [k]: v }))

  const field =
    'w-full rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent disabled:opacity-50'

  const TABS: { id: Tab; label: string; dot?: boolean }[] = [
    { id: 'general', label: t('Général') },
    { id: 'auth', label: t('Authentification'), dot: Boolean(draft.keyFile) },
    { id: 'tunnels', label: t('Tunnels'), dot: parsedForwards.length > 0 },
    { id: 'advanced', label: t('Avancé'), dot: Boolean(draft.proxyJump || draft.x11 || draft.compression) }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onMouseDown={props.onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        // resize: la fenêtre s'agrandit à la souris (poignée en bas à droite) —
        // demande utilisateur : les longs noms de serveurs ont besoin de place.
        className="relative z-10 flex h-[min(660px,90vh)] w-[min(980px,96vw)] overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        style={{ resize: 'both', minWidth: 560, minHeight: 420, maxWidth: '96vw', maxHeight: '92vh' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={18} maxSize={55}>
        {/* -------- Colonne gauche : liste des serveurs (redimensionnable) -------- */}
        <div className="flex h-full flex-col border-r border-border bg-bg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Server size={15} className="text-accent" />
            <span className="text-[13px] font-medium text-fg">{t('Serveurs')}</span>
            <span className="ml-auto text-[11px] tabular-nums text-fg-muted">{all.length}</span>
          </div>

          <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
            <Search size={13} className="shrink-0 text-fg-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Rechercher…')}
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-muted"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-[11px] text-fg-muted">
                {query ? t('Aucun serveur ne correspond.') : t('Aucun serveur — créez-en un ou importez.')}
              </p>
            )}
            {filtered.map(({ host, readonly: ro }) => (
              <button
                key={`${ro ? 'c' : 'm'}:${host.name}`}
                onClick={() => select(host.name)}
                title={`${host.name}\n${sshSubtitle(host)}`}
                className={`flex w-full flex-col gap-0.5 rounded-app px-2 py-1.5 text-left ${
                  selected === host.name ? 'bg-accent-soft' : 'hover:bg-bg-hover'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Server size={13} className={selected === host.name ? 'text-accent' : 'text-fg-muted'} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[12px] ${
                      selected === host.name ? 'text-accent' : 'text-fg'
                    }`}
                  >
                    {host.name}
                  </span>
                  {host.forwards?.length ? <Network size={11} className="shrink-0 text-fg-muted" /> : null}
                  {ro && (
                    <span className="shrink-0 rounded-full border border-border px-1 text-[9px] leading-[14px] text-fg-muted">
                      config
                    </span>
                  )}
                </span>
                <span className="truncate pl-[19px] text-[10px] text-fg-muted">{sshSubtitle(host)}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1 border-t border-border p-2">
            <button
              onClick={() => select(null)}
              className="flex items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
            >
              <Plus size={13} /> {t('Nouveau serveur')}
            </button>
            <div className="flex gap-1">
              <button
                onClick={props.onOpenImport}
                title={t('Importer depuis PuTTY, WinSCP ou ~/.ssh/config')}
                className="flex flex-1 items-center justify-center gap-1 rounded-app border border-border px-1.5 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover"
              >
                <Download size={11} /> {t('Importer')}
              </button>
              <button
                onClick={props.onExport}
                disabled={all.length === 0}
                title={t('Exporter au format ssh_config (compatible VS Code)')}
                className="flex flex-1 items-center justify-center gap-1 rounded-app border border-border px-1.5 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
              >
                <Upload size={11} /> {t('Exporter')}
              </button>
              <button
                onClick={props.onRemoveAll}
                disabled={props.manualHosts.length === 0}
                title={t('Tout retirer (ré-importables ensuite)')}
                className="grid w-7 place-items-center rounded-app border border-border text-fg-secondary hover:bg-bg-hover hover:text-danger-fg disabled:opacity-40"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>

        </Panel>
        <PanelResizeHandle className="group relative w-1.5 shrink-0">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-accent group-data-[resize-handle-active]:bg-accent" />
        </PanelResizeHandle>
        <Panel minSize={40}>
        {/* -------- Colonne droite : édition à onglets -------- */}
        <div className="flex h-full min-w-0 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="min-w-0 truncate text-[13px] font-medium text-fg">
              {editingHost
                ? editingHost.name
                : valid
                  ? draft.label.trim() || target.replace(/^.*@/, '')
                  : t('Nouveau serveur')}
            </span>
            {readonly && (
              <span className="rounded-full border border-border px-1.5 text-[10px] leading-[16px] text-fg-muted">
                {t('~/.ssh/config — lecture seule')}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1">
              {editingHost && (
                <>
                  <button
                    onClick={() => props.onConnect(editingHost)}
                    title={t('Ouvrir un terminal SSH')}
                    className="grid h-7 w-7 place-items-center rounded-app text-fg-secondary hover:bg-bg-hover hover:text-accent"
                  >
                    <TerminalSquare size={14} />
                  </button>
                  <button
                    onClick={() => props.onBrowse(editingHost)}
                    title={t('Parcourir les fichiers (SFTP)')}
                    className="grid h-7 w-7 place-items-center rounded-app text-fg-secondary hover:bg-bg-hover hover:text-accent"
                  >
                    <FolderOpen size={14} />
                  </button>
                  <button
                    onClick={duplicate}
                    title={readonly ? t('Dupliquer en serveur modifiable') : t('Dupliquer')}
                    className="grid h-7 w-7 place-items-center rounded-app text-fg-secondary hover:bg-bg-hover hover:text-fg"
                  >
                    <Copy size={13} />
                  </button>
                  {!readonly && (
                    <button
                      onClick={remove}
                      title={t('Retirer de la liste')}
                      className="grid h-7 w-7 place-items-center rounded-app text-fg-secondary hover:bg-bg-hover hover:text-danger-fg"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
              <button
                onClick={props.onClose}
                title={t('Fermer (Échap)')}
                className="ml-1 grid h-7 w-7 place-items-center rounded-app text-fg-muted hover:bg-bg-hover hover:text-fg"
              >
                <X size={15} />
              </button>
            </span>
          </div>

          {/* Onglets */}
          <div className="flex shrink-0 gap-0.5 border-b border-border px-3">
            {TABS.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex items-center gap-1 border-b-2 px-3 py-2 text-[12px] ${
                  tab === tb.id
                    ? 'border-accent text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg-secondary'
                }`}
              >
                {tb.label}
                {tb.dot && <span className="text-[9px] text-accent">●</span>}
              </button>
            ))}
          </div>

          {/* Contenu de l'onglet */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <fieldset disabled={readonly} className="m-0 border-0 p-0">
              {tab === 'general' && (
                <div className="flex max-w-md flex-col gap-3.5">
                  <Field label={t('Serveur (hôte ou IP)')} required hint={t('« user@hôte » est accepté aussi.')}>
                    <input
                      autoFocus={!editingHost}
                      value={draft.hostName}
                      onChange={(e) => set('hostName', e.target.value)}
                      placeholder={t('serveur.exemple.com')}
                      spellCheck={false}
                      className={field}
                    />
                  </Field>
                  <div className="flex gap-2.5">
                    <div className="min-w-0 flex-1">
                      <Field label={t('Utilisateur')} hint={t('root, ubuntu, deploy…')}>
                        <input
                          value={draft.user}
                          onChange={(e) => set('user', e.target.value)}
                          placeholder="root"
                          spellCheck={false}
                          className={field}
                        />
                      </Field>
                    </div>
                    <div className="w-24 shrink-0">
                      <Field label={t('Port')} hint={t('22 par défaut.')}>
                        <input
                          value={draft.port}
                          onChange={(e) => set('port', e.target.value.replace(/\D/g, ''))}
                          placeholder="22"
                          spellCheck={false}
                          className={`${field} text-center`}
                        />
                      </Field>
                    </div>
                  </div>
                  <Field label={t('Libellé')} hint={t("Nom affiché dans la liste. Vide = le nom d'hôte.")}>
                    <input
                      value={draft.label}
                      onChange={(e) => set('label', e.target.value)}
                      placeholder={t('Prod — site vitrine')}
                      spellCheck={false}
                      className={field}
                    />
                  </Field>
                </div>
              )}

              {tab === 'auth' && (
                <div className="flex max-w-md flex-col gap-3.5">
                  <Field
                    label={t('Mot de passe')}
                    hint={
                      canSave
                        ? t('Chiffré par Windows (jamais en clair). Vide = demandé à la connexion. Les clés SSH restent plus sûres.')
                        : t('Chiffrement indisponible sur cette machine : le mot de passe sera demandé à chaque connexion.')
                    }
                  >
                    <input
                      type="password"
                      value={draft.password}
                      onChange={(e) => set('password', e.target.value)}
                      disabled={!canSave || readonly}
                      placeholder={canSave ? (editingHost ? t('•••• (laisser vide pour conserver)') : '••••••••') : t('indisponible')}
                      className={field}
                    />
                  </Field>
                  <Field
                    label={t('Clé privée')}
                    hint={t('Format OpenSSH (les .ppk PuTTY doivent être convertis : PuTTYgen → Export OpenSSH key).')}
                  >
                    <span className="flex items-center gap-1.5">
                      <KeyRound size={13} className="shrink-0 text-fg-muted" />
                      <input
                        value={draft.keyFile}
                        onChange={(e) => set('keyFile', e.target.value)}
                        placeholder={t('C:\\Users\\vous\\.ssh\\id_ed25519')}
                        spellCheck={false}
                        className={`${field} font-mono`}
                      />
                    </span>
                  </Field>
                </div>
              )}

              {tab === 'tunnels' && (
                <div className="flex max-w-md flex-col gap-3.5">
                  <Field
                    label={t('Redirections de port')}
                    hint={t('Une par ligne. « 3001:localhost:3001 » rend le service distant accessible sur http://localhost:3001. Préfixez par R (distant) ou D (proxy SOCKS).')}
                  >
                    <textarea
                      value={draft.tunnels}
                      onChange={(e) => set('tunnels', e.target.value)}
                      placeholder={'3001:localhost:3001\n8080:localhost:80'}
                      spellCheck={false}
                      rows={4}
                      className={`${field} resize-y font-mono`}
                    />
                  </Field>
                  {parsedForwards.length > 0 && (
                    <ul className="flex flex-col gap-1 rounded-app border border-border bg-bg p-2.5 text-[11px] text-accent">
                      {parsedForwards.map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <Network size={11} /> {describeForward(f)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === 'advanced' && (
                <div className="flex max-w-md flex-col gap-3.5">
                  <Field
                    label={t('Relais / bastion (ProxyJump)')}
                    hint={t('« user@relais » ou « user@relais:port » — la connexion transite par cette machine. Terminal SSH uniquement pour l\'instant.')}
                  >
                    <input
                      value={draft.proxyJump}
                      onChange={(e) => set('proxyJump', e.target.value)}
                      placeholder={t('user@bastion.exemple.com')}
                      spellCheck={false}
                      className={field}
                    />
                  </Field>
                  <div className="flex flex-col gap-2 text-[12px] text-fg-secondary">
                    <Toggle
                      checked={draft.keepAlive}
                      onChange={(v) => set('keepAlive', v)}
                      label={t('Keep-alive (recommandé — évite les déconnexions des sessions inactives)')}
                    />
                    <Toggle
                      checked={draft.x11}
                      onChange={(v) => set('x11', v)}
                      label={t('Transfert X11 (applications graphiques distantes)')}
                    />
                    <Toggle
                      checked={draft.compression}
                      onChange={(v) => set('compression', v)}
                      label={t('Compression (liaisons lentes)')}
                    />
                  </div>
                </div>
              )}
            </fieldset>

            {readonly && (
              <p className="mt-4 flex max-w-md items-start gap-1.5 rounded-app border border-border bg-bg px-2.5 py-2 text-[11px] text-fg-muted">
                <Info size={13} className="mt-px shrink-0" />
                <span>
                  {t('Cet hôte vient de votre ~/.ssh/config : modifiez le fichier, ou dupliquez-le ici pour une copie modifiable.')}
                </span>
              </p>
            )}
          </div>

          {/* Pied : enregistrer */}
          {!readonly && (
            <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
              <button
                onClick={save}
                disabled={!valid || !dirty}
                className="flex items-center justify-center gap-1.5 rounded-app bg-accent px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <Check size={13} /> {editingHost ? t('Enregistrer') : t('Ajouter le serveur')}
              </button>
              {savedFlash && <span className="text-[11px] text-accent">{t('✓ Enregistré')}</span>}
              {dirty && !savedFlash && (
                <span className="text-[11px] text-fg-muted">{t('Modifications non enregistrées')}</span>
              )}
              <span className="ml-auto text-[11px] text-fg-muted">
                {tn(all.length, '{n} serveur', '{n} serveurs')}
              </span>
            </div>
          )}
        </div>
        </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}

function Field(p: {
  label: string
  hint: string
  required?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-fg">
        {p.label}
        {p.required && <span className="text-accent"> *</span>}
      </span>
      {p.children}
      <span className="text-[11px] text-fg-muted">{p.hint}</span>
    </label>
  )
}

function Toggle(p: { checked: boolean; onChange: (v: boolean) => void; label: string }): JSX.Element {
  return (
    <label className="flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={p.checked}
        onChange={(e) => p.onChange(e.target.checked)}
        className="accent-[var(--accent)]"
      />
      {p.label}
    </label>
  )
}
