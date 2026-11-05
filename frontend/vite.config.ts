/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Sub-path the app is served from: '/' locally and on Vercel, '/<repo>/' on GitHub Pages.
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // New deploys take over on the next app open; no "refresh" prompt to tap through.
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon.svg',
        'icons/favicon-64x64.png',
        'icons/apple-touch-icon-180x180.png',
      ],
      manifest: {
        name: 'BJJ Journal',
        short_name: 'BJJ Journal',
        description: 'Technique library, class log and mistake tracker for Brazilian Jiu-Jitsu.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f172a',
        background_color: '#020617',
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell only. API calls go to another origin and are never cached.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
