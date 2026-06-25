// Palettes et options de personnalisation (cf. maquette + section 7 de la spec).

export interface AccentSwatch {
  label: string
  value: string
}

/** Pastilles d'accent de la maquette. */
export const ACCENT_SWATCHES: AccentSwatch[] = [
  { label: 'Violet', value: '#7F77DD' },
  { label: 'Sarcelle', value: '#1D9E75' },
  { label: 'Corail', value: '#D85A30' },
  { label: 'Bleu', value: '#378ADD' },
  { label: 'Ambre', value: '#EF9F27' },
  { label: 'Rose', value: '#D4537E' }
]

export const FONT_CHOICES: { label: string; value: string }[] = [
  { label: 'Inter', value: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  { label: 'Segoe UI', value: "'Segoe UI', system-ui, sans-serif" },
  { label: 'System', value: 'system-ui, sans-serif' }
]
