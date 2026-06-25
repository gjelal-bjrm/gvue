import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyAppearance } from './theme/applyTheme'
import '@xterm/xterm/css/xterm.css'
import './styles/global.css'

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
      <App />
    </React.StrictMode>
  )
}

bootstrap()
