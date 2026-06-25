import { useId } from 'react'
import { useAppearanceStore } from '../state/useAppearanceStore'

/**
 * Logo GVue en SVG, adaptatif : la couleur d'accent du thème pilote un dégradé
 * clair→foncé. Réinterprétation vectorielle du logo (dossier-G + invite « > » +
 * balise « </> »). Sert au branding dans l'app ; l'icône .ico de la barre des
 * tâches reste le rendu PNG haute définition.
 */

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

/** Éclaircit (pct>0) ou assombrit (pct<0) une couleur hex. */
function shade(hex: string, pct: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16))
  const target = pct < 0 ? 0 : 255
  const p = Math.abs(pct)
  const f = (c: number): number => clamp((target - c) * p + c)
  const toHex = (c: number): string => f(c).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export default function Logo(props: {
  size?: number
  accent?: string
  className?: string
}): JSX.Element {
  const fromStore = useAppearanceStore((s) => s.appearance.accent)
  const base = props.accent ?? fromStore ?? '#7F77DD'
  const light = shade(base, 0.3)
  const dark = shade(base, -0.32)
  const spark = shade(base, 0.78)
  const code = shade(base, 0.6)

  const raw = useId().replace(/[:]/g, '')
  const gid = `gvg-${raw}`
  const glowId = `gvgl-${raw}`
  const size = props.size ?? 22

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={props.className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="64" y1="52" x2="196" y2="208">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>

      {/* Coquille arrondie sombre + liseré d'accent */}
      <rect
        x="22"
        y="22"
        width="212"
        height="212"
        rx="56"
        fill="#17171d"
        stroke={base}
        strokeOpacity="0.45"
        strokeWidth="3"
      />

      {/* Languette de dossier (fusionne avec le G) */}
      <rect x="70" y="60" width="72" height="28" rx="12" fill={`url(#${gid})`} />

      {/* « G » : grand arc ouvert à droite + barre transversale */}
      <path
        d="M172.4 165.3 A58 58 0 1 1 172.4 90.7"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="26"
        strokeLinecap="round"
      />
      <path
        d="M168 128 L132 128"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="26"
        strokeLinecap="round"
      />

      {/* Invite « > » (avec halo) */}
      <g filter={`url(#${glowId})`}>
        <path
          d="M96 100 L116 116 L96 132"
          fill="none"
          stroke={spark}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M96 100 L116 116 L96 132"
        fill="none"
        stroke={spark}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Balise « </> » */}
      <g
        fill="none"
        stroke={code}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      >
        <path d="M122 148 L114 156 L122 164" />
        <path d="M141 145 L131 167" />
        <path d="M150 148 L158 156 L150 164" />
      </g>
    </svg>
  )
}
