# Analytics Events

Data audit: 14 luglio 2026.

## Implementazione rilevata

Il sito usa `window.sherlockTrack` con Consent Mode; la PWA usa un bridge Android quando disponibile. Gli eventi server-side passano da GA4 Measurement Protocol. I test verificano consenso, separazione stream web/Firebase, client ID e idempotenza purchase.

Eventi rilevati includono: `landing_view`, `landing_click`, `app_view`, `app_open`, `app_open_click`, `document_upload_started`, `analysis_completed`, `analysis_failed`, `preview_report_viewed`, `paywall_viewed`, `subscribe_plan_click`, `paypal_click`, `purchase_failed`, `pro_activated`, `letter_generated`, `share_click`, `test_polizza_completed` e referral.

## Mappatura sul funnel obiettivo

| Obiettivo | Stato attuale |
|---|---|
| landing/CTA | Parziale: presenti nomi legacy e per landing specifica |
| start analysis | Parziale: upload started, manca evento canonico unico |
| upload success/failure | Parziale: started presente; success è incorporato in analysis completed |
| triage | Assente come flusso distinto |
| preview/paywall | Presente con nomi legacy |
| checkout | Parziale: click/redirect presenti |
| purchase | Presente server-side nel flusso PayPal, con idempotenza testata |
| activation | Presente lato PWA; fallimento non uniformato |
| full analysis | Parziale: `analysis_completed/failed` |
| draft/report export | Draft presente come letter generated; export non rilevato |
| support/professional lead | Non rilevati |

## Vincoli dati

Non devono essere inviati nomi, email, codici fiscali, numeri polizza, testo dei documenti, dati sanitari o contenuto della controversia. Il sanitizzatore corrente accetta un insieme limitato di contesto GA4 e i test impediscono l'uso di hash email/order ID come client ID. Le stringhe errore troncate possono comunque contenere testo del provider: richiedono una redazione a codici prima dell'estensione del funnel.

## Gap prioritari

- nomenclatura non allineata all'elenco canonico richiesto;
- distinzione test/reale ora applicata nei flussi PayPal e Play: gli eventi commerciali sono emessi soltanto per acquisti `reale`; sandbox, license testing, legacy e amministrazione sono esclusi;
- assenza di costo AI per pratica, margine e canale normalizzato;
- eventi upload/classificazione/triage incompleti;
- la dashboard commerciale ora filtra i record reali, ma richiede ancora riconciliazione contabile con i provider.
