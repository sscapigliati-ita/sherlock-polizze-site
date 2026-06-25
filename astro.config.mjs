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
      registerType: 'prompt',
      strategies: 'generateSW',
      injectRegister: false, // registriamo manualmente dal componente Toast
      manifest: {
        name: 'Sherlock — Polizze AI',
        short_name: 'Sherlock',
        description: 'Analisi AI delle polizze assicurative italiane',
        lang: 'it-IT',
        start_url: '/',
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
        // Esclude le pagine dinamiche dal precache HTML (sono server-rendered)
        navigateFallback: '/offline',
        navigateFallbackDenylist: [
          /^\/admin/,
          /^\/abbonati/,
          /^\/api\//,
        ],
        runtimeCaching: [
          {
            // Pagine marketing: NetworkFirst con timeout 3s, fallback cache
            urlPattern: ({ url, request }) =>
              request.mode === 'navigate' &&
              !url.pathname.startsWith('/admin') &&
              !url.pathname.startsWith('/abbonati') &&
              !url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-marketing',
              networkTimeoutSeconds: 3,
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
