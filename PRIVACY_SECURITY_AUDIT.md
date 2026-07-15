# Privacy and Security Audit

Data audit: 15 luglio 2026.

## Controlli presenti

- segreti letti da variabili server-side; configurazione Firebase pubblica separata;
- consenso analytics predefinito negato e testato;
- idempotenza PayPal e Play Billing coperta da test;
- limite corpo/file e verifica base64, dimensione reale, MIME e magic-byte per PDF/JPEG/PNG/WebP;
- rate limit applicativo per API AI e pagamenti, con chiavi IP anonimizzate e KV atomico;
- CSP e header difensivi applicati dal middleware e dalla configurazione Vercel;
- output HTML Astro e funzioni di escaping nella PWA;
- documenti inviati direttamente al provider AI senza persistenza applicativa rilevata;
- KV usato per email/codici/acquisti; fallback in memoria limitato allo sviluppo;
- ambienti PayPal sandbox/live configurabili.
- istruzioni AI condivise trattano documenti e testo utente come dati non attendibili; il testo del sinistro è limitato e serializzato, mentre la lettera usa uno schema tool forzato e validato.

## Rischi alti

1. Cancellazione email/codice descritta come richiesta manuale; manca endpoint autenticato di cancellazione account/pratica ed esportazione.
2. Retention “fino a richiesta” per email/codice non ha scadenza automatica configurabile.

## Rischi medi

- messaggi errore provider troncati ma non classificati/redatti;
- timeout/retry non uniformi tra le tre API AI;
- nessun budget token/costo per pratica;
- configurazione Firebase/GA4 e documenti pubblici devono essere ricontrollati dopo ogni cambio provider;
- assenza di protezione CSRF esplicita sui POST basati su cookie/sessione amministrativa, da verificare con il modello auth effettivo.
- la CSP conserva `unsafe-inline` per compatibilità con gli script attuali; nonce/hashing resta un hardening successivo;
- magic-byte non equivale ad antivirus, OCR o verifica di leggibilità del documento.
- le mitigazioni di prompt injection riducono il rischio ma non possono garantire che un modello ignori sempre contenuto ostile; gli output restano da presentare come bozze da verificare.

## Coerenza privacy

Privacy e trasparenza dichiarano che i documenti non sono conservati dall'applicazione, coerente con il flusso base64 osservato. Dichiarano invece conservazione KV di email/codice fino a cancellazione e cancellazione manuale via supporto: coerente ma insufficiente rispetto all'obiettivo self-service. Nessuna dichiarazione deve promettere cancellazione automatica finché non è implementata.

## Azioni sicure successive

Il codice di attivazione è stato rimosso dai log. Rate limit, security headers, verifica contenuto upload e confini di fiducia/schema AI sono implementati e testati. Le azioni successive sono redazione strutturata degli errori, retention e protezione CSRF amministrativa. Implementare cancellazione/esportazione soltanto dopo aver definito autenticazione e proprietà dei record.
## Aggiornamento 15 luglio 2026 — superficie pubblica

- “Eventi anonimi” sostituito con “eventi pseudonimizzati” quando sono presenti identificatori persistenti.
- Rimossi tempi assoluti di distruzione e garanzie non verificabili estese ai fornitori.
- Chiarito che Sherlock non crea un archivio applicativo permanente dei documenti, mentre il contenuto viene trasmesso ai fornitori necessari.
- Chiarito che accesso, esportazione e cancellazione dei dati server richiedono una richiesta al supporto.
- Rinviati: retention automatica, cancellazione self-service, verifica contrattuale dei provider e revisione professionale dell'informativa.
