# Monetization Changes

Data: 15 luglio 2026.

## Premessa commerciale

Non risultano acquisti reali di clienti: le transazioni esistenti sono considerate test del proprietario finché il modello dati non permette una classificazione verificabile. Nessun conteggio attuale può essere usato come vendita, ricavo, conversione o prova sociale.

## Modifiche applicate

- Disattivata la pubblicazione del piano Founder lifetime sulla pagina prezzi.
- Rimossa la card Founder dalla PWA, inclusi “solo i primi 50 iscritti” e il badge “Consigliato”.
- Conservate le licenze Founder e la verifica tecnica lato backend per non interrompere gli account di test esistenti.
- Rimosse le promesse pubbliche di “analisi illimitate”; i testi ora descrivono accesso nel periodo del piano senza promettere consumo AI senza limiti.
- “Lettera pronta” è stata trasformata in “bozza personalizzabile da verificare”.
- Aggiunti test anti-regressione per scarsità basata sui primi iscritti e analisi AI illimitate.

## Offerta attualmente implementata

Il repository contiene ancora piani mensile, semestrale, annuale e acquisto singolo, con PayPal e Google Play Billing. I prezzi sono duplicati tra UI e logica server: non sono ancora centralizzati in una configurazione unica. La struttura obiettivo a 9,90 € / 19,90 € non viene sovrapposta finché non sono definiti pratica, entitlement e controllo costi.

## Gap per acquisti test/reali

I record esistenti distinguono fonti come PayPal e Play, ma non espongono ancora uno stato commerciale completo con `environment`, `isTest`, `refunded`, `incomplete`, coupon/amministratore e riconciliazione. Pertanto dashboard e analytics non devono essere interpretati come ricavi reali.

## Classificazione commerciale implementata

Dal 14 luglio 2026 i nuovi record distinguono `reale`, `test`, `rimborsato`, `incompleto` e `amministratore`. I record storici non classificati sono letti prudenzialmente come `test`. Solo `reale` alimenta ricavi, conversioni, referral e contatore Founder; gli entitlement tecnici restano validi indipendentemente dalla classificazione. La sincronizzazione automatica dei rimborsi e la migrazione dei dati di produzione restano attività separate.

Prossima tranche:

1. definire schema transazione retrocompatibile;
2. classificare esplicitamente sandbox/test/amministratore;
3. escludere tali record da purchase, ricavi e conversioni;
4. centralizzare prodotti, prezzi, limiti e durata;
5. introdurre limiti di costo per prodotto prima di qualsiasi promessa di uso esteso.

## Dominio e marca

`astro.config.mjs`, sitemap, robots, canonical, JSON-LD, deep link Android e URL pubblici principali usano `https://www.sherlockpolizze.it`; il package Android è `it.sherlock.polizze`. Le occorrenze `vercel.app` trovate nei commenti/controlli host servono a escludere i preview dagli analytics e non devono essere sostituite.
## Aggiornamento 15 luglio 2026 — transizione pubblica

- I prodotti legacy non sono più commercializzati dalla navigazione o dalla homepage.
- `/abbonati`, `/abbonamento/*` e `/reclamo-singolo` restano tecnicamente compatibili ma sono `noindex` ed esclusi dalla sitemap.
- Non sono stati pubblicizzati né implementati i nuovi prezzi ipotizzati di 12,90 € e 24,90 €.
- Nuovi prodotti, checkout e migrazione entitlement restano rinviati a una specifica separata.
