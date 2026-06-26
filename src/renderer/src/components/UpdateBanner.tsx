import { useEffect } from 'react'
import { Download, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useUpdateStore } from '../state/useUpdateStore'

/**
 * Bandeau de mise à jour : affiché quand une mise à jour est disponible, en
 * cours de téléchargement, prête à installer, ou en erreur. Les messages
 * transitoires (« à jour », « indisponible », « vérification ») ne s'affichent
 * qu'après une vérification manuelle et disparaissent seuls.
 */
export default function UpdateBanner(): JSX.Element | null {
  const status = useUpdateStore((s) => s.status)
  const manualHint = useUpdateStore((s) => s.manualHint)
  const dismissed = useUpdateStore((s) => s.dismissed)
  const install = useUpdateStore((s) => s.install)
  const dismiss = useUpdateStore((s) => s.dismiss)

  const transient =
    status.state === 'none' || status.state === 'unsupported' || status.state === 'checking'

  // Masque automatiquement les messages transitoires après quelques secondes.
  useEffect(() => {
    if (manualHint && (status.state === 'none' || status.state === 'unsupported')) {
      const t = setTimeout(dismiss, 4000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [manualHint, status.state, dismiss])

  if (dismissed) return null
  // Rien à montrer pour les états transitoires hors vérification manuelle.
  if (transient && !manualHint) return null
  if (status.state === 'idle') return null

  let icon: JSX.Element
  let text: string
  let tone = 'text-fg-secondary'
  let action: JSX.Element | null = null

  switch (status.state) {
    case 'checking':
      icon = <RefreshCw size={14} className="animate-spin" />
      text = 'Recherche de mises à jour…'
      break
    case 'available':
      icon = <Download size={14} />
      text = `Mise à jour v${status.version} disponible — téléchargement…`
      tone = 'text-accent'
      break
    case 'downloading':
      icon = <Download size={14} />
      text = `Téléchargement de la mise à jour… ${status.percent}%`
      tone = 'text-accent'
      break
    case 'ready':
      icon = <CheckCircle2 size={14} />
      text = `Mise à jour v${status.version} prête.`
      tone = 'text-accent'
      action = (
        <button
          onClick={install}
          className="rounded-app bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90"
        >
          Redémarrer et installer
        </button>
      )
      break
    case 'none':
      icon = <CheckCircle2 size={14} />
      text = `GVue est à jour (v${status.version}).`
      break
    case 'unsupported':
      icon = <AlertTriangle size={14} />
      text = 'Mises à jour indisponibles ici (mode dev ou module non installé).'
      tone = 'text-fg-muted'
      break
    case 'error':
      icon = <AlertTriangle size={14} />
      text = `Échec de la mise à jour : ${status.message}`
      tone = 'text-danger-fg'
      break
    default:
      return null
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-bg-secondary px-3 text-[12px]">
      <span className={`flex shrink-0 items-center ${tone}`}>{icon}</span>
      <span className={`min-w-0 flex-1 truncate ${tone}`}>{text}</span>
      {action}
      <button
        onClick={dismiss}
        title="Masquer"
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
      >
        <X size={13} />
      </button>
    </div>
  )
}
