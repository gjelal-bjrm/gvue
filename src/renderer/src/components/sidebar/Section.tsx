import { useState } from 'react'
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react'

/**
 * Section repliable et réordonnable de la sidebar. Le glisser-déposer passe par
 * la clé MIME « application/x-gvue-section » (partagée avec l'émetteur).
 */
export default function Section(props: {
  sectionKey: string
  title: string
  collapsed: boolean
  onToggle: () => void
  onReorder: (from: string) => void
  children: React.ReactNode
}): JSX.Element {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const from = e.dataTransfer.getData('application/x-gvue-section')
        if (from) props.onReorder(from)
      }}
      className={`flex flex-col gap-0.5 rounded-app ${over ? 'outline outline-1 outline-accent' : ''}`}
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-gvue-section', props.sectionKey)
          e.dataTransfer.effectAllowed = 'move'
        }}
        className="group flex items-center gap-1 pb-1.5 pl-1 pr-2"
      >
        <button
          onClick={props.onToggle}
          className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted hover:text-fg-secondary"
        >
          {props.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span className="truncate">{props.title}</span>
        </button>
        <GripVertical
          size={13}
          className="shrink-0 cursor-grab text-fg-muted opacity-0 group-hover:opacity-100"
        />
      </div>
      {!props.collapsed && props.children}
    </div>
  )
}
