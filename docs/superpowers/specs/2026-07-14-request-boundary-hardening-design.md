# Request Boundary Hardening Design

Data: 14 luglio 2026  
Stato: approvato per delega decisionale dell'utente

## Obiettivo

Proteggere il confine HTTP dell'applicazione con header di sicurezza, rate limiting server-side e verifica dei contenuti caricati, senza modificare gli entitlement o conservare documenti.

## Approcci valutati

1. **Controlli condivisi applicativi (scelto):** middleware per header, modulo rate-limit con KV/fallback e validatore magic-byte riusabile. È testabile localmente e indipendente dal solo hosting.
2. Solo configurazione Vercel/WAF: efficace in produzione ma non verificabile end-to-end nel repository e non copre la semantica degli upload.
3. Controlli duplicati in ogni endpoint: rapido inizialmente, ma diverge facilmente.

## Perimetro

- Header globali: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-Frame-Options` e CSP compatibile con gli asset/servizi correnti.
- Rate limit per IP anonimizzato e rotta sulle API AI (`analizza`, `compara`, `lettera`) e sui flussi di pagamento sensibili. Risposta `429` con `Retry-After`; nessun IP in chiaro persistito.
- Limiti distinti e configurabili via env, con default prudenti. KV usa finestre atomiche; fallback memoria è soltanto sviluppo/test.
- Validazione base64 decodificabile, dimensione reale e magic-byte per PDF, JPEG, PNG e WebP. MIME dichiarato e firma devono concordare.
- Errori pubblici a codici stabili, senza propagare payload del provider.

## Architettura

`src/lib/security-headers.ts` applica una policy unica alle risposte nel middleware. `src/lib/rate-limit.ts` espone una funzione pura di decisione e un adapter KV. `src/lib/upload-validation.ts` decodifica in modo limitato e riconosce le firme. Gli endpoint chiamano guardie sottili prima dei provider esterni.

Il rate limit non è un controllo contabile perfetto: serve a contenere abusi. In assenza di KV in produzione la guardia deve fallire in modo sicuro per le API AI, mentre in sviluppo usa il fallback esplicitamente segnalato.

## Compatibilità CSP

La policy parte in modalità applicata ma consente le origini già necessarie per Google Analytics/Ads, Firebase, PayPal, font e immagini configurate nel progetto. Vietati `object-src`, framing esterno e `base-uri` arbitrario. Eventuali script inline esistenti sono censiti prima di rimuovere `unsafe-inline`; questa tranche non introduce nonce.

## Test

- unit test header obbligatori e preservazione degli header esistenti;
- rate limit sotto/sopra soglia, finestre, anonimizzazione e `Retry-After`;
- firme valide e mismatch MIME/firma, base64 invalido, file vuoto e troppo grande;
- test endpoint che dimostrano il blocco prima della chiamata Anthropic/PayPal;
- suite completa, Astro check, build e diff check.

## Fuori ambito

- mitigazione semantica della prompt injection e schema AI;
- cancellazione self-service, esportazione e retention automatica;
- antivirus esterno, OCR e deduplicazione persistente;
- configurazione WAF/dashboard Vercel e deploy.

## Criteri di accettazione

- Tutte le risposte applicative includono gli header concordati.
- Le API protette restituiscono `429` prima di consumare servizi esterni.
- Un file con MIME falso o firma non supportata non raggiunge Anthropic.
- Nessun documento o IP in chiaro viene aggiunto allo storage.
