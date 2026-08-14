import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      // No runtimeCaching entries on purpose: game state, guest auth, and
      // WebSocket traffic all live on a different origin (the API server)
      // and must never be served from cache. Workbox's default precache
      // only covers this build's own JS/CSS/HTML/icons — every request
      // that isn't one of those still goes straight to the network.
      manifest: {
        name: 'Yahtzee',
        short_name: 'Yahtzee',
        description: 'Pass & Play locally or roll online with friends in a private lobby.',
        start_url: '/',
        display: 'standalone',
        background_color: '#1e140c',
        theme_color: '#1e140c',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5190,
    strictPort: true,
  },
})
