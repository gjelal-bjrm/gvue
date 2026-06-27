import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { applyAppearance } from './theme/applyTheme'
import '@xterm/xterm/css/xterm.css'
import './styles/global.css'

// Remonte au journal du processus principal toute erreur/rejet non interceptés
// côté renderer (en plus de l'ErrorBoundary qui couvre le rendu React).
window.addEventListener('error', (e) => {
  void window.api?.log?.report({
    scope: 'window.error',
    message: e.message,
    stack: e.error?.stack
  })
})
window.addEventListener('unhandledrejection', (e) => {
  void window.api?.log?.report({
    scope: 'unhandledrejection',
    message: String(e.reason?.message ?? e.reason),
    stack: e.reason?.stack
  })
})

/**
 * Démarrage du renderer.
 * On applique l'apparence persistée AVANT le premier rendu pour éviter
 * tout flash de thème, puis on monte React.
 */
async function bootstrap(): Promise<void> {
  try {
    const config = await window.api.config.all()
    applyAppearance(config.appearance)
  } catch {
    /* valeurs par défaut des variables CSS si la config est indisponible */
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

bootstrap()
