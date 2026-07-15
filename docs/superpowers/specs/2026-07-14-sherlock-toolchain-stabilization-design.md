# Sherlock Toolchain Stabilization Design

## Obiettivo

Ripristinare un controllo statico Astro/TypeScript funzionante senza aggiornare indiscriminatamente lo stack e senza alterare il comportamento dell'applicazione.

## Causa verificata

Il commit `6eacd60` ha introdotto contemporaneamente `@astrojs/check@0.9.9` e `typescript@^7.0.2`. Il package installato di `@astrojs/check` dichiara peer dependency `typescript: ^5.0.0 || ^6.0.0`; `npm ls` classifica quindi TypeScript 7.0.2 come invalido. `npx astro check` si interrompe in `@astrojs/language-server` leggendo `fileExists`, prima di produrre diagnostica del progetto. Test e build restano verdi, ma non sostituiscono il controllo statico.

## Soluzione scelta

Fissare TypeScript a `6.0.3`, ultima versione stabile della serie compatibile, mantenendo invariati Astro 6.4.6, `@astrojs/check` 0.9.9 e tutte le altre dipendenze. Rigenerare esclusivamente le sezioni necessarie del lockfile tramite npm.

La modifica deve essere prima verificata con `npm ls typescript @astrojs/check`, quindi con `npx astro check`. Eventuali diagnostiche emerse dopo il ripristino sono errori reali preesistenti ma finora nascosti dal crash del checker: saranno corrette con test o verifica mirata, in commit separato dalla modifica di dipendenza.

## Alternative escluse

- Aggiornare Astro 6 ad Astro 7 e l'intero ecosistema: rischio e perimetro eccessivi per una correzione di compatibilità.
- Rimuovere `@astrojs/check`: eliminerebbe il controllo anziché ripristinarlo.
- Forzare peer dependency o ignorare l'errore: lascerebbe una toolchain non supportata.

## Verifiche

1. `npm ls typescript @astrojs/check` senza `ELSPROBLEMS`.
2. `npx astro check` completa la diagnostica.
3. `npm test` mantiene tutti i test verdi.
4. `npm run build` genera l'output Vercel/PWA.
5. `git diff --check` e revisione del lockfile limitata alla toolchain TypeScript.

## Rollback

Se TypeScript 6.0.3 impedisce installazione, test o build, ripristinare selettivamente `package.json` e `package-lock.json` tramite revert del commit dedicato. Non modificare codice applicativo per compensare un'installazione incoerente.
