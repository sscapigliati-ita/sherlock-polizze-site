# PWA Sherlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare `sherlock-polizze-site` in una PWA installabile su iPhone (Safari Add to Home), con offline graceful per pagine marketing, update toast e splash screen iPhone auto-generati.

**Architecture:** Plugin `@vite-pwa/astro` per manifest + Workbox SW; tool `pwa-asset-generator` per icone e splash; meta tag Apple aggiunti manualmente in `BaseLayout.astro`; componente `PwaUpdateToast` per notificare nuove versioni.

**Tech Stack:** Astro 6.4.6 SSR + Vercel adapter, `@vite-pwa/astro` ^1.x, `pwa-asset-generator` ^7.x (dev), Workbox 7 (transitive).

## Global Constraints

- Sito target: `sherlock-site/` (Astro SSR, output server, deploy Vercel).
- Branch git: `main`. Push diretto = autodeploy Vercel.
- Lingua UI: italiano.
- Theme color esistente: `#0f172a` (navy). Background splash: `#0a1224`.
- App name installato: "Sherlock — Polizze AI". Short name: "Sherlock".
- `start_url`: `/`. `display`: `standalone`. `orientation`: `portrait`.
- Le pagine `/admin`, `/abbonati` e tutte `/api/*` NON devono essere mai cachate dal SW.
- Le pagine marketing (`/`, `/guide/*`, `/esempio-*`, `/privacy`, `/trasparenza`, `/abbonamento/*`) usano NetworkFirst con fallback offline.
- Spec di riferimento: `docs/superpowers/specs/2026-06-25-pwa-installabile-iphone-design.md`.

## File Structure

| Path | Responsabilità |
|---|---|
| `package.json` | aggiunge dipendenze `@vite-pwa/astro` (runtime) e `pwa-asset-generator` (dev) |
| `astro.config.mjs` | configura integration `AstroPWA` con manifest + workbox |
| `public/icons/` | nuova dir con icone PNG (192, 512, 512-maskable, apple-touch-icon 180) e splash iPhone |
| `src/layouts/BaseLayout.astro` | aggiunge meta apple-*, link manifest, link apple-touch-icon, link splash, include `<PwaUpdateToast/>` |
| `src/components/PwaUpdateToast.astro` | banner UI + script client che usa `virtual:pwa-register` per gestire update |
| `src/pages/offline.astro` | pagina statica fallback offline |
| `docs/superpowers/specs/...design.md` | spec già scritta (riferimento) |

---

### Task 1: Installa dipendenze e prepara struttura icone

**Files:**
- Modify: `package.json` (aggiunge dipendenze)
- Create: `public/icons/` (directory vuota in attesa di Task 2)

**Interfaces:**
- Consumes: nulla (primo task)
- Produces: `@vite-pwa/astro` import disponibile per `astro.config.mjs`; `pwa-asset-generator` CLI eseguibile via `npx`.

- [ ] **Step 1: Installa `@vite-pwa/astro` come runtime dep**

Run:
```bash
cd /c/Users/Stefano/sherlock-site && npm install @vite-pwa/astro@^1
```

Expected: aggiunto a `dependencies` in `package.json`, no errori peer dependency. Se errore "peer dep astro@^4||^5", verifica che ci sia una versione compatibile con Astro 6 — al 2026-06-25 deve esistere `^1.0.0` o superiore.

- [ ] **Step 2: Installa `pwa-asset-generator` come dev dep**

Run:
```bash
npm install --save-dev pwa-asset-generator@^7
```

Expected: aggiunto a `devDependencies` (creando la sezione se non esiste).

- [ ] **Step 3: Crea la dir `public/icons/`**

Run:
```bash
mkdir -p public/icons
```

Expected: dir creata (vuota), `ls public/icons` non dà errori.

- [ ] **Step 4: Verifica build ancora pulito (no regressioni dall'install)**

Run:
```bash
npm run build
```

Expected: build completa "Complete!", nessun errore TS. Le nuove dipendenze sono installate ma non ancora referenziate, quindi il build deve essere identico a prima.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json public/icons
git commit -m "pwa: aggiunge @vite-pwa/astro + pwa-asset-generator + dir icons"
```

---

### Task 2: Genera icone PWA e splash iPhone da `public/icon.png`

**Files:**
- Create: `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png`
- Create: `public/icons/apple-splash-*.png` (~10 file per risoluzioni iPhone/iPad)
- Read: `public/icon.png` (sorgente)

**Interfaces:**
- Consumes: `pwa-asset-generator` CLI da Task 1.
- Produces: set di file `.png` referenziabili dal manifest e dai `<link rel="apple-touch-startup-image">` in BaseLayout.

- [ ] **Step 1: Lancia `pwa-asset-generator` su `public/icon.png` con output in `public/icons/`**

Run:
```bash
npx pwa-asset-generator public/icon.png public/icons --background "#0a1224" --padding "12%" --type png --opaque false --favicon false --mstile false --icon-only false --maskable true --manifest public/manifest-template.json --index src/layouts/BaseLayout.astro --xhtml
```

Spiegazione flag importanti:
- `--background "#0a1224"`: colore sfondo splash (navy scuro)
- `--padding "12%"`: padding per icona dentro lo splash (non sembra schiacciata)
- `--maskable true`: genera anche `icon-512-maskable.png`
- `--manifest public/manifest-template.json`: scrive le entries `icons[]` in un file temporaneo (lo useremo per copia/incolla, non per il manifest finale)
- `--index src/layouts/BaseLayout.astro`: scrive i tag `<link rel="apple-touch-startup-image">` dentro BaseLayout (li lasciamo lì, è quello che vogliamo)
- `--xhtml`: chiude i tag self-closing

Expected: console stampa "Generated images successfully", `public/icons/` contiene ~15 file PNG. `BaseLayout.astro` ha nuovi tag iniettati nell'`<head>`.

- [ ] **Step 2: Verifica file generati**

Run:
```bash
ls public/icons/
```

Expected output (almeno questi):
```
apple-icon-180.png
apple-splash-1170-2532.png
apple-splash-1179-2556.png
apple-splash-1242-2688.png
apple-splash-1284-2778.png
apple-splash-1290-2796.png
apple-splash-640-1136.png
apple-splash-750-1334.png
apple-splash-828-1792.png
manifest-icon-192.maskable.png
manifest-icon-512.maskable.png
```

(I nomi esatti possono variare leggermente per versione tool — l'importante è avere icone 192/512/maskable + splash multipli.)

- [ ] **Step 3: Rinomina/copia i file per allinearli al manifest che useremo nel Task 3**

Lo script crea nomi tipo `manifest-icon-192.maskable.png` ma il nostro manifest si aspetta `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png`. Rinomina (se necessario, dipende dall'output reale del tool):

```bash
cd public/icons
[ -f manifest-icon-192.maskable.png ] && cp manifest-icon-192.maskable.png icon-192.png
[ -f manifest-icon-512.maskable.png ] && cp manifest-icon-512.maskable.png icon-512.png && cp manifest-icon-512.maskable.png icon-512-maskable.png
[ -f apple-icon-180.png ] && cp apple-icon-180.png apple-touch-icon-180.png
cd ../..
```

Expected: i 4 file `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png` esistono in `public/icons/`.

- [ ] **Step 4: Cancella il file temporaneo manifest-template.json e gli artifact non usati**

Run:
```bash
rm -f public/manifest-template.json
```

Expected: solo file utili in `public/`. Se il tool ha creato altri file estranei in root (es. `icon-1024.png`), elimina manualmente.

- [ ] **Step 5: Verifica `BaseLayout.astro` non si rompe (build)**

Run:
```bash
npm run build
```

Expected: build OK. I tag iniettati dal generator nell'`<head>` sono solo `<link rel="apple-touch-startup-image">` quindi non rompono nulla. Se rompe, leggi il diff `git diff src/layouts/BaseLayout.astro` per capire dove ha iniettato.

- [ ] **Step 6: Commit (solo asset, modifiche BaseLayout finiscono in Task 5)**

```bash
git add public/icons src/layouts/BaseLayout.astro
git commit -m "pwa: genera icone (192/512/maskable + apple) e splash iPhone"
```

> NB: BaseLayout.astro qui ha SOLO i tag splash iniettati dal generator. Gli altri meta apple li aggiungiamo nel Task 5.

---

### Task 3: Configura `@vite-pwa/astro` in `astro.config.mjs`

**Files:**
- Modify: `astro.config.mjs`

**Interfaces:**
- Consumes: dipendenza `@vite-pwa/astro` da Task 1; icone da Task 2.
- Produces: build genera `dist/client/manifest.webmanifest` + `dist/client/sw.js` + precache; modulo virtuale `virtual:pwa-register` disponibile per import nel componente Toast (Task 6).

- [ ] **Step 1: Modifica `astro.config.mjs` per aggiungere AstroPWA**

Sostituisci interamente il file con:

```javascript
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
```

- [ ] **Step 2: Build di verifica**

Run:
```bash
npm run build
```

Expected: build OK. Nell'output Astro deve apparire una riga tipo `PWA v1.x` e `mode: generateSW`. In `dist/client/` devono comparire `manifest.webmanifest`, `sw.js`, e `workbox-*.js`.

- [ ] **Step 3: Verifica contenuto manifest generato**

Run:
```bash
cat dist/client/manifest.webmanifest
```

Expected: JSON con i campi del manifest (name, short_name, start_url, ecc.) e le icone. Se mancano campi o le icone sono vuote, ritorna allo Step 1 e correggi.

- [ ] **Step 4: Commit**

```bash
git add astro.config.mjs
git commit -m "pwa: configura @vite-pwa/astro con manifest + workbox runtime caching"
```

---

### Task 4: Crea la pagina `offline.astro`

**Files:**
- Create: `src/pages/offline.astro`

**Interfaces:**
- Consumes: `BaseLayout` esistente.
- Produces: route `/offline` statica usata come `navigateFallback` dal SW (Task 3).

- [ ] **Step 1: Crea `src/pages/offline.astro`**

Scrivi:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout
  title="Sembri offline — Sherlock"
  description="Connessione assente. Le pagine già visitate restano accessibili."
>
  <main class="min-h-[70vh] flex items-center justify-center px-5 py-10">
    <div class="max-w-md text-center">
      <div class="text-6xl mb-4">📡</div>
      <h1 class="text-3xl font-extrabold text-white mb-3">Sembri offline</h1>
      <p class="text-navy-300 mb-6">
        Non c'è connessione. Le pagine che hai già aperto restano disponibili nella cache locale.
        Riprova quando torni online.
      </p>
      <button
        type="button"
        onclick="location.reload()"
        class="inline-block rounded-lg bg-gold-400 px-6 py-3 font-bold text-navy-900 hover:bg-gold-300 transition"
      >
        Riprova
      </button>
    </div>
  </main>
</BaseLayout>
```

- [ ] **Step 2: Verifica build**

Run:
```bash
npm run build
```

Expected: build OK. In output deve apparire `/offline/index.html` (o `/offline.html` a seconda di `trailingSlash`) tra le pagine prerendered. Se ti dice "/offline is server-rendered" è OK lo stesso, basta che esista.

- [ ] **Step 3: Commit**

```bash
git add src/pages/offline.astro
git commit -m "pwa: pagina /offline fallback per navigazione senza rete"
```

---

### Task 5: Aggiungi meta tag Apple in `BaseLayout.astro` e link al manifest

**Files:**
- Modify: `src/layouts/BaseLayout.astro` (aggiunge tag dentro `<head>`)

**Interfaces:**
- Consumes: manifest da Task 3, icone+splash da Task 2.
- Produces: BaseLayout completo per installabilità iOS.

- [ ] **Step 1: Leggi BaseLayout.astro per vedere dove sono i tag esistenti**

Run:
```bash
grep -n "theme-color\|favicon\|apple-touch-startup-image" src/layouts/BaseLayout.astro
```

Expected: trovi la riga `<meta name="theme-color" content="#0f172a" />` (da prima); trovi i tag `<link rel="apple-touch-startup-image">` iniettati nel Task 2.

- [ ] **Step 2: Subito sopra `<meta name="theme-color">`, aggiungi i nuovi tag**

Apri `src/layouts/BaseLayout.astro` e cerca la linea `<meta name="theme-color" content="#0f172a" />`. **Immediatamente prima** di quella riga, inserisci:

```html
  <!-- PWA: installabilità iOS + Android -->
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Sherlock" />
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />
```

(I tag `apple-touch-startup-image` aggiunti dal generator nel Task 2 restano dove sono, sono separati.)

- [ ] **Step 3: Verifica build**

Run:
```bash
npm run build
```

Expected: build OK.

- [ ] **Step 4: Verifica HTML buildato**

Run:
```bash
grep -A 1 "apple-mobile-web-app-capable" dist/client/index.html 2>&1 | head -5
```

Expected: trova la riga `apple-mobile-web-app-capable` nell'HTML rendered. Se Astro fa SSR e `/` non è prerendered, prova `cat dist/server/pages/index.astro.mjs | grep apple-mobile` o testa via preview.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "pwa: meta tag Apple + link manifest in BaseLayout per installabilità iOS"
```

---

### Task 6: Crea componente `PwaUpdateToast.astro` e includilo nel BaseLayout

**Files:**
- Create: `src/components/PwaUpdateToast.astro`
- Modify: `src/layouts/BaseLayout.astro` (importa e include il componente prima di `</body>`)

**Interfaces:**
- Consumes: modulo virtuale `virtual:pwa-register` (esposto dal plugin via Task 3); BaseLayout slot.
- Produces: registrazione SW client-side + banner UI per update.

- [ ] **Step 1: Crea `src/components/PwaUpdateToast.astro`**

Scrivi:

```astro
---
// Componente client-only che registra il service worker e mostra un toast
// quando arriva una nuova versione del SW (event 'waiting').
// Il modulo virtual:pwa-register è esposto dal plugin @vite-pwa/astro.
---
<div
  id="pwa-update-toast"
  hidden
  class="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md rounded-xl border border-gold-400/40 bg-navy-900/95 shadow-2xl backdrop-blur p-4 flex items-center justify-between gap-3"
>
  <div class="text-sm text-white">
    <div class="font-bold">Nuova versione disponibile</div>
    <div class="text-xs text-navy-300">Aggiorna per le ultime novità di Sherlock.</div>
  </div>
  <div class="flex gap-2">
    <button
      type="button"
      id="pwa-update-dismiss"
      class="text-xs text-navy-400 hover:text-navy-200 px-2 py-1"
    >
      Dopo
    </button>
    <button
      type="button"
      id="pwa-update-apply"
      class="text-xs font-bold bg-gold-400 hover:bg-gold-300 text-navy-900 rounded px-3 py-1.5"
    >
      Aggiorna
    </button>
  </div>
</div>

<script>
  import { registerSW } from 'virtual:pwa-register';

  const toast = document.getElementById('pwa-update-toast');
  const btnApply = document.getElementById('pwa-update-apply');
  const btnDismiss = document.getElementById('pwa-update-dismiss');

  const updateSW = registerSW({
    onNeedRefresh() {
      if (toast) toast.hidden = false;
    },
    onOfflineReady() {
      // primo install riuscito: niente UI per ora
    },
  });

  btnApply?.addEventListener('click', () => {
    updateSW(true); // skipWaiting + reload
  });
  btnDismiss?.addEventListener('click', () => {
    if (toast) toast.hidden = true;
  });
</script>
```

- [ ] **Step 2: Includi il componente in `BaseLayout.astro` prima di `</body>`**

Apri `src/layouts/BaseLayout.astro`, in cima al frontmatter (dopo `import '../styles/global.css';`) aggiungi:

```typescript
import PwaUpdateToast from '../components/PwaUpdateToast.astro';
```

Poi nel body, **immediatamente prima del tag `</body>`** (cerca con grep se non lo trovi a vista), aggiungi:

```html
<PwaUpdateToast />
```

- [ ] **Step 3: Build di verifica**

Run:
```bash
npm run build
```

Expected: build OK. Nell'output, sotto la bundle del client deve apparire un riferimento a `virtual:pwa-register` o a un chunk con `registerSW`.

- [ ] **Step 4: Commit**

```bash
git add src/components/PwaUpdateToast.astro src/layouts/BaseLayout.astro
git commit -m "pwa: componente PwaUpdateToast + registrazione SW via virtual:pwa-register"
```

---

### Task 7: Smoke test locale (build + preview + offline check)

**Files:**
- Nessuna modifica codice; solo verifica.

**Interfaces:**
- Consumes: tutto il setup PWA finora.
- Produces: conferma che la PWA è installabile e funziona offline localmente.

- [ ] **Step 1: Build pulito**

Run:
```bash
rm -rf dist .vercel/output && npm run build
```

Expected: build completa, `dist/client/sw.js` esiste, `dist/client/manifest.webmanifest` esiste.

- [ ] **Step 2: Avvia preview server**

Run (in background o nuova shell):
```bash
npm run preview
```

Expected: server su `http://localhost:4321` (o porta indicata).

- [ ] **Step 3: Apri Chrome su `http://localhost:4321` e verifica manifest**

In DevTools → Application → Manifest:
- Name: "Sherlock — Polizze AI"
- Icons: tutte presenti senza errori
- start_url: `/`
- display: `standalone`

In DevTools → Application → Service Workers:
- Stato: "activated and is running"
- Sorgente: `/sw.js`

- [ ] **Step 4: Lighthouse PWA audit**

In Chrome DevTools → Lighthouse → categoria "Progressive Web App" → Generate report.

Expected: score ≥ 90. Le checkbox principali devono essere verdi:
- ✓ Installable
- ✓ Has a `<meta name="viewport">` with `width` or `initial-scale`
- ✓ Apple touch icon
- ✓ Themed omnibox
- ✓ Splash screen

Se rosso, leggi il warning e correggi.

- [ ] **Step 5: Test offline**

In DevTools → Network → seleziona "Offline" → ricarica la home. Deve caricarsi (dalla cache SW). Naviga su `/guide` o `/privacy`: devono caricarsi se sono state visitate, altrimenti deve apparire `/offline`.

- [ ] **Step 6: Test che `/admin` NON funzioni offline**

Sempre con "Offline" attivo, prova `http://localhost:4321/admin`. Deve fallire (oppure reindirizzare a `/offline`). Importante: non deve mostrare contenuti cached della pagina admin.

- [ ] **Step 7: Ferma preview**

Run: `Ctrl+C` nel terminale del preview.

- [ ] **Step 8: Nessun commit (solo verifica)**

Niente da committare; se hai dovuto correggere qualcosa, riparti dal task corrispondente.

---

### Task 8: Deploy production + test su iPhone reale

**Files:**
- Nessuna modifica; solo deploy e verifica.

**Interfaces:**
- Consumes: branch `main` con tutti i commit dei task precedenti.
- Produces: PWA installabile in production.

- [ ] **Step 1: Push del branch su origin (autodeploy Vercel)**

Run:
```bash
git push origin main
```

Expected: Vercel inizia il build deploy. Verifica su dashboard Vercel (`vercel ls` o web UI) che il deploy completi senza errori.

- [ ] **Step 2: Apri Safari su iPhone reale → naviga su `https://sherlock-polizze-site-five.vercel.app`**

Aspetta che la pagina carichi completamente (deve registrare il SW in background).

- [ ] **Step 3: Tocca il pulsante Condividi (▲) → "Aggiungi a Home"**

Expected:
- Anteprima dell'icona = `apple-touch-icon-180.png` (icona Sherlock, non screenshot della pagina)
- Nome suggerito: "Sherlock"
- Tocca "Aggiungi"

- [ ] **Step 4: Chiudi Safari e apri "Sherlock" dalla home screen iPhone**

Expected:
- Splash screen con sfondo navy `#0a1224` + icona Sherlock (quello che hai generato in Task 2)
- App si apre in **fullscreen** (no barra Safari)
- La home appare normalmente

- [ ] **Step 5: Test update toast**

Sul tuo PC: fai una modifica banale a `BaseLayout.astro` (es. cambia un commento), commit + push. Aspetta deploy Vercel.

Poi sull'iPhone: chiudi e riapri la PWA. Dopo qualche secondo deve apparire il toast in basso "Nuova versione disponibile" con pulsante "Aggiorna". Toccalo → la PWA si ricarica con la nuova versione.

- [ ] **Step 6: Test offline su iPhone**

In iPhone Settings → Wi-Fi → disabilita. Apri PWA. La home (e ogni pagina già visitata) deve caricarsi dalla cache. Naviga su una guida non ancora visitata → deve apparire `/offline`.

- [ ] **Step 7: Nessun commit**

Tutto verificato in produzione. Aggiorna manualmente il task #7 nella lista TaskList come "completed".

---

## Self-Review

**Spec coverage:**
- Manifest + meta Apple → Task 3 + Task 5 ✓
- Service Worker con strategie caching miste → Task 3 ✓
- Pagina offline → Task 4 ✓
- Update toast → Task 6 ✓
- Icone + splash iPhone → Task 2 ✓
- Verifica installabilità + offline → Task 7 + Task 8 ✓
- Rollback strategy: documentata nella spec, non serve task dedicato ✓
- Vercel deploy senza config extra → Task 8 ✓

**Placeholder scan:** Tutti gli step contengono codice o comandi concreti. Niente "TBD" / "implement appropriate" / "similar to above". Le verifiche hanno expected output specifici.

**Type consistency:** I nomi icone (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png`) sono coerenti tra Task 2, Task 3 (manifest), Task 5 (link tag). Il manifest path `/manifest.webmanifest` è coerente tra Task 3 (output build) e Task 5 (link rel).

**Note pratiche per l'esecutore:**
- L'esecutore è su Windows. I comandi `mkdir -p`, `rm -f`, `[ -f ... ]`, `cd ../..` funzionano in Git Bash (default su questa macchina) ma non in PowerShell puro. Eseguire i comandi shell via Bash tool, non PowerShell.
- Se `pwa-asset-generator` ha output diverso da quello previsto in Task 2 Step 2, ispeziona `ls public/icons/` e adatta i nomi nel Step 3 e nel manifest.
- Per Lighthouse audit, serve Chrome installato.
