import { useEffect } from 'react'
import { useUiStore } from '../state/useUiStore'

/** Message éphémère en bas de l'écran (feedback d'annulation, etc.). */
export default function Toast(): JSX.Element | null {
  const toast = useUiStore((s) => s.toast)
  const seq = useUiStore((s) => s.toastSeq)
  const clear = useUiStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => clear(), 3200)
    return () => clearTimeout(t)
  }, [seq, toast, clear])

  if (!toast) return null
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2">
      <div className="pointer-events-auto max-w-[80vw] truncate rounded-app border border-border bg-bg-secondary px-4 py-2 text-[13px] text-fg shadow-2xl">
        {toast}
      </div>
    </div>
  )
}
