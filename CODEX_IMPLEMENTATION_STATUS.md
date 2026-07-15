# Codex Implementation Status

Ultimo aggiornamento: 15 luglio 2026.

## Stato corrente

- Stabilizzazione del rischio pubblico in corso sul ramo `codex/site-conversion-redesign`.
- Completati: configurazione offerta transitoria, bonifica art. 1892/clausole, rimozione prove sociali non verificabili, simulazioni dichiarate, noindex offerta legacy, privacy coerente e controllo dominio/sitemap.
- Non completati in questa fase: restyling, nuovi prezzi, triage avanzato, upload multiplo, nuovo checkout e retention automatica.

- Recupero Claude: completato e committato.
- Specifica e piano Fase 1: approvati e committati.
- Baseline build: superata con Astro 6.4.6 e adapter Vercel.
- Test finali Fase 1: 67 superati su 67, inclusi 14 controlli giuridici e un controllo sui log sensibili.
- Astro check: ripristinato con TypeScript 6.0.3; verifica finale con 0 errori e 19 suggerimenti non bloccanti.
- Build finale Fase 1: superata.
- Correzioni Fase 1: concluse nei limiti dichiarati; i residui sono elencati negli audit e in `PENDING_TASKS.md`.

## Stack rilevato

- Frontend/server rendering: Astro 6, Tailwind CSS 4.
- Hosting/serverless: adapter Vercel.
- PWA: `@vite-pwa/astro` e Workbox; app statica in `public/app/index.html`.
- Storage: Upstash Redis/Vercel KV con fallback in memoria in sviluppo.
- AI: Anthropic tramite API server-side.
- Pagamenti: PayPal e Google Play Billing.
- Analytics: GA4 web/Firebase con gestione del consenso.
- Email: Resend.
- Test: Vitest; build Astro.

## Modifiche Claude mantenute

Tutte le otto modifiche recuperate sono mantenute. Nessuna è stata annullata. Le correzioni incomplete saranno completate preservando la finalità originaria e ampliando i test.

Sono state completate le occorrenze coperte dai test, disattivata l'offerta pubblica Founder lifetime, rimosse le promesse di analisi illimitate e impedita la scrittura dei codici di attivazione nei log. Le licenze Founder tecniche esistenti sono rimaste operative.

## Limiti attuali

Non sono stati eseguiti pagamenti reali né test end-to-end contro PayPal, Play Billing, GA4, Redis, Anthropic o Resend. Il sito web è stato pubblicato e verificato su `www.sherlockpolizze.it`; il bundle Android è stato caricato nella Play Console e attende la revisione di Google.

## Tranche IVASS/AAS

Revisione contenutistica prioritaria completata il 14 luglio 2026: fonti ufficiali verificate, guide e mockup corretti, storia del fondatore resa non assoluta e suite anti-regressione ampliata a 21 controlli legali. Questa tranche non costituisce una certificazione legale dell'intero sito.

## Classificazione acquisti

Implementata la classificazione persistente `reale/test/rimborsato/incompleto/amministratore`. PayPal usa l'ambiente server; Google Play usa `purchaseType`; le migrazioni admin sono separate. Dashboard, ricavi e side effect commerciali considerano solo gli acquisti reali, mentre i record legacy restano entitlement validi ma sono classificati come test nelle viste.

## Hardening del perimetro HTTP

Implementati header difensivi e CSP, rate limit delle API AI/pagamenti con identità anonimizzate e verifica base64/dimensione/magic-byte degli upload. In produzione il rate limit blocca in assenza di KV invece di lasciare senza protezione le API costose.

## Sicurezza dei prompt AI

I contenuti caricati e il testo del sinistro sono marcati come dati non attendibili e separati dalle istruzioni di sistema. Il testo libero è limitato e serializzato. La generazione lettere accetta solo tipologie note, forza uno schema strutturato, valida l'output e restituisce una bozza con avvertenze senza consumare il codice in caso di risposta AI invalida. Il rischio intrinseco del modello resta esplicitamente residuo.

## Remediation Google Play

Importato e sanificato il progetto Android v4.6.6. Preparata v4.6.7/versionCode 65 con dominio canonico, navigazione e tasto Indietro recuperabili, bridge/file chooser con esiti espliciti, controlli PWA accessibili e polish visivo. AAB firmato generato localmente e inviato nel canale di produzione Google Play; la release 65 risulta **In revisione**. I test browser web sono verdi in quattro viewport; restano il Pre-launch report e le prove Play Billing/dispositivo della Console.
