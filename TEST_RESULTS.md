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

