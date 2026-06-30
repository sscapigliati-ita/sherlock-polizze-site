// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
  site: 'https://sherlock-polizze-site-five.vercel.app',
  trailingSlash: 'never',
  output: 'server',
  adapter: vercel(),
  integrations: [
    sitemap(),
    mdx(),
    AstroPWA({
      registerType: 'autoUpdate', // SW si aggiorna senza chiedere conferma — evita versioni stantie
      strategies: 'generateSW',
      injectRegister: false, // registriamo manualmente dal componente Toast
      manifest: {
        name: 'Sherlock — Polizze AI',
        short_name: 'Sherlock',
        description: 'Analisi AI delle polizze assicurative italiane',
        lang: 'it-IT',
        start_url: '/app/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f172a',
        background_color: '#0a1224',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache di tutti gli asset statici buildati
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        globIgnores: ['**/abbonati*.html', '**/abbonati/**/*.html', '**/admin*.html', '**/admin/**/*.html'],
        // Pulisce le cache di vecchie versioni dei precache automatically
        cleanupOutdatedCaches: true,
        // Prende controllo subito dei tab aperti, evita confusione tra vecchio/nuovo SW
        clientsClaim: true,
        skipWaiting: true,
        // Niente navigateFallback globale: era la causa di "Sembri offline" falsi positivi
        // su connessioni mobili lente. Il fallback offline si attiva solo via runtimeCaching
        // catch handler sotto.
        navigateFallbackDenylist: [
          /^\/admin/,
          /^\/abbonati/,
          /^\/api\//,
          /^\/app\//,
        ],
        runtimeCaching: [
          {
            // Pagine marketing: NetworkFirst con timeout PIÙ LUNGO (8s) per tollerare 4G lento.
            // Solo se la rete davvero non risponde, si va a cache; se anche cache miss, /offline.
            urlPattern: ({ url, request }) =>
              request.mode === 'navigate' &&
              !url.pathname.startsWith('/admin') &&
              !url.pathname.startsWith('/abbonati') &&
              !url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/app/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-marketing',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Immagini: CacheFirst 30gg
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // SW solo in produzione (evita confusione in dev)
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
