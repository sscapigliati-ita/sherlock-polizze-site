# Test Results

Data baseline: 14 luglio 2026.

## Ambiente

- Node.js: `v22.19.0`
- npm: `11.6.0`
- Astro: `6.4.6`
- Vitest installato: `3.2.6`
- Sistema: Windows, esecuzione locale Codex.

## `npm test`

Esito: **fallito per regressioni di contenuto preesistenti al lavoro Codex**.

- File test: 5 superati, 1 fallito.
- Test: 59 superati, 3 falliti, 62 totali.
- Failure 1: due occorrenze di “Ricorso IVASS” in `public/app/index.html`.
- Failure 2: quattro promesse temporali in homepage, test polizza e PWA.
- Failure 3: frase “prima di decidere” riferita a IVASS nella guida all'esposto.

Il primo tentativo nel sandbox era stato bloccato da `spawn EPERM`; la stessa suite eseguita localmente ha prodotto i risultati sopra.

## `npx astro check`

Esito: **errore dello strumento prima della diagnostica del progetto**.

Errore: `Cannot read properties of undefined (reading 'fileExists')` in `@astrojs/language-server`. `npm ls` mostra TypeScript 7.0.2 come invalido rispetto al peer range `^5.0.0 || ^6.0.0` di `@astrojs/check` 0.9.9. La build separata dimostra che non è un errore di compilazione Astro, ma il controllo statico resta non disponibile finché la compatibilità non viene ripristinata.

## `npm run build`

Esito: **superato**.

Astro ha generato entrypoint server, route statiche, sitemap, service worker e output Vercel. Tempo server build riportato: 24,17 secondi. Nessun deploy è stato eseguito.

## Verifica finale Fase 1

Eseguita il 14 luglio 2026 dopo tutti i commit applicativi:

- `npm test`: **67/67 test superati**, 7/7 file test superati.
- `npm run build`: **superata**, output server Vercel, sitemap e PWA generati.
- `npx astro check`: **ancora bloccato** prima della diagnostica da `Cannot read properties of undefined (reading 'fileExists')`; resta confermata l'incompatibilità TypeScript 7.0.2 / `@astrojs/check` 0.9.9.
- Warning atteso nei test storage: KV non configurato, fallback in memoria per sviluppo.

## Stabilizzazione toolchain

- TypeScript fissato a `6.0.3`, compatibile con il peer range di `@astrojs/check@0.9.9`.
- `npm ls typescript @astrojs/check`: exit 0, nessuna dipendenza invalida.
- Prima diagnostica reale: 3 errori (tipo PWA virtuale mancante e fallback PayPal admin incompleto).
- Correzioni: riferimento tipi `vite-plugin-pwa/client` e proprietà opzionale `ultimoAggiornamento` nel fallback.
- Verifica finale: `npm test` 67/67; `npx astro check` 0 errori e 19 hint; `npm run build` superata; `git diff --check` superato.

## Tranche contenuti IVASS/AAS

- Test mirato iniziale: nuove regressioni introdotte e osservate in stato rosso sui contenuti preesistenti.
- Dopo le correzioni: `npm test -- --run tests/content/legal-regressions.test.ts` superato, **21/21 test**.
- Verifica completa della tranche: `npm test` **74/74**; `npx astro check` **0 errori, 19 hint non bloccanti**; `npm run build` superata; `git diff --check` superato.
