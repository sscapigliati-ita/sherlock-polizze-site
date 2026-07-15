# Rollback Guide

## Principio

Usare rollback non distruttivi e conservare sempre i record di pagamento. Non eseguire reset hard, clean o migrazioni inverse distruttive.

## Applicazione

1. Identificare il deployment stabile precedente e il commit associato.
2. Bloccare nuovi deploy, non i webhook già in corso.
3. Creare un nuovo deployment dal commit stabile oppure applicare `git revert` dei commit difettosi su un branch dedicato.
4. Non cancellare record PayPal/Play/KV: servono a idempotenza e riconciliazione.
5. Ripetere smoke test su pagamento sandbox, attivazione, PWA e analytics.
6. Documentare incidente, intervallo temporale e transazioni da riconciliare.

Se il problema riguarda solo copy/contenuti, preferire un revert selettivo. Se riguarda credenziali, ruotarle nel provider e invalidare quelle compromesse prima del nuovo deploy.

## Riferimenti stabilizzazione pubblica — 15 luglio 2026

- Deployment stabile precedente: `dpl_6HgY1nrwNwG1Sy8wdHQKHvXzPwW2`.
- Candidato applicativo: `9f74b7198dccbfbb4fd1b8a13bbef9d93b7cf322`.
- In caso di regressione generale, promuovere nuovamente il deployment stabile precedente.
- In caso di errore limitato a un blocco, usare `git revert` selettivo dei commit della stabilizzazione su un nuovo ramo; non riscrivere la cronologia.
- Dopo il rollback verificare almeno `/`, `/app/`, `/privacy`, `/trasparenza`, `/esempio-report` e sitemap.
