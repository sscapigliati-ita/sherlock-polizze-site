# IVASS and AAS Content Hardening Design

## Obiettivo

Correggere i contenuti pubblici più rischiosi su reclamo alla compagnia, reclamo/segnalazione a IVASS e ricorso all'Arbitro Assicurativo, usando fonti istituzionali aggiornate e mantenendo separati fatti, interpretazioni e racconto personale.

## Fonti normative e istituzionali

- IVASS, pagina Reclami: prima istanza all'impresa e risposta entro 45 giorni; successivamente è possibile rivolgersi a IVASS.
- IVASS, pagina Arbitro Assicurativo, aggiornata al 15 gennaio 2026: ricorso operativo da tale data, online, costo 20 euro, reclamo preventivo per le stesse ragioni, decisione entro 180 giorni prorogabili di 90, procedimento documentale.
- D.M. 6 novembre 2024 n. 215 su Normattiva: disciplina dell'Arbitro Assicurativo.

## Perimetro

Correggere prioritariamente:

- `public/store-mockups.html`;
- `src/content/guide/esposto-ivass-modello.md`;
- `src/content/guide/compagnia-non-risponde-reclamo.md`;
- `src/content/guide/risarcimento-auto-negato.md`;
- `src/content/guide/sinistro-respinto-cosa-fare.md`;
- `src/content/guide/ricorso-aas-arbitro-assicurativo-come-vincere.md`;
- `src/pages/storia-sherlock.astro`.

## Regole editoriali

- Usare 45 giorni soltanto per la risposta dell'impresa/intermediario al reclamo, salvo discipline specifiche esplicitamente verificate.
- Non attribuire a IVASS un termine generale per istruire o decidere il reclamo e non presentarlo come decisore della controversia individuale.
- Indicare che l'AAS accetta ricorsi dal 15 gennaio 2026, non che fosse operativo nel 2024.
- Indicare costo, modalità, reclamo preventivo e tempi AAS secondo la pagina IVASS.
- Non pubblicare limiti economici, esclusioni di materia o condizioni di ammissibilità non verificati nel contesto specifico; rimandare ai requisiti applicabili e al portale ufficiale.
- Rimuovere percentuali di successo, “quasi sempre”, “stragrande maggioranza”, “avrei vinto” e altre conclusioni causali prive di base documentata.
- Nel caso del fondatore distinguere citazioni/risultati documentati dalle opinioni personali, senza trasformare un rigetto in vittoria o promessa commerciale.

## Test

Estendere i test statici per bloccare: AAS “operativo da fine/novembre 2024”; limiti AAS di 150.000 euro; risposta al reclamo indicata generalmente in 60 giorni; termine generale IVASS di 45 giorni; “decisione IVASS”; percentuali di successo specifiche individuate; formula “avrei vinto, non c'è dubbio”.

I test devono fallire sui contenuti esistenti prima delle correzioni e tornare verdi dopo modifiche contestuali. Test, contenuti e audit saranno committati in gruppi piccoli.

## Criteri di uscita

- Nessuno dei pattern errati resta nei contenuti pubblici in perimetro.
- `npm test`, `npx astro check` e `npm run build` terminano con successo.
- `LEGAL_CONTENT_AUDIT.md`, `TEST_RESULTS.md` e stato implementativo riportano fonti, correzioni e residui.
- Restano esplicitamente aperte le verifiche professionali su diritto sostanziale, clausole e casi individuali non coperte dalle fonti istituzionali consultate.
