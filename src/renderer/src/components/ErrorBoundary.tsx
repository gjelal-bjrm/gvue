import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  componentStack: string
}

/**
 * Filet de sécurité du rendu : capture toute erreur React (qui sinon laisse une
 * fenêtre blanche, sans message ni récupération) et affiche un écran de repli
 * avec « Recharger » et « Copier les détails ». L'erreur est aussi remontée au
 * processus principal pour atterrir dans le fichier de log (diagnostic terrain).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? ''
    this.setState({ componentStack })
    try {
      void window.api?.log?.report({
        scope: 'react',
        message: error.message,
        stack: error.stack,
        componentStack
      })
    } catch {
      /* journalisation best-effort */
    }
  }

  private reload = (): void => {
    window.location.reload()
  }

  private copyDetails = (): void => {
    const { error, componentStack } = this.state
    const text = [error?.message, error?.stack, componentStack].filter(Boolean).join('\n')
    void navigator.clipboard?.writeText(text)
  }

  override render(): ReactNode {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--bg, #1e1e1e)',
          color: 'var(--fg, #eee)',
          font: 'var(--font-ui, 14px system-ui)',
          zIndex: 99999
        }}
      >
        <div
          style={{
            maxWidth: 640,
            width: '100%',
            background: 'var(--bg-secondary, #262626)',
            border: '1px solid var(--border, #3a3a3a)',
            borderRadius: 'var(--radius, 10px)',
            padding: 24,
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
          }}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: 18 }}>Une erreur est survenue</h1>
          <p style={{ margin: '0 0 16px', color: 'var(--fg-secondary, #aaa)' }}>
            GVue a rencontré un problème d'affichage. Tes fichiers ne sont pas affectés.
            Recharge la fenêtre pour reprendre.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={this.reload}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius, 8px)',
                border: 'none',
                background: 'var(--accent, #3b82f6)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Recharger
            </button>
            <button
              onClick={this.copyDetails}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius, 8px)',
                border: '1px solid var(--border, #3a3a3a)',
                background: 'transparent',
                color: 'var(--fg, #eee)',
                cursor: 'pointer'
              }}
            >
              Copier les détails
            </button>
          </div>

          <pre
            style={{
              margin: 0,
              padding: 12,
              maxHeight: 200,
              overflow: 'auto',
              background: 'var(--bg-tertiary, #1a1a1a)',
              border: '1px solid var(--border, #3a3a3a)',
              borderRadius: 'var(--radius, 8px)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 12,
              color: 'var(--fg-muted, #888)',
              whiteSpace: 'pre-wrap'
            }}
          >
            {error.message}
            {'\n'}
            {error.stack}
            {componentStack}
          </pre>
        </div>
      </div>
    )
  }
}
