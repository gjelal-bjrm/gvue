import { useState } from 'react'
import { Palette, Check, X, Save, Trash2, DownloadCloud } from 'lucide-react'
import { useAppearanceStore } from '../state/useAppearanceStore'
import { useUiStore } from '../state/useUiStore'
import { useUpdateStore } from '../state/useUpdateStore'
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

/**
 * Panneau d'apparence — entièrement fonctionnel (cf. section 7 de la spec).
 * Chaque réglage met à jour les variables CSS via le store et persiste dans
 * electron-store. Aucun composant n'est repeint « à la main ».
 */
export default function AppearancePanel(): JSX.Element {
  const { appearance, update, savePreset, applyPreset, deletePreset } = useAppearanceStore()
  const closePanel = useUiStore((s) => s.toggleAppearance)
  const version = useUpdateStore((s) => s.version)
  const updateStatus = useUpdateStore((s) => s.status)
  const checkUpdate = useUpdateStore((s) => s.check)
  const [presetName, setPresetName] = useState('')
  const presetNames = Object.keys(appearance.presets)

  const onSavePreset = (): void => {
    const name = presetName.trim()
    if (!name) return
    savePreset(name)
    setPresetName('')
  }

  return (
    <aside className="flex h-full w-full flex-col gap-5 overflow-y-auto border-l border-border bg-bg-secondary p-3.5 text-[13px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Palette size={16} className="text-accent" />
          Apparence
        </div>
        <button
          onClick={closePanel}
          title="Fermer le panneau"
          className="grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
        >
          <X size={15} />
        </button>
      </div>

      {/* Couleur d'accent */}
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

      {/* Thème */}
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

      {/* Densité */}
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

      {/* Coins */}
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

      {/* Police */}
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

      {/* Taille de police */}
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

      {/* Opacité de la fenêtre (réelle, niveau OS) */}
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

      {/* Curseur clignotant du titre */}
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

      {/* Presets nommés */}
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

      {/* À propos / version */}
      <Field label="À propos">
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
    </aside>
  )
}

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
