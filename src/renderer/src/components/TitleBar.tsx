import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X, LayoutGrid } from 'lucide-react'
import Logo from './Logo'
import { t } from '../i18n'
import { useAppearanceStore } from '../state/useAppearanceStore'
import { useWorkspaceStore } from '../state/useWorkspaceStore'

/**
 * Barre de titre custom pour la fenêtre frameless.
 * Zone centrale draggable ; boutons en no-drag.
 * Affiche l'espace de travail chargé : deux espaces peuvent avoir des couleurs
 * voisines, et sans son nom on ne sait plus dans lequel on est.
 */
export default function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const titleCursor = useAppearanceStore((s) => s.appearance.titleCursor)
  const workspace = useWorkspaceStore((s) => s.current)

  useEffect(() => {
    window.api.window.status().then((s) => setMaximized(s.maximized))
    return window.api.window.onStatus((s) => setMaximized(s.maximized))
  }, [])

  // Le titre système (barre des tâches, Alt+Tab) porte aussi l'espace.
  useEffect(() => {
    document.title = workspace ? `GVue — ${workspace}` : 'GVue'
  }, [workspace])

  return (
    <header className="drag-region flex h-9 shrink-0 items-center justify-between border-b border-border bg-bg-secondary pl-3 select-none">
      <div className="flex min-w-0 items-center gap-2">
        <Logo size={18} />
        <span
          className="inline-flex shrink-0 items-center text-[14px] leading-none"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span className="text-accent">~/</span>
          <span className="font-bold text-fg">gvue</span>
          {titleCursor && <span className="title-cursor" />}
        </span>
        {workspace && (
          <span
            className="ml-1 inline-flex min-w-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent"
            title={t('Espace de travail chargé : {name}', { name: workspace })}
          >
            <LayoutGrid size={11} className="shrink-0" />
            <span className="truncate">{workspace}</span>
          </span>
        )}
      </div>

      <div className="no-drag flex h-full">
        <CtrlBtn label={t('Réduire')} onClick={() => window.api.window.action('minimize')}>
          <Minus size={15} />
        </CtrlBtn>
        <CtrlBtn
          label={maximized ? t('Restaurer') : t('Agrandir')}
          onClick={() => window.api.window.action('maximize-toggle')}
        >
          {maximized ? <Copy size={13} /> : <Square size={12} />}
        </CtrlBtn>
        <button
          className="grid w-11 place-items-center text-fg-secondary transition-colors hover:bg-[#e5573f] hover:text-white"
          onClick={() => window.api.window.action('close')}
          title={t('Fermer')}
          aria-label={t('Fermer')}
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
