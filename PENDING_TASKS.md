# Pending Tasks

Ultimo aggiornamento: 14 luglio 2026.

## Residui dopo la Fase 1

1. **Alta — revisione giuridica contestuale estesa.** I pattern prioritari sono bloccati, ma guide e mockup contengono ancora percentuali di successo, tempi e copy AAS/IVASS da verificare su fonti ufficiali. Prossimo passo: correggere i file elencati in `LEGAL_CONTENT_AUDIT.md` con test mirati.
2. **Bassa — suggerimenti Astro/TypeScript.** Il checker è operativo e non segnala errori; restano 19 hint su API deprecate, import inutilizzati e script inline. Prossimo passo: pulizia separata senza modificare il comportamento.
3. **Alta — classificazione acquisti.** Implementare `test/reale/rimborsato/incompleto/amministratore` e filtrare ricavi/conversioni.
4. **Alta — sicurezza applicativa.** Rate limit, CSP/security headers, MIME reale, prompt injection, retention e cancellazione self-service restano da implementare.
5. **Media — funnel canonico.** Uniformare gli eventi e aggiungere upload, triage, costi AI ed export mancanti.

## Fasi successive

- Stabilizzazione delle regressioni funzionali e copertura test.
- Triage gratuito e Pacchetto Sinistro con prezzi configurabili.
- Separazione persistente tra acquisti test, reali, rimborsati e incompleti.
- Upload multiplo, classificazione, deduplicazione e qualità documenti.
- Report strutturato e pipeline AI con schema, fonti e punti deboli.
- Pagamenti/attivazione, funnel analytics, privacy, sicurezza, UX e SEO.
