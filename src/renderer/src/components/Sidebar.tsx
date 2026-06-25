import { useEffect, useState } from 'react'
import { Home, Download, HardDrive, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavStore } from '../state/useNavStore'
import { childPath } from '../lib/format'

/**
 * Sidebar : accès rapide, lecteurs, favoris et projets.
 * Les favoris viennent d'electron-store ; la détection auto des projets Git
 * (icônes branche) arrive en phase 6 — section affichée en aperçu d'ici là.
 */
export default function Sidebar(): JSX.Element {
  const { locations, path, navigate } = useNavStore()
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    window.api.config.get('favorites').then(setFavorites).catch(() => setFavorites([]))
  }, [])

  const home = locations?.home ?? ''
  const isActive = (p: string): boolean => path === p

  return (
    <nav className="flex h-full w-full flex-col gap-5 overflow-y-auto bg-bg-secondary p-2.5 text-[13px]">
      <Section title="Accès rapide">
        {home && (
          <>
            <Item
              icon={Home}
              label="Accueil"
              active={isActive(home)}
              onClick={() => navigate(home)}
            />
            <Item
              icon={Download}
              label="Téléchargements"
              active={isActive(childPath(home, 'Downloads'))}
              onClick={() => navigate(childPath(home, 'Downloads'))}
            />
          </>
        )}
      </Section>

      <Section title="Lecteurs">
        {locations?.drives.map((d) => (
          <Item
            key={d.path}
            icon={HardDrive}
            label={d.label}
            active={isActive(d.path)}
            onClick={() => navigate(d.path)}
          />
        ))}
      </Section>

      <Section title="Favoris">
        {favorites.length === 0 ? (
          <p className="px-2 text-[12px] text-fg-muted">Aucun favori</p>
        ) : (
          favorites.map((f) => (
            <Item
              key={f}
              icon={Star}
              label={f.split(/[\\/]/).filter(Boolean).pop() ?? f}
              active={isActive(f)}
              onClick={() => navigate(f)}
            />
          ))
        )}
      </Section>

      <Section title="Projets">
        <p className="px-2 text-[12px] text-fg-muted">
          Détection auto des dépôts Git — phase 6
        </p>
      </Section>
    </nav>
  )
}

function Section(props: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
        {props.title}
      </div>
      {props.children}
    </div>
  )
}

function Item(props: {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
}): JSX.Element {
  const { icon: Icon } = props
  return (
    <button
      onClick={props.onClick}
      title={props.label}
      className={`flex items-center gap-2.5 rounded-app px-2 py-[var(--row-pad)] text-left transition-colors ${
        props.active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{props.label}</span>
    </button>
  )
}
