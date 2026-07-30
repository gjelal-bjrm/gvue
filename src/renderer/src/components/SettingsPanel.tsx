import { useEffect, useRef, useState } from 'react'
import {
  Settings,
  Check,
  X,
  Save,
  Trash2,
  DownloadCloud,
  Sparkles,
  FileText,
  TerminalSquare,
  Download,
  Upload,
  Plus,
  Pencil
} from 'lucide-react'
import { useAppearanceStore, visualOnly } from '../state/useAppearanceStore'
import { useUiStore } from '../state/useUiStore'
import { useUpdateStore } from '../state/useUpdateStore'
import { useNavStore } from '../state/useNavStore'
import { useTerminalStore } from '../state/useTerminalStore'
import { useShelfStore } from '../state/useShelfStore'
import { ACCENT_SWATCHES, FONT_CHOICES } from '../theme/presets'
import { THEMES, themeById, THEME_VAR_KEYS } from '../theme/themes'
import ThemeEditor from './ThemeEditor'
import type { Appearance, CustomTheme, UpdateStatus } from '@shared/types'

/** Cartes des thèmes de base (le mode historique clair/sombre/auto). */
const BASE_THEME_CARDS: {
  mode: Appearance['theme']
  label: string
  colors: { bg: string; panel: string; fg: string }
}[] = [
  { mode: 'auto', label: 'Auto', colors: { bg: '#17171c', panel: '#ffffff', fg: '#e7e7ef' } },
  { mode: 'light', label: 'Clair', colors: { bg: '#ffffff', panel: '#f5f5f7', fg: '#1c1c22' } },
  { mode: 'dark', label: 'Sombre', colors: { bg: '#17171c', panel: '#1d1d23', fg: '#e7e7ef' } }
]

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
  const importRef = useRef<HTMLInputElement>(null)
  // Éditeur de thème personnalisé : null = fermé ; editing = thème à modifier.
  const [editor, setEditor] = useState<{ editing: CustomTheme | null } | null>(null)
  const presetNames = Object.keys(appearance.presets)

  const onSavePreset = (): void => {
    const name = presetName.trim()
    if (!name) return
    savePreset(name)
    setPresetName('')
  }

  // Export : un thème = un petit JSON des réglages visuels, téléchargé.
  // Si le thème actif est personnalisé, sa palette complète est embarquée.
  const exportTheme = (): void => {
    const data: Record<string, unknown> = { gvueTheme: 1, ...visualOnly(appearance) }
    const active = appearance.customThemes.find((t) => t.id === appearance.themeId)
    if (active) data.customTheme = active
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gvue-theme.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import : n'adopte que les clés visuelles connues, au bon type.
  const importTheme = async (file: File): Promise<void> => {
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>
      const patch: Partial<Appearance> = {}
      if (typeof raw.accent === 'string') patch.accent = raw.accent
      if (raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'auto')
        patch.theme = raw.theme
      if (typeof raw.themeId === 'string' && (raw.themeId === '' || themeById(raw.themeId)))
        patch.themeId = raw.themeId
      if (raw.density === 'comfortable' || raw.density === 'compact') patch.density = raw.density
      if (raw.corners === 'rounded' || raw.corners === 'square') patch.corners = raw.corners
      if (typeof raw.radiusPx === 'number')
        patch.radiusPx = Math.min(16, Math.max(0, Math.round(raw.radiusPx)))
      if (raw.borderStyle === 'solid' || raw.borderStyle === 'dashed' || raw.borderStyle === 'dotted')
        patch.borderStyle = raw.borderStyle
      if (typeof raw.fontFamily === 'string') patch.fontFamily = raw.fontFamily
      if (typeof raw.fontSize === 'number') patch.fontSize = Math.min(17, Math.max(11, raw.fontSize))
      if (typeof raw.windowOpacity === 'number')
        patch.windowOpacity = Math.min(1, Math.max(0.3, raw.windowOpacity))
      // Thème personnalisé embarqué : validé clé à clé puis ajouté et activé.
      const ct = raw.customTheme as Record<string, unknown> | undefined
      if (
        ct &&
        typeof ct.label === 'string' &&
        (ct.base === 'dark' || ct.base === 'light') &&
        ct.vars &&
        typeof ct.vars === 'object'
      ) {
        const vars: Record<string, string> = {}
        for (const [k, v] of Object.entries(ct.vars as Record<string, unknown>)) {
          if (typeof v === 'string' && THEME_VAR_KEYS.includes(k)) vars[k] = v
        }
        const id =
          typeof ct.id === 'string' && ct.id.startsWith('custom-')
            ? ct.id
            : `custom-${Date.now()}`
        patch.customThemes = [
          ...appearance.customThemes.filter((x) => x.id !== id),
          { id, label: ct.label, base: ct.base, vars }
        ]
        patch.themeId = id
      }
      if (Object.keys(patch).length === 0) throw new Error('aucun réglage reconnu')
      update(patch)
      useUiStore.getState().showToast('Thème importé.')
    } catch (e) {
      useUiStore
        .getState()
        .showToast(`Import impossible : ${e instanceof Error ? e.message : 'fichier invalide'}`)
    }
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
        <div className="grid grid-cols-3 gap-1.5">
          {BASE_THEME_CARDS.map((c) => (
            <ThemeCard
              key={c.mode}
              label={c.label}
              colors={{ ...c.colors, accent: appearance.accent }}
              split={c.mode === 'auto'}
              active={appearance.themeId === '' && appearance.theme === c.mode}
              onClick={() => update({ themeId: '', theme: c.mode })}
            />
          ))}
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              label={t.label}
              colors={{
                bg: t.vars.bg,
                panel: t.vars['bg-secondary'],
                fg: t.vars.fg,
                accent: t.accent ?? appearance.accent
              }}
              active={appearance.themeId === t.id}
              onClick={() => update({ themeId: t.id, ...(t.accent ? { accent: t.accent } : {}) })}
            />
          ))}
          {appearance.customThemes.map((t) => (
            <div key={t.id} className="group relative">
              <ThemeCard
                label={t.label}
                colors={{
                  bg: t.vars.bg ?? '#17171c',
                  panel: t.vars['bg-secondary'] ?? '#1d1d23',
                  fg: t.vars.fg ?? '#e7e7ef',
                  accent: appearance.accent
                }}
                active={appearance.themeId === t.id}
                onClick={() => update({ themeId: t.id })}
              />
              <div className="absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setEditor({ editing: t })}
                  title="Modifier ce thème"
                  className="grid h-[18px] w-5 place-items-center rounded bg-bg/80 text-fg-secondary hover:text-fg"
                >
                  <Pencil size={10} />
                </button>
                <button
                  onClick={() => useAppearanceStore.getState().deleteCustomTheme(t.id)}
                  title="Supprimer ce thème"
                  className="grid h-[18px] w-5 place-items-center rounded bg-bg/80 text-fg-secondary hover:text-danger-fg"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setEditor({ editing: null })}
            title="Créer un thème personnalisé à partir du thème affiché"
            className="flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-app border border-dashed border-border text-fg-muted transition-colors hover:border-accent hover:text-accent"
          >
            <Plus size={15} />
            <span className="text-[10px]">Créer</span>
          </button>
        </div>
        {appearance.themeId !== '' && !editor && (
          <p className="mt-1.5 text-[11px] text-fg-muted">
            {themeById(appearance.themeId)?.tagline ??
              appearance.customThemes.find((t) => t.id === appearance.themeId)?.label}
          </p>
        )}
        {editor && (
          <ThemeEditor key={editor.editing?.id ?? 'new'} editing={editor.editing} onClose={() => setEditor(null)} />
        )}
      </Field>

      <Field label="Bascule automatique jour/nuit">
        <Segmented<'on' | 'off'>
          value={appearance.themeSchedule.enabled ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'Activée' },
            { value: 'off', label: 'Désactivée' }
          ]}
          onChange={(v) =>
            update({ themeSchedule: { ...appearance.themeSchedule, enabled: v === 'on' } })
          }
        />
        {appearance.themeSchedule.enabled && (
          <div className="mt-2 flex flex-col gap-1.5">
            <ScheduleRow
              label="Jour dès"
              time={appearance.themeSchedule.dayFrom}
              theme={appearance.themeSchedule.day}
              customs={appearance.customThemes}
              onTime={(v) => update({ themeSchedule: { ...appearance.themeSchedule, dayFrom: v } })}
              onTheme={(v) => update({ themeSchedule: { ...appearance.themeSchedule, day: v } })}
            />
            <ScheduleRow
              label="Nuit dès"
              time={appearance.themeSchedule.nightFrom}
              theme={appearance.themeSchedule.night}
              customs={appearance.customThemes}
              onTime={(v) =>
                update({ themeSchedule: { ...appearance.themeSchedule, nightFrom: v } })
              }
              onTheme={(v) => update({ themeSchedule: { ...appearance.themeSchedule, night: v } })}
            />
          </div>
        )}
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

      <Field label={`Coins arrondis — ${appearance.radiusPx} px`}>
        <input
          type="range"
          min={0}
          max={16}
          step={1}
          value={appearance.radiusPx}
          onChange={(e) => {
            const radiusPx = Number(e.target.value)
            // `corners` est maintenu pour la compat des anciens presets.
            update({ radiusPx, corners: radiusPx >= 5 ? 'rounded' : 'square' })
          }}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      <Field label="Style des bordures">
        <Segmented<Appearance['borderStyle']>
          value={appearance.borderStyle}
          options={[
            { value: 'solid', label: 'Pleines' },
            { value: 'dashed', label: 'Tirets' },
            { value: 'dotted', label: 'Points' }
          ]}
          onChange={(v) => update({ borderStyle: v })}
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

      <Field label="Partager le thème">
        <div className="flex gap-1.5">
          <button
            onClick={exportTheme}
            title="Télécharge un fichier gvue-theme.json avec l'apparence courante"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
          >
            <Download size={13} /> Exporter
          </button>
          <button
            onClick={() => importRef.current?.click()}
            title="Applique un thème depuis un fichier gvue-theme.json"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
          >
            <Upload size={13} /> Importer
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importTheme(f)
              e.target.value = ''
            }}
          />
        </div>
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

/**
 * Carte d'aperçu d'un thème : mini-fenêtre (fond, bandeau latéral, lignes de
 * texte, barre d'accent) — on voit le thème avant de cliquer.
 */
function ThemeCard(props: {
  label: string
  colors: { bg: string; panel: string; fg: string; accent: string }
  active: boolean
  /** Carte « Auto » : moitié claire / moitié sombre. */
  split?: boolean
  onClick: () => void
}): JSX.Element {
  const { bg, panel, fg, accent } = props.colors
  return (
    <button
      onClick={props.onClick}
      aria-pressed={props.active}
      title={props.label}
      className={`overflow-hidden rounded-app border text-left transition-transform hover:scale-[1.03] ${
        props.active ? 'border-accent ring-1 ring-accent' : 'border-border'
      }`}
    >
      <div className="relative h-11 w-full" style={{ background: bg }}>
        {props.split && (
          <div className="absolute inset-y-0 right-0 w-1/2" style={{ background: '#ffffff' }} />
        )}
        <div
          className="absolute left-1 top-1 bottom-1 w-[22%] rounded-[3px]"
          style={{ background: panel }}
        />
        <div className="absolute left-[30%] right-2 top-2 flex flex-col gap-[3px]">
          <div className="h-[5px] w-1/2 rounded-full" style={{ background: accent }} />
          <div className="h-[4px] w-4/5 rounded-full opacity-80" style={{ background: fg }} />
          <div className="h-[4px] w-2/3 rounded-full opacity-40" style={{ background: fg }} />
        </div>
      </div>
      <div
        className={`truncate px-1.5 py-1 text-center text-[10px] leading-tight ${
          props.active ? 'text-accent' : 'text-fg-secondary'
        }`}
      >
        {props.label}
      </div>
    </button>
  )
}

/** Ligne de planification : heure de début + thème appliqué. */
function ScheduleRow(props: {
  label: string
  time: string
  theme: string
  customs: CustomTheme[]
  onTime: (v: string) => void
  onTheme: (v: string) => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <span className="w-14 shrink-0 text-fg-secondary">{props.label}</span>
      <input
        type="time"
        value={props.time}
        onChange={(e) => e.target.value && props.onTime(e.target.value)}
        className="rounded-app border border-border bg-bg px-1.5 py-1 text-[12px] text-fg outline-none focus:border-accent"
      />
      <select
        value={props.theme}
        onChange={(e) => props.onTheme(e.target.value)}
        className="min-w-0 flex-1 rounded-app border border-border bg-bg px-1.5 py-1 text-[12px] text-fg outline-none focus:border-accent"
      >
        <option value="light">Clair</option>
        <option value="dark">Sombre</option>
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
        {props.customs.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
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
  const shelfEnabled = useShelfStore((s) => s.enabled)
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
              max={256}
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

      <Field label="Étagère (panier de fichiers)">
        <Segmented<'on' | 'off'>
          value={shelfEnabled ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'Activée' },
            { value: 'off', label: 'Désactivée' }
          ]}
          onChange={(v) => useShelfStore.getState().setEnabled(v === 'on')}
        />
        <p className="mt-1.5 text-[11px] text-fg-muted">
          Panier flottant : déposez-y des fichiers (glisser ou clic droit) depuis plusieurs
          dossiers, puis collez tout d'un coup à destination.
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
