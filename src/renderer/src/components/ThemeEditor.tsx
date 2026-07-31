import { useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { CustomTheme } from '@shared/types'
import {
  buildCustomVars,
  baseFromBg,
  type CustomColors
} from '../theme/themes'
import { useAppearanceStore } from '../state/useAppearanceStore'
import { applyThemeAll } from '../lib/terminalBridge'
import { applyAppearance } from '../theme/applyTheme'
import { t } from '../i18n'

/**
 * Ordre et libellés des 10 couleurs éditables. Français brut : ce tableau est
 * évalué à l'import, AVANT initLang() — la traduction se fait au rendu.
 */
const FIELDS: { key: keyof CustomColors; label: string }[] = [
  { key: 'bg', label: 'Fond' },
  { key: 'bgSecondary', label: 'Panneaux' },
  { key: 'bgTertiary', label: 'Champs' },
  { key: 'fg', label: 'Texte' },
  { key: 'fgSecondary', label: 'Texte secondaire' },
  { key: 'fgMuted', label: 'Texte estompé' },
  { key: 'success', label: 'Succès' },
  { key: 'danger', label: 'Erreur' },
  { key: 'warning', label: 'Avertissement' },
  { key: 'info', label: 'Info' }
]

/** Valeur effective d'une variable CSS (thème actif), en secours une valeur sûre. */
function currentVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  // Les sélecteurs <input type="color"> n'acceptent que le #rrggbb.
  return /^#[a-f\d]{6}$/i.test(v) ? v : fallback
}

/** Couleurs initiales : celles du thème actuellement affiché. */
function fromCurrentTheme(): CustomColors {
  return {
    bg: currentVar('--bg', '#17171c'),
    bgSecondary: currentVar('--bg-secondary', '#1d1d23'),
    bgTertiary: currentVar('--bg-tertiary', '#25252d'),
    fg: currentVar('--fg', '#e7e7ef'),
    fgSecondary: currentVar('--fg-secondary', '#b0b0bd'),
    fgMuted: currentVar('--fg-muted', '#7e7e8c'),
    success: currentVar('--success-fg', '#2ea66f'),
    danger: currentVar('--danger-fg', '#e5573f'),
    warning: currentVar('--warning-fg', '#e0a93a'),
    info: currentVar('--info-fg', '#5b9df9')
  }
}

/** Ré-extrait les 10 couleurs éditables d'un thème enregistré. */
function fromTheme(t: CustomTheme): CustomColors {
  const v = t.vars
  const base = fromCurrentTheme()
  return {
    bg: v.bg ?? base.bg,
    bgSecondary: v['bg-secondary'] ?? base.bgSecondary,
    bgTertiary: v['bg-tertiary'] ?? base.bgTertiary,
    fg: v.fg ?? base.fg,
    fgSecondary: v['fg-secondary'] ?? base.fgSecondary,
    fgMuted: v['fg-muted'] ?? base.fgMuted,
    success: v['success-fg'] ?? base.success,
    danger: v['danger-fg'] ?? base.danger,
    warning: v['warning-fg'] ?? base.warning,
    info: v['info-fg'] ?? base.info
  }
}

/**
 * Éditeur de thème personnalisé : 10 couleurs (le reste — bordures, survols,
 * fonds de statut — est dérivé), aperçu appliqué EN DIRECT sur toute l'app,
 * restauration à l'annulation. `editing` = thème existant à modifier.
 */
export default function ThemeEditor(props: {
  editing: CustomTheme | null
  onClose: () => void
}): JSX.Element {
  const [name, setName] = useState(props.editing?.label ?? t('Mon thème'))
  const [colors, setColors] = useState<CustomColors>(() =>
    props.editing ? fromTheme(props.editing) : fromCurrentTheme()
  )

  const vars = useMemo(() => buildCustomVars(colors), [colors])

  // Aperçu en direct : pose les variables dérivées à chaque changement.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', baseFromBg(colors.bg))
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(`--${k}`, v)
    applyThemeAll()
  }, [vars, colors.bg])

  // À la fermeture sans enregistrer : réapplique l'apparence persistée.
  const cancel = (): void => {
    applyAppearance(useAppearanceStore.getState().appearance)
    applyThemeAll()
    props.onClose()
  }

  const save = (): void => {
    const label = name.trim() || t('Mon thème')
    const theme: CustomTheme = {
      id: props.editing?.id ?? `custom-${Date.now()}`,
      label,
      base: baseFromBg(colors.bg),
      vars
    }
    useAppearanceStore.getState().saveCustomTheme(theme)
    applyThemeAll()
    props.onClose()
  }

  const set = (key: keyof CustomColors, value: string): void =>
    setColors((c) => ({ ...c, [key]: value }))

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-app border border-accent bg-bg p-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('Nom du thème…')}
        spellCheck={false}
        className="w-full rounded-app border border-border bg-bg-tertiary px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
      />

      <div className="flex flex-col gap-1">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-[12px] text-fg-secondary">
            <input
              type="color"
              value={colors[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              className="h-6 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
            />
            <span className="min-w-0 flex-1 truncate">{t(f.label)}</span>
            <span className="shrink-0 font-mono text-[11px] text-fg-muted">{colors[f.key]}</span>
          </label>
        ))}
      </div>

      <p className="text-[11px] text-fg-muted">
        {t("Bordures, survols et fonds de statut sont dérivés automatiquement. L'aperçu est appliqué en direct — « Annuler » restaure le thème précédent.")}
      </p>

      <div className="flex gap-1.5">
        <button
          onClick={save}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
        >
          <Check size={13} /> {t('Enregistrer')}
        </button>
        <button
          onClick={cancel}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-app border border-border px-2 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
        >
          <X size={13} /> {t('Annuler')}
        </button>
      </div>
    </div>
  )
}
