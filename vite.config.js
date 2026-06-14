import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Offline-first PWA. The service worker precaches the app shell; runtime data
// lives in IndexedDB (see src/db/idb.js), so the app boots and works fully
// offline once installed.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Travel Log & Leave Optimizer',
        short_name: 'Travel',
        description: 'Track trips and arbitrage your annual leave.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        // Single scalable SVG icon keeps the repo binary-free; browsers that
        // require raster icons will rasterize it. Drop PNGs into /public and add
        // entries here if you want pixel-perfect install icons.
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Never cache the Apps Script endpoint — those requests must hit the
        // network (and fall back to IndexedDB in app code) so data stays fresh.
        navigateFallbackDenylist: [/^\/macros\//],
      },
    }),
  ],
});
