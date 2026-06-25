import { useAppearanceStore } from '../state/useAppearanceStore'
import violet from '../assets/logo/logoViolet.png'
import sarcelle from '../assets/logo/logoSarcelle.png'
import corail from '../assets/logo/logoCorail.png'
import bleu from '../assets/logo/logoBleu.png'
import ambre from '../assets/logo/logoAmbre.png'
import rose from '../assets/logo/logoRose.png'

/**
 * Logo GVue : on a une variante par couleur d'accent prédéfinie. On affiche
 * celle dont la teinte est la plus proche de l'accent courant (gère aussi les
 * couleurs libres du sélecteur). Le violet est la variante par défaut.
 */
const VARIANTS: { hex: string; src: string }[] = [
  { hex: '#7F77DD', src: violet },
  { hex: '#1D9E75', src: sarcelle },
  { hex: '#D85A30', src: corail },
  { hex: '#378ADD', src: bleu },
  { hex: '#EF9F27', src: ambre },
  { hex: '#D4537E', src: rose }
]

function rgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [127, 119, 221]
}

/** Variante dont la couleur est la plus proche de l'accent (distance RGB). */
function nearest(accent: string): string {
  const [r, g, b] = rgb(accent)
  let best = VARIANTS[0]
  let bestD = Infinity
  for (const v of VARIANTS) {
    const [vr, vg, vb] = rgb(v.hex)
    const d = (r - vr) ** 2 + (g - vg) ** 2 + (b - vb) ** 2
    if (d < bestD) {
      bestD = d
      best = v
    }
  }
  return best.src
}

export default function Logo(props: { size?: number; className?: string }): JSX.Element {
  const accent = useAppearanceStore((s) => s.appearance.accent)
  const size = props.size ?? 22
  return (
    <img
      src={nearest(accent)}
      width={size}
      height={size}
      alt="GVue"
      draggable={false}
      className={`rounded-[5px] ${props.className ?? ''}`}
    />
  )
}
