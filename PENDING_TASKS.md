# Pending Tasks

Ultimo aggiornamento: 14 luglio 2026.

## Residui dopo la Fase 1

1. **Alta — revisione giuridica contestuale estesa.** I pattern prioritari sono bloccati, ma guide e mockup contengono ancora percentuali di successo, tempi e copy AAS/IVASS da verificare su fonti ufficiali. Prossimo passo: correggere i file elencati in `LEGAL_CONTENT_AUDIT.md` con test mirati.
2. **Media — controllo Astro non eseguibile.** TypeScript 7.0.2 non soddisfa il peer range `^5.0.0 || ^6.0.0` di `@astrojs/check` 0.9.9. Prossimo passo: aggiungere un test/configurazione compatibile e valutare un downgrade puntuale a TypeScript 6, senza aggiornamento globale.
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
