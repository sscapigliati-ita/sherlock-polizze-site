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
3. `npx astro check` (attualmente bloccato finché TypeScript non torna compatibile)
4. `npm run build`
5. controllare `git status` e il diff rispetto al commit da rilasciare;
6. verificare che nessun `.env`, token o dato reale sia tracciato.

## Configurazione minima

AI: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. Pagamenti: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE`. Email: `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`. Storage: variabili KV fornite dal provider. Analytics: variabili Firebase pubbliche, ID GA4 pubblici e secret Measurement Protocol server-side. Google Play e admin richiedono inoltre le variabili effettivamente lette dai moduli `play.ts` e `auth-admin.ts`, da configurare nel gestore segreti del provider.

## Smoke test post-build

Verificare homepage, PWA `/app/`, privacy, prezzi senza Founder, analisi con documento sintetico, errore senza chiave AI, checkout sandbox, ritorno pagamento, idempotenza, email test, consenso analytics, sitemap e 404. Non usare documenti o pagamenti reali.

