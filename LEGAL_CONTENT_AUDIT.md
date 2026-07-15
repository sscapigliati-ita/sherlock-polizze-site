# Legal Content Audit

Data: 14 luglio 2026.

## Perimetro

Ricerca eseguita su `src` e `public`, includendo pagine Astro, guide Markdown, componenti, layout, PWA, mockup store e prompt AI. I controlli automatici sono in `tests/content/legal-regressions.test.ts`.

## Correzioni recuperate da Claude e mantenute

- art. 1913 c.c.: rimosso il riferimento generale errato a otto giorni nei file recuperati;
- IVASS: eliminato il termine generale di 120 giorni nei contenuti recuperati;
- claim “precisione legale” e “riferimenti normativi corretti”: sostituiti con formulazioni prudenti;
- esempio lettera: chiarito che IVASS svolge vigilanza e non decide la controversia individuale.

## Correzioni Codex della Fase 1

- `public/app/index.html`: “Ricorso IVASS” sostituito con “bozza di esposto IVASS”; rimossa la promessa “Analisi AI in 30 secondi”; lettera “pronta da inviare” trasformata in bozza personalizzabile da verificare.
- `src/pages/esempio-report.astro`: termine generale corretto a tre giorni con salvezza della disciplina contrattuale/normativa; rimossa la conclusione automatica di nullità/vessatorietà.
- `src/content/guide/esposto-ivass-modello.md`: rimossa la frase che faceva apparire IVASS come decisore della controversia.
- homepage e pagina test: rimosse le promesse rigide “in 60 secondi”.

## Controlli automatici attivi

I test bloccano: otto giorni associati all'art. 1913; termine IVASS di 120 giorni; “ricorso IVASS”; “precisione legale”; “verdetto imparziale”; “riferimenti normativi corretti”; automatismi espliciti di vessatorietà/nullità; promesse temporali “in N secondi”; IVASS presentato come decisore; risultato/rimborso garantito; termine generale di otto giorni; lettere dichiarate pronte da inviare.

## Residui ad alta priorità

La ricerca ampia ha evidenziato contenuti ulteriori che richiedono revisione contestuale e, per le affermazioni normative aggiornate al 2026, verifica su fonti ufficiali prima della pubblicazione:

- `public/store-mockups.html`: terminologia “Reclamo IVASS”, promessa di generazione in 12 secondi e art. 1913 ancora indicato come otto giorni. È un asset pubblico di produzione e deve essere corretto nella successiva tranche.
- `src/content/guide/esposto-ivass-modello.md`: restano tempi fissi, percentuali di successo non documentate, “decisione IVASS” e affermazioni assolute sull'ammissibilità.
- `src/content/guide/risarcimento-auto-negato.md`, `sinistro-respinto-cosa-fare.md` e `compagnia-non-risponde-reclamo.md`: percentuali di successo, termini incoerenti e formulazioni eccessivamente certe.
- `src/content/guide/ricorso-aas-arbitro-assicurativo-come-vincere.md` e `src/pages/storia-sherlock.astro`: copy orientato alla “vittoria”, date/limiti AAS da verificare e conclusioni assolute sul caso del fondatore.
- `src/pages/api/lettera.ts`: prompt che assegna al modello il ruolo di avvocato e chiede minacce/qualificazioni normative; richiede una riprogettazione con schema e limiti, non una sostituzione testuale isolata.
- `public/app/index.html` e `src/pages/abbonati.astro`: persistono piani illimitati/lifetime e claim commerciali da trattare nell'audit monetizzazione.

## Criterio di prudenza

Le correzioni automatiche non certificano la correttezza giuridica. Ogni bozza resta da controllare prima dell'invio e il prodotto non sostituisce un professionista.

## Revisione IVASS/AAS del 14 luglio 2026

Completata la tranche sui contenuti pubblici prioritari. Sono stati corretti il termine di risposta ai reclami (45 giorni), l'avvio dell'AAS (15 gennaio 2026), il costo (20 euro), il termine ordinario (180 giorni con possibile proroga fino a 90), la natura documentale e le conseguenze dell'eventuale inadempimento. Rimossi soglie generalizzate, percentuali di successo non documentate, linguaggio di “vittoria” e qualificazioni della decisione come automaticamente vincolante o esecutiva.

File rivisti: mockup pubblico, guide su reclamo, esposto IVASS, diniego e mancata risposta, sinistro respinto, diffida, ricorso AAS, risarcimento auto e storia del fondatore. Riferimenti di verifica: pagine ufficiali IVASS “Reclami” e “Arbitro Assicurativo”, oltre al D.M. 215/2024.

I controlli automatici ora comprendono 21 regressioni legali e coprono anche data AAS, soglie generalizzate, termini IVASS, decisione IVASS, percentuali promozionali e affermazioni assolute nella storia personale.
