import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  preview: {
    // Allows `vite preview` to be reached through a trycloudflare.com
    // quick tunnel (for testing the installed PWA on a phone over HTTPS).
    allowedHosts: ['.trycloudflare.com'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The default injected registration script just calls .register()
      // with no update handling at all -- a new SW would install and (per
      // the workbox self.skipWaiting()/clientsClaim() this registerType
      // bakes in) activate in the background, but nothing ever told the
      // already-open page to reload onto it, so installed clients could be
      // stuck on a stale build indefinitely. Registering manually from
      // main.tsx via virtual:pwa-register instead gives us the real
      // autoUpdate behaviour (silent update + reload).
      injectRegister: false,
      manifest: {
        name: 'Cukai — Personal Finance & Tax',
        short_name: 'Cukai',
        description: 'Personal finance tracking and Malaysian (LHDN) tax relief management.',
        theme_color: '#2E9E3F',
        background_color: '#f7f8f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell (JS/CSS/HTML/fonts/icons) so the
        // app can boot offline instead of showing a blank screen.
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff,woff2}'],
        navigateFallback: '/index.html',
        // The backend API runs on a different port (see src/lib/api.ts)
        // and must never be served stale: always hit the network first,
        // only falling back to a cached response if the device is
        // offline, and never trusting that fallback for more than a
        // few minutes.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => !sameOrigin || url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutes — short-lived fallback only
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
