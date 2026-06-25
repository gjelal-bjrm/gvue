import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import Logo from './Logo'

/**
 * Barre de titre custom pour la fenêtre frameless.
 * Zone centrale draggable ; boutons en no-drag.
 */
export default function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.api.window.status().then((s) => setMaximized(s.maximized))
    return window.api.window.onStatus((s) => setMaximized(s.maximized))
  }, [])

  return (
    <header className="drag-region flex h-9 shrink-0 items-center justify-between border-b border-border bg-bg-secondary pl-3 select-none">
      <div className="flex items-center gap-2">
        <Logo size={18} />
        <span
          className="inline-flex items-baseline text-[14px] leading-none tracking-wide text-fg"
          style={{ fontFamily: "'Space Grotesk', var(--font-ui)", fontWeight: 600 }}
        >
          G
          <span className="text-accent" style={{ fontSize: '1.4em', fontWeight: 700, lineHeight: 0.7 }}>
            V
          </span>
          ue
        </span>
      </div>

      <div className="no-drag flex h-full">
        <CtrlBtn label="Réduire" onClick={() => window.api.window.action('minimize')}>
          <Minus size={15} />
        </CtrlBtn>
        <CtrlBtn
          label={maximized ? 'Restaurer' : 'Agrandir'}
          onClick={() => window.api.window.action('maximize-toggle')}
        >
          {maximized ? <Copy size={13} /> : <Square size={12} />}
        </CtrlBtn>
        <button
          className="grid w-11 place-items-center text-fg-secondary transition-colors hover:bg-[#e5573f] hover:text-white"
          onClick={() => window.api.window.action('close')}
          title="Fermer"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  )
}

function CtrlBtn(props: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      className="grid w-11 place-items-center text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg"
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
    >
      {props.children}
    </button>
  )
}
