/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Le thème se peint via des variables CSS (cf. section 7 de la spec).
      // Tailwind ne fait qu'exposer ces variables comme tokens utilitaires.
      colors: {
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        bg: 'var(--bg)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-hover': 'var(--bg-hover)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        fg: 'var(--fg)',
        'fg-secondary': 'var(--fg-secondary)',
        'fg-muted': 'var(--fg-muted)',
        'warning-fg': 'var(--warning-fg)',
        'warning-bg': 'var(--warning-bg)',
        'info-fg': 'var(--info-fg)',
        'info-bg': 'var(--info-bg)',
        'success-fg': 'var(--success-fg)',
        'success-bg': 'var(--success-bg)',
        'danger-fg': 'var(--danger-fg)',
        'danger-bg': 'var(--danger-bg)'
      },
      borderRadius: {
        app: 'var(--radius)'
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        mono: 'var(--font-mono)'
      },
      spacing: {
        row: 'var(--row-pad)'
      }
    }
  },
  plugins: []
}
