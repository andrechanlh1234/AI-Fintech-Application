import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/tokens.css'
import './styles/overrides.css'
import './styles/fonts.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// registerType: 'autoUpdate' (vite.config.ts) bakes self.skipWaiting() +
// clientsClaim() into the generated SW, but that alone only lets a new SW
// take over future network requests -- it doesn't reload the page that's
// already open onto it. Without onNeedRefresh, this helper's default is to
// apply an available update silently (no prompt) and reload -- the actual
// "auto" part of autoUpdate, so an installed PWA never gets stuck serving a
// stale build indefinitely.
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}
