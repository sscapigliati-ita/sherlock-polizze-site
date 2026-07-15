# Pending Tasks

Ultimo aggiornamento: 15 luglio 2026.

## Residui dopo la Fase 1

0. **Checkpoint deploy — non ancora pubblicato.** La stabilizzazione pubblica è implementata localmente; pubblicazione, smoke test e rollback attendono la verifica completa finale e il checkpoint umano previsto dalla specifica.

1. **Media — revisione giuridica residua.** La tranche prioritaria IVASS/AAS è completata e coperta da test. Il prompt lettera ora produce una bozza strutturata con avvertenze; resta la revisione professionale dell'intero corpus. I controlli automatici non equivalgono a una certificazione legale.
2. **Bassa — suggerimenti Astro/TypeScript.** Il checker è operativo e non segnala errori; restano 19 hint su API deprecate, import inutilizzati e script inline. Prossimo passo: pulizia separata senza modificare il comportamento.
3. **Completata — classificazione acquisti.** Implementati `test/reale/rimborsato/incompleto/amministratore` e filtri su ricavi/conversioni. Restano fuori ambito la sincronizzazione automatica dei rimborsi e la migrazione dei record di produzione.
4. **Alta — sicurezza applicativa residua.** Completati rate limit, CSP/security headers, verifica magic-byte e mitigazioni prompt injection/schema AI. Restano retention, cancellazione self-service, CSRF admin e redazione strutturata degli errori.
5. **Media — funnel canonico.** Uniformare gli eventi e aggiungere upload, triage, costi AI ed export mancanti.
6. **Media — aggiornamento dipendenze major.** `npm audit --omit=dev` segnala 3 vulnerabilità high nella catena `@astrojs/vercel`/`@vercel/routing-utils` e 2 low legate a esbuild/Astro. La correzione proposta richiede Astro 7 e adapter Vercel 11: va trattata come migrazione separata con test completi, non applicata forzatamente alla release urgente vc65.

## Fasi successive

- **Urgente Google Play:** monitorare l'approvazione della release 65 già in revisione, eseguire Pre-launch report e test Play Billing con account licenza, quindi inviare la risposta alla contestazione entro il 23 luglio 2026.
- Prova manuale su almeno un telefono fisico piccolo/medio e un tablet, con particolare attenzione a selettore file e tasto Indietro.
- Triage gratuito e Pacchetto Sinistro con prezzi configurabili.
- Separazione persistente tra acquisti test, reali, rimborsati e incompleti.
- Upload multiplo, classificazione, deduplicazione e qualità documenti.
- Report strutturato e pipeline AI con schema, fonti e punti deboli.
- Pagamenti/attivazione, funnel analytics, privacy, sicurezza, UX e SEO.
