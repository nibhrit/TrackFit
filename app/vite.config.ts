import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://<user>.github.io/TrackFit/ on GitHub Pages
export default defineConfig({
  base: '/TrackFit/',
  plugins: [
    react(),
    VitePWA({
      // New versions install in the background and apply on next open
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'TrackFit',
        short_name: 'TrackFit',
        description: 'Last weights, protein and daily habits.',
        start_url: '/TrackFit/',
        scope: '/TrackFit/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#121517',
        theme_color: '#1D2227',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app itself so it opens with no signal; data calls always go to the network
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/TrackFit/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
