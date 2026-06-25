# PWA Sherlock — installabile su iPhone

**Data**: 2026-06-25
**Stato**: approvato (in attesa review utente)

## Obiettivo

Permettere agli utenti iPhone di installare `sherlock-polizze-site` come app standalone sulla home screen (via Safari → "Aggiungi a Home"), con esperienza fullscreen, caching offline delle pagine marketing e notifica in-app quando esce un nuovo deploy.

Equivalente iOS dell'app Android nativa `it.sherlock.polizze` (che è già una WebView del sito).

## Scope

**Incluso**:
- Manifest web standard + meta tag Apple specifici per installabilità iOS
- Service Worker (Workbox) con strategia caching mista
- Pagina offline fallback
- Update toast quando arriva un nuovo SW
- Icone PWA generate (192, 512, 512-maskable, apple-touch-icon 180)
- Splash screen iPhone per tutte le risoluzioni

**Escluso** (YAGNI):
- Notifiche push (iOS 16.4+ supporta ma non ne abbiamo bisogno ora)
- Caching aggressivo di pagine app (`/admin`, `/abbonati`) — sempre fresche dalla rete
- Caching API (mai)

## Decisioni di design

| Domanda | Scelta | Motivazione |
|---|---|---|
| Stack | `@vite-pwa/astro` (plugin ufficiale) | Gestisce manifest + Workbox SW + registration; evita SW scritto a mano |
| `start_url` | `/` (home) | Maggior parte degli installer è in fase scoperta prodotto, non già pro |
| `display` | `standalone` | Look "app", senza barra Safari |
| `theme_color` | `#0f172a` (navy) | Già usato come `theme-color` nel BaseLayout |
| `background_color` | `#0a1224` | Navy più scuro per splash auto-iOS |
| Splash iPhone | Sì, auto-generati | UX più polished, lavoro minimo via tool |
| Update strategy | Toast con bottone esplicito | Mai forzare reload — l'utente potrebbe stare leggendo |

## Architettura

### Manifest (`public/manifest.webmanifest` — generato dal plugin)
```json
{
  "name": "Sherlock — Polizze AI",
  "short_name": "Sherlock",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#0f172a",
  "background_color": "#0a1224",
  "lang": "it-IT",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Service Worker — strategie caching

Il plugin genera `sw.js` con Workbox. Configurazione:

| Pattern | Strategia | Note |
|---|---|---|
| Asset statici buildati (`/_astro/*`, `/assets/*`) | **precache** | Stale-while-revalidate via Workbox precache manifest |
| `/` e pagine marketing (regex: `^/(guide/|esempio-|privacy|trasparenza|abbonamento)`) | **NetworkFirst** (timeout 3s) | Fallback a cache, poi a `/offline` |
| `/admin`, `/admin/*`, `/abbonati` | **NetworkOnly** | Mai cachate (sicurezza + freschezza) |
| `/api/*` | **NetworkOnly** | Mai cachate |
| Immagini OG, icone, font | **CacheFirst** | TTL 30 giorni, max 50 entries |

### Meta tag in `BaseLayout.astro`

Aggiunti nell'`<head>`:
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Sherlock" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<!-- splash iPhone: ~10 link rel="apple-touch-startup-image" con media queries -->
```

Aggiunti **manualmente** in `BaseLayout.astro` (controllo esplicito). `pwa-asset-generator` stampa l'HTML pronto da incollare alla fine della generazione delle icone.

### Update toast

Componente `src/components/PwaUpdateToast.astro` con markup + script client. Logica:
1. Registra il SW usando l'helper `registerSW` da `virtual:pwa-register` (vanilla JS, no framework dependency).
2. Sul callback `onNeedRefresh`: monta un banner fisso in basso con CSS coerente al sito.
3. Bottone "Aggiorna": chiama `updateSW(true)` → SW invia `SKIP_WAITING`, browser reload automatico.
4. Bottone "Dopo": dismiss locale (no persistenza — riappare al prossimo onNeedRefresh).

### Pagina offline

`src/pages/offline.astro`: statica, layout minimale (no API calls, no risorse esterne). Messaggio:
> "Connessione assente. Le pagine che hai già aperto restano disponibili. Riprova quando torni online."

Include CTA "Riprova" che fa `location.reload()`.

## File modificati/creati

| File | Tipo | Note |
|---|---|---|
| `package.json` | mod | `+ @vite-pwa/astro`, dev `+ pwa-asset-generator` |
| `astro.config.mjs` | mod | `+ AstroPWA({...})` integration |
| `src/layouts/BaseLayout.astro` | mod | `+` meta apple, link manifest, include `<PwaUpdateToast/>` |
| `src/components/PwaUpdateToast.astro` | new | Banner update + script |
| `src/pages/offline.astro` | new | Fallback offline |
| `public/icons/icon-192.png` | new | Generata da `public/icon.png` |
| `public/icons/icon-512.png` | new | Idem |
| `public/icons/icon-512-maskable.png` | new | Con padding per safe area Android |
| `public/icons/apple-touch-icon-180.png` | new | iOS home screen |
| `public/icons/apple-splash-*.png` | new | ~10 PNG splash iPhone |

## Data flow

1. **Build time**: plugin Vite-PWA legge la lista asset Astro, genera `manifest.webmanifest` + `sw.js` + precache manifest, copia in `dist/client/`.
2. **First load**: browser scarica HTML, registra SW (auto via `registerSW`). SW pre-cache asset statici.
3. **Navigazione**: SW intercetta fetch, applica strategia per URL.
4. **Add to Home Screen** (iOS): utente apre Safari → Condividi → "Aggiungi a Home". iOS legge manifest (per nome, theme, icona maskable) e meta apple (per fullscreen + icon 180 + splash). Crea shortcut launchabile.
5. **Update**: prossimo deploy → nuovo `sw.js`. Browser scarica in background, lo mette in `waiting`. Toast appare. Click "Aggiorna" → reload con nuovo SW attivo.

## Testing

- **Build locale**: `npm run build && npm run preview`
- **Audit Lighthouse**: PWA score deve essere ≥ 90
- **Test offline**: DevTools → Application → Service Workers → check "Offline" → naviga su pagine già visitate (devono caricarsi)
- **Test installazione Android**: Chrome → menu → "Aggiungi a schermata Home" → verifica icona, splash, fullscreen
- **Test installazione iOS**: Safari su iPhone reale (simulatore Mac OK alternativa) → Condividi → Aggiungi a Home → verifica icona, splash personalizzato, comportamento standalone
- **Test update toast**: cambia un commento qualsiasi, deploy, ricarica PWA → toast deve apparire

## Considerazioni Vercel

- Niente config extra: manifest e `sw.js` sono servible come statici da `dist/client/` (Vercel li gestisce automaticamente).
- Il SW va servito con header `Content-Type: application/javascript` e `Service-Worker-Allowed: /` (Vercel li imposta correttamente di default).
- Cache CDN: i file statici di Vercel hanno `Cache-Control: public, max-age=31536000, immutable` di default — adatto a `_astro/*`. Per `sw.js` invece Workbox aggiunge `Cache-Control: no-cache` per garantire freschezza degli update.

## Rischio noto: iOS storage quota

Safari limita le PWA a ~50 MB di storage SW. Il nostro precache (asset statici Astro + immagini OG) starà sotto 5 MB → no problemi.

## Rollback

Se la PWA crea problemi (es. SW bug che blocca utenti su versione vecchia), si fa rollback in 2 step:
1. Revert del commit di integrazione PWA + redeploy → nuovo SW vuoto che si auto-unregister.
2. Per utenti già installati: lo `sw.js` vuoto verrà installato come "new waiting SW", al refresh diventa attivo e svuota la cache.
