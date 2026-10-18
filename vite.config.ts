/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env['VITE_BASE_PATH'] ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // Mise à jour douce : jamais de rechargement forcé (scénario d'acceptation 8).
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon-180.png', 'favicon.svg'],
      manifest: {
        name: 'Planificateur',
        short_name: 'Planificateur',
        description: 'Organise la journée sur une timeline visuelle, fonctionne hors ligne.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        theme_color: '#1a1d27',
        background_color: '#1a1d27',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Page de test du Web Push : jamais mise en cache (outil temporaire).
        globIgnores: ['**/push-test.html', '**/push-test-sw.js'],
        navigateFallback: 'index.html',
        // Les données ne quittent jamais le téléphone : aucun runtime caching réseau.
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      thresholds: {
        'src/domain/**': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  },
});
