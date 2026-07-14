# Privacy and Security Audit

Data audit: 14 luglio 2026.

## Controlli presenti

- segreti letti da variabili server-side; configurazione Firebase pubblica separata;
- consenso analytics predefinito negato e testato;
- idempotenza PayPal e Play Billing coperta da test;
- limite corpo/PDF e validazione minima del MIME nelle API di analisi/confronto;
- output HTML Astro e funzioni di escaping nella PWA;
- documenti inviati direttamente al provider AI senza persistenza applicativa rilevata;
- KV usato per email/codici/acquisti; fallback in memoria limitato allo sviluppo;
- ambienti PayPal sandbox/live configurabili.

## Rischi alti

1. Non è presente rate limiting applicativo verificabile per le API AI e pagamento.
2. Non sono rilevati CSP e security headers completi in `vercel.json`.
3. Upload singolo/base64: validazione basata sul MIME dichiarato; mancano magic-byte, PDF protetto/vuoto, scansione illeggibile, hash e deduplicazione.
4. Cancellazione email/codice descritta come richiesta manuale; manca endpoint autenticato di cancellazione account/pratica ed esportazione.
5. Prompt AI ricevono contenuto documento senza mitigazione esplicita della prompt injection.
6. Retention “fino a richiesta” per email/codice non ha scadenza automatica configurabile.

## Rischi medi

- messaggi errore provider troncati ma non classificati/redatti;
- timeout/retry non uniformi tra le tre API AI;
- nessun budget token/costo per pratica;
- configurazione Firebase/GA4 e documenti pubblici devono essere ricontrollati dopo ogni cambio provider;
- assenza di protezione CSRF esplicita sui POST basati su cookie/sessione amministrativa, da verificare con il modello auth effettivo.

## Coerenza privacy

Privacy e trasparenza dichiarano che i documenti non sono conservati dall'applicazione, coerente con il flusso base64 osservato. Dichiarano invece conservazione KV di email/codice fino a cancellazione e cancellazione manuale via supporto: coerente ma insufficiente rispetto all'obiettivo self-service. Nessuna dichiarazione deve promettere cancellazione automatica finché non è implementata.

## Azioni sicure successive

Il codice di attivazione è stato rimosso dal warning email ed è protetto dal test `security-regressions.test.ts`. Le azioni successive sono introdurre redazione strutturata, rate limit, security headers testati, verifica contenuto upload e schema AI server-side. Implementare cancellazione/esportazione soltanto dopo aver definito autenticazione e proprietà dei record.
