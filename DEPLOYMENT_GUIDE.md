# Deployment Guide

Questa guida prepara un deploy; non autorizza né esegue un rilascio.

## Prerequisiti

- Node.js >=22.12 e dipendenze da `package-lock.json`.
- Progetto Vercel collegato al dominio `www.sherlockpolizze.it`.
- Variabili necessarie definite dalla `.env.example`, impostate per ambiente e mai committate.
- PayPal `sandbox` per collaudo; passaggio a `live` soltanto con approvazione manuale.
- Redis/KV obbligatorio per persistenza affidabile dei codici e idempotenza in produzione.

## Verifiche prima del deploy

1. `npm ci`
2. `npm test`
3. `npx astro check` (deve terminare con 0 errori; gli hint non bloccanti vanno registrati)
4. `npm run build`
5. controllare `git status` e il diff rispetto al commit da rilasciare;
6. verificare che nessun `.env`, token o dato reale sia tracciato.

## Configurazione minima

AI: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. Pagamenti: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE`. Email: `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`. Storage: variabili KV fornite dal provider. Analytics: variabili Firebase pubbliche, ID GA4 pubblici e secret Measurement Protocol server-side. Google Play e admin richiedono inoltre le variabili effettivamente lette dai moduli `play.ts` e `auth-admin.ts`, da configurare nel gestore segreti del provider.

## Candidato stabilizzazione pubblica — 15 luglio 2026

- Commit applicativo candidato: `9f74b7198dccbfbb4fd1b8a13bbef9d93b7cf322`.
- Deployment stabile precedente: `dpl_6HgY1nrwNwG1Sy8wdHQKHvXzPwW2`.
- Non pubblicare automaticamente: la specifica richiede un checkpoint umano.

## Smoke test post-build

Verificare `/`, `/app/`, `/privacy`, `/trasparenza` e `/esempio-report`. Controllare `noindex,nofollow` su `/abbonati`, `/abbonamento/mensile` e `/reclamo-singolo`; confermare che tali route non compaiano in sitemap. Non usare documenti o pagamenti reali.
