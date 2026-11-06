import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [
    // Phase 4: screens move out of public/app.js into React, one at a time.
    react(),
    // Builds manifest.webmanifest + a service worker so the kiosk installs as
    // an app (Chrome "Install app", iPad "Add to Home Screen") and loads with
    // no internet at the venue. Same setup as the Minted app.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Gunita',
        short_name: 'Gunita',
        description: 'Event video guestbook and photo booth kiosk.',
        // Relative to the manifest, so it stays inside /Gunita/ on GitHub Pages.
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        // Kiosks run landscape, but the live viewer is a phone in portrait.
        orientation: 'any',
        background_color: '#0b0b0f',
        theme_color: '#0b0b0f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // public/app.js, the vendored QR library and the bundled fonts all
        // need to be cached for an offline start; source maps do not. Fonts
        // are woff2 only: every browser Gunita runs on loads woff2, so the
        // .woff/.ttf fallbacks (about 1.4 MB) would never be used.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['**/*.map'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          jquery: ['jquery'],
          peerjs: ['peerjs'],
        },
      },
    },
  },
});
