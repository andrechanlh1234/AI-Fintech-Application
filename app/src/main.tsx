import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/overrides.css'
import './styles/fonts.css'
import App from './App.tsx'
import { initKeyboardScrollAssist } from './lib/keyboardScrollAssist'

initKeyboardScrollAssist()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// No service worker. A Workbox precache SW (the old setup) kept installed
// iOS clients -- the Capacitor WKWebView and any home-screen PWA -- pinned
// to a stale bundle, because the autoUpdate reload handshake is unreliable
// there. This app serves its assets locally in the native build and
// no-store from the dev server, so an offline cache bought nothing and only
// caused stale-content bugs. Instead of registering anything, actively tear
// down any SW + caches a previous build left on this device, once, on load.
// (Not the generated self-destroying sw.js via virtual:pwa-register -- that
// re-installs and reloads every load, which loops. This is a plain one-shot
// cleanup with no reload.)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => { /* nothing registered / not supported -- fine */ })
  if (typeof caches !== 'undefined') {
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => { /* no Cache Storage -- fine */ })
  }
}
