import { useEffect, useState } from 'react'
import {
  Settings,
  Check,
  X,
  Save,
  Trash2,
  DownloadCloud,
  Sparkles,
  FileText,
  TerminalSquare
} from 'lucide-react'
import { useAppearanceStore } from '../state/useAppearanceStore'
import { useUiStore } from '../state/useUiStore'
import { useUpdateStore } from '../state/useUpdateStore'
import { useNavStore } from '../state/useNavStore'
import { useTerminalStore } from '../state/useTerminalStore'
import { ACCENT_SWATCHES, FONT_CHOICES } from '../theme/presets'
import type { Appearance, UpdateStatus } from '@shared/types'

/** Libellé court de l'état de mise à jour, pour la section « À propos ». */
function updateLabel(s: UpdateStatus): string {
  switch (s.state) {
    case 'checking':
      return 'Recherche de mises à jour…'
    case 'available':
      return `Mise à jour v${s.version} disponible…`
    case 'downloading':
      return `Téléchargement… ${s.percent}%`
    case 'ready':
      return `Mise à jour v${s.version} prête — redémarrez pour installer`
    case 'none':
      return 'À jour ✓'
    case 'error':
      return 'Échec de la vérification'
    case 'unsupported':
      return 'Mises à jour indisponibles (mode dev)'
    default:
      return 'Cliquez sur « Vérifier » pour rechercher'
  }
}

type Section = 'appearance' | 'general' | 'about'

/**
 * Panneau Paramètres (⚙, en haut à droite) : Apparence (thème, couleurs,
 * presets…), Général (comportements) et À propos (version, mises à jour).
 * NB : le drapeau d'ouverture s'appelle encore `appearanceOpen` dans le uiStore
 * (nom historique, persisté dans les espaces de travail).
 */
export default function SettingsPanel(): JSX.Element {
  const closePanel = useUiStore((s) => s.toggleAppearance)
  const [section, setSection] = useState<Section>('appearance')

  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto border-l border-border bg-bg-secondary p-3.5 text-[13px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Settings size={16} className="text-accent" />
          Paramètres
        </div>
        <button
          onClick={closePanel}
          title="Fermer le panneau"
          className="grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <X size={15} />
        </button>
      </div>

      {/* Sections */}
      <div className="flex gap-1 rounded-app border border-border bg-bg p-0.5">
        {(
          [
            ['appearance', 'Apparence'],
            ['general', 'Général'],
            ['about', 'À propos']
          ] as [Section, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`min-w-0 flex-1 truncate rounded-app px-2 py-1 text-[12px] ${
              section === key ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'appearance' && <AppearanceSection />}
      {section === 'general' && <GeneralSection />}
      {section === 'about' && <AboutSection />}
    </aside>
  )
}

/* ------------------------------- Apparence ------------------------------- */

function AppearanceSection(): JSX.Element {
  const { appearance, update, savePreset, applyPreset, deletePreset } = useAppearanceStore()
  const [presetName, setPresetName] = useState('')
  const presetNames = Object.keys(appearance.presets)

  const onSavePreset = (): void => {
    const name = presetName.trim()
    if (!name) return
    savePreset(name)
    setPresetName('')
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Couleur d'accent">
        <div className="flex flex-wrap gap-2">
          {ACCENT_SWATCHES.map((s) => {
            const active = appearance.accent.toLowerCase() === s.value.toLowerCase()
            return (
              <button
                key={s.value}
                aria-label={s.label}
                aria-pressed={active}
                title={s.label}
                onClick={() => update({ accent: s.value })}
                className="grid h-[22px] w-[22px] place-items-center rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: s.value,
                  borderColor: active ? 'var(--fg)' : 'transparent'
                }}
              >
                {active && <Check size={12} className="text-white" />}
              </button>
            )
          })}
          {/* Sélecteur libre */}
          <label
            title="Couleur personnalisée"
            className="relative grid h-[22px] w-[22px] cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-border"
          >
            <input
              type="color"
              value={appearance.accent}
              onChange={(e) => update({ accent: e.target.value })}
              className="h-8 w-8 cursor-pointer opacity-0"
            />
            <span className="pointer-events-none absolute text-[11px] text-fg-muted">+</span>
          </label>
        </div>
      </Field>

      <Field label="Thème">
        <Segmented<Appearance['theme']>
          value={appearance.theme}
          options={[
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
            { value: 'auto', label: 'Auto' }
          ]}
          onChange={(v) => update({ theme: v })}
        />
      </Field>

      <Field label="Densité">
        <Segmented<Appearance['density']>
          value={appearance.density}
          options={[
            { value: 'comfortable', label: 'Confort' },
            { value: 'compact', label: 'Compact' }
          ]}
          onChange={(v) => update({ density: v })}
        />
      </Field>

      <Field label="Coins">
        <Segmented<Appearance['corners']>
          value={appearance.corners}
          options={[
            { value: 'rounded', label: 'Arrondis' },
            { value: 'square', label: 'Carrés' }
          ]}
          onChange={(v) => update({ corners: v })}
        />
      </Field>

      <Field label="Police">
        <select
          value={appearance.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
          className="w-full rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none focus:border-accent"
        >
          {FONT_CHOICES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Taille de l'interface — ${appearance.fontSize}px`}>
        <input
          type="range"
          min={11}
          max={17}
          step={1}
          value={appearance.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      <Field label={`Opacité de la fenêtre — ${Math.round(appearance.windowOpacity * 100)} %`}>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={appearance.windowOpacity}
          onChange={(e) => update({ windowOpacity: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      <Field label="Curseur clignotant du titre">
        <Segmented<'on' | 'off'>
          value={appearance.titleCursor ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'Activé' },
            { value: 'off', label: 'Désactivé' }
          ]}
          onChange={(v) => update({ titleCursor: v === 'on' })}
        />
      </Field>

      <Field label="Presets">
        <div className="flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSavePreset()
            }}
            placeholder="Nom du preset…"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
          />
          <button
            onClick={onSavePreset}
            disabled={!presetName.trim()}
            title="Enregistrer l'apparence courante"
            className="flex shrink-0 items-center gap-1.5 rounded-app bg-accent px-2.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <Save size={14} />
          </button>
        </div>
        {presetNames.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {presetNames.map((name) => (
              <div
                key={name}
                className="flex items-center gap-1 rounded-app border border-border bg-bg pl-1"
              >
                <button
                  onClick={() => applyPreset(name)}
                  title="Appliquer ce preset"
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[12px] text-fg-secondary hover:text-fg"
                >
                  {name}
                </button>
                <button
                  onClick={() => deletePreset(name)}
                  title="Supprimer ce preset"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>
    </div>
  )
}

/* -------------------------------- Général -------------------------------- */

function GeneralSection(): JSX.Element {
  const viewMode = useNavStore((s) => s.viewMode)
  const toggleViewMode = useNavStore((s) => s.toggleViewMode)
  const gridSize = useNavStore((s) => s.gridSize)
  const setGridSize = useNavStore((s) => s.setGridSize)
  const showHidden = useNavStore((s) => s.showHidden)
  const toggleHidden = useNavStore((s) => s.toggleHidden)
  const hideGitIgnored = useNavStore((s) => s.hideGitIgnored)
  const toggleGitIgnored = useNavStore((s) => s.toggleGitIgnored)
  const linked = useTerminalStore((s) => s.linked)
  const toggleLinked = useTerminalStore((s) => s.toggleLinked)
  const [restore, setRestore] = useState<boolean | null>(null)
  const [mcp, setMcp] = useState<{ enabled: boolean; bridgePath: string } | null>(null)
  const [copiedCmd, setCopiedCmd] = useState(false)

  // Charge les réglages persistés (et synchronise le store des terminaux, qui
  // ne lit sa config qu'à l'ouverture du panneau terminal).
  useEffect(() => {
    void window.api.config.get('restoreSession').then((v) => setRestore(!!v))
    void window.api.config
      .get('linkTerminals')
      .then((v) => useTerminalStore.setState({ linked: !!v }))
      .catch(() => undefined)
    void window.api.mcp.status().then(setMcp)
  }, [])

  const toggleMcp = (enabled: boolean): void => {
    void window.api.mcp.toggle(enabled).then(setMcp)
  }

  const mcpRegisterCmd = mcp ? `claude mcp add gvue -- node "${mcp.bridgePath}"` : ''
  const copyMcpCmd = (): void => {
    void navigator.clipboard?.writeText(mcpRegisterCmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 1500)
  }

  const setRestoreSession = (v: boolean): void => {
    setRestore(v)
    void window.api.config.set('restoreSession', v)
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Au démarrage">
        <Segmented<'restore' | 'home'>
          value={restore === false ? 'home' : 'restore'}
          options={[
            { value: 'restore', label: 'Rouvrir les dossiers' },
            { value: 'home', label: 'Accès rapide' }
          ]}
          onChange={(v) => setRestoreSession(v === 'restore')}
        />
        <p className="mt-1.5 text-[11px] text-fg-muted">
          Restaure colonnes, onglets et dossiers de la dernière session.
        </p>
      </Field>

      <Field label="Affichage des fichiers">
        <Segmented<'list' | 'grid'>
          value={viewMode}
          options={[
            { value: 'list', label: 'Liste' },
            { value: 'grid', label: 'Grille (vignettes)' }
          ]}
          onChange={(v) => {
            if (v !== viewMode) toggleViewMode()
          }}
        />
        {viewMode === 'grid' && (
          <div className="mt-2">
            <p className="mb-1 text-[11px] text-fg-muted">Taille des vignettes — {gridSize}px</p>
            <input
              type="range"
              min={72}
              max={220}
              step={4}
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <p className="mt-0.5 text-[11px] text-fg-muted">Astuce : Ctrl + molette sur la grille.</p>
          </div>
        )}
      </Field>

      <Field label="Éléments masqués et ignorés">
        <div className="flex flex-col gap-2">
          <Segmented<'on' | 'off'>
            value={showHidden ? 'on' : 'off'}
            options={[
              { value: 'off', label: 'Masquer les cachés' },
              { value: 'on', label: 'Afficher les cachés' }
            ]}
            onChange={(v) => {
              if ((v === 'on') !== showHidden) toggleHidden()
            }}
          />
          <Segmented<'on' | 'off'>
            value={hideGitIgnored ? 'off' : 'on'}
            options={[
              { value: 'off', label: 'Masquer les ignorés (.gitignore)' },
              { value: 'on', label: 'Afficher les ignorés' }
            ]}
            onChange={(v) => {
              if ((v === 'off') !== hideGitIgnored) toggleGitIgnored()
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-fg-muted">
          Aussi via les icônes 👁 / filtre de la barre d'outils. Mémorisé (et par espace de travail).
        </p>
      </Field>

      <Field label="Terminaux liés aux onglets de dossier">
        <Segmented<'on' | 'off'>
          value={linked ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'Activé' },
            { value: 'off', label: 'Désactivé' }
          ]}
          onChange={(v) => {
            if ((v === 'on') !== linked) toggleLinked()
          }}
        />
        <p className="mt-1.5 text-[11px] text-fg-muted">
          Le panneau terminal n'affiche que les terminaux de l'onglet de dossier actif.
        </p>
      </Field>

      <Field label="Commandes personnalisées">
        <button
          onClick={() => useUiStore.getState().setCustomCmd(true)}
          className="flex items-center gap-1.5 rounded-app border border-border bg-bg px-2.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
        >
          <TerminalSquare size={14} /> Gérer les commandes du menu contextuel…
        </button>
      </Field>

      <Field label="Serveur MCP (agents IA)">
        <Segmented<'on' | 'off'>
          value={mcp?.enabled ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'Activé' },
            { value: 'off', label: 'Désactivé' }
          ]}
          onChange={(v) => toggleMcp(v === 'on')}
        />
        <p className="mt-1.5 text-[11px] text-fg-muted">
          Expose le contexte de GVue (onglets, sélection, dépôt Git, logs des terminaux)
          aux agents IA comme Claude Code — local uniquement (127.0.0.1 + jeton).
        </p>
        {mcp?.enabled && (
          <div className="mt-2">
            <p className="mb-1 text-[11px] text-fg-muted">
              Enregistrement côté Claude Code (une seule fois) :
            </p>
            <button
              onClick={copyMcpCmd}
              title="Copier la commande"
              className="w-full truncate rounded-app border border-border bg-bg px-2 py-1.5 text-left font-mono text-[11px] text-fg-secondary hover:border-accent hover:bg-bg-hover"
            >
              {copiedCmd ? '✓ Copié !' : mcpRegisterCmd}
            </button>
          </div>
        )}
      </Field>
    </div>
  )
}

/* -------------------------------- À propos ------------------------------- */

function AboutSection(): JSX.Element {
  const version = useUpdateStore((s) => s.version)
  const updateStatus = useUpdateStore((s) => s.status)
  const checkUpdate = useUpdateStore((s) => s.check)

  return (
    <div className="flex flex-col gap-5">
      <Field label="Version">
        <div className="flex items-center justify-between gap-2 rounded-app border border-border bg-bg px-2.5 py-2">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-fg">GVue v{version || '—'}</div>
            <div className="truncate text-[11px] text-fg-muted">{updateLabel(updateStatus)}</div>
          </div>
          <button
            onClick={checkUpdate}
            title="Vérifier les mises à jour"
            className="flex shrink-0 items-center gap-1.5 rounded-app border border-border px-2 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
          >
            <DownloadCloud size={14} /> Vérifier
          </button>
        </div>
      </Field>

      <Field label="Diagnostic">
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => useUiStore.getState().setWhatsNew('')}
            className="flex items-center gap-1.5 rounded-app border border-border bg-bg px-2.5 py-1.5 text-left text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
          >
            <Sparkles size={14} /> Nouveautés de cette version…
          </button>
          <button
            onClick={() => void window.api.log.path().then((p) => window.api.fs.reveal(p))}
            className="flex items-center gap-1.5 rounded-app border border-border bg-bg px-2.5 py-1.5 text-left text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
          >
            <FileText size={14} /> Ouvrir le journal de diagnostic
          </button>
        </div>
      </Field>
    </div>
  )
}

/* -------------------------------- Helpers -------------------------------- */

function Field(props: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col">
      <p className="mb-2 text-[12px] text-fg-muted">{props.label}</p>
      {props.children}
    </div>
  )
}

function Segmented<T extends string>(props: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {props.options.map((o) => {
        const active = o.value === props.value
        return (
          <button
            key={o.value}
            aria-pressed={active}
            onClick={() => props.onChange(o.value)}
            className={`rounded-app border px-3 py-1.5 text-[12px] transition-colors ${
              active
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-bg text-fg-secondary hover:bg-bg-hover'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
