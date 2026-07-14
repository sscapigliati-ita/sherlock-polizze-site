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

