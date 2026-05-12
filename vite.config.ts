/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

const BUILD_SHA = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  base: '/mnemochrome/',
  server: { host: '0.0.0.0', port: 5173 },
  test: { environment: 'jsdom' },
  define: {
    __BUILD_SHA__: JSON.stringify(BUILD_SHA),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/favicon-16.png'],
      manifest: {
        name: 'Mnemochrome',
        short_name: 'Mnemochrome',
        description: 'See a color, then summon it back.',
        theme_color: '#0E0E10',
        background_color: '#0E0E10',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/mnemochrome/',
        start_url: '/mnemochrome/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Force the new service worker to activate immediately and take over
        // open tabs so PWA users get the latest build on next launch — no
        // dance of close-tab/reopen required.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
