# Pending Tasks

Ultimo aggiornamento: 14 luglio 2026.

## Residui dopo la Fase 1

1. **Media — revisione giuridica residua.** La tranche prioritaria IVASS/AAS è completata e coperta da test. Il prompt lettera ora produce una bozza strutturata con avvertenze; resta la revisione professionale dell'intero corpus. I controlli automatici non equivalgono a una certificazione legale.
2. **Bassa — suggerimenti Astro/TypeScript.** Il checker è operativo e non segnala errori; restano 19 hint su API deprecate, import inutilizzati e script inline. Prossimo passo: pulizia separata senza modificare il comportamento.
3. **Completata — classificazione acquisti.** Implementati `test/reale/rimborsato/incompleto/amministratore` e filtri su ricavi/conversioni. Restano fuori ambito la sincronizzazione automatica dei rimborsi e la migrazione dei record di produzione.
4. **Alta — sicurezza applicativa residua.** Completati rate limit, CSP/security headers, verifica magic-byte e mitigazioni prompt injection/schema AI. Restano retention, cancellazione self-service, CSRF admin e redazione strutturata degli errori.
5. **Media — funnel canonico.** Uniformare gli eventi e aggiungere upload, triage, costi AI ed export mancanti.

## Fasi successive

- Stabilizzazione delle regressioni funzionali e copertura test.
- Triage gratuito e Pacchetto Sinistro con prezzi configurabili.
- Separazione persistente tra acquisti test, reali, rimborsati e incompleti.
- Upload multiplo, classificazione, deduplicazione e qualità documenti.
- Report strutturato e pipeline AI con schema, fonti e punti deboli.
- Pagamenti/attivazione, funnel analytics, privacy, sicurezza, UX e SEO.
