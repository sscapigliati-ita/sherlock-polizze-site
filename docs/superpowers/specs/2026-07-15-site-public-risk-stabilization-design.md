# Sherlock Site Public Risk Stabilization Design

Data: 15 luglio 2026.

## Obiettivo

Rendere prudente, coerente e verificabile la superficie pubblica di Sherlock Polizze prima del restyling e della sostituzione del modello commerciale. La tranche corregge rischi giuridici, prove sociali non dimostrate, promesse commerciali legacy, incongruenze privacy e riferimenti pubblici al dominio provvisorio, preservando gli acquisti e gli entitlement esistenti.

## Perimetro

La tranche comprende homepage, componenti condivisi, pagine commerciali, web app pubblica, esempi, guide, metadati SEO, sitemap, robots, privacy, trasparenza, analytics visibili, API e prompt solo quando espongono testi pubblici o contraddicono le dichiarazioni pubbliche.

Sono esclusi: progetto `android/`, nuovi AAB/APK, Play Console, store listing e contestazione Google Play. Le modifiche a `public/app/index.html` sono ammesse esclusivamente perché la stessa risorsa è una web app pubblica; non verrà sincronizzata né auditata la copia Android in questa tranche.

## Stato iniziale verificato

- Branch sorgente pulito: `codex/complete-sherlock-commercial-hardening`, commit `535dad7`.
- Baseline: 112/112 test, Astro check con 0 errori e 19 hint, build Astro riuscita.
- Le protezioni esistenti su classificazione acquisti, upload, rate limit, header e prompt injection restano valide.
- Il test legale attuale non copre adeguatamente `public/app/index.html`: la web app contiene ancora l'interpretazione errata dell'art. 1892 c.c. come termine generale di tre mesi dal sinistro.
- Homepage e pagine pubbliche espongono ancora prove sociali non verificabili, “esempio reale”, vecchi prezzi e inviti all'offerta legacy.
- Le pagine commerciali legacy sono ancora indicizzabili e raggiungibili dalla proposta principale.

## Approccio scelto

Usare una bonifica pubblica controllata, separata dal restyling e dalla nuova architettura commerciale. Un semplice search-and-replace lascerebbe contraddizioni; un rifacimento totale mescolerebbe rischi legali e regressioni di prodotto. La tranche interviene quindi sui confini pubblici, aggiunge controlli automatici e mantiene i flussi tecnici legacy dietro configurazione.

## Architettura

### Configurazione offerta pubblica

Creare `src/config/public-offer.ts` come fonte unica per:

- stato pubblico dei prodotti legacy;
- destinazioni CTA temporanee;
- elenco delle route commerciali da escludere dall'indicizzazione;
- etichette pubbliche consentite durante la transizione.

La configurazione non rimuove tipi, verifiche o record legacy. Le API continuano a riconoscere acquisti già esistenti, ma nessun componente pubblico deve commercializzarli quando il flag è disattivato.

### SEO e indicizzazione

Estendere `BaseLayout.astro` con un input esplicito `noindex`. Le route legacy useranno `noindex, nofollow`, non saranno collegate da header/footer/homepage e saranno escluse dalla sitemap mediante la configurazione Astro. Le pagine di ritorno pagamento restano accessibili e non vengono eliminate.

Le guide non correggibili con sufficiente affidabilità saranno marcate `noindex` ed escluse dall'indice guide fino alla revisione editoriale. Canonical, Open Graph, sitemap e link pubblici useranno `https://www.sherlockpolizze.it`.

I controlli tecnici che riconoscono `*.vercel.app` come preview sono leciti; URL provvisori esposti come destinazioni pubbliche non lo sono.

### Regole giuridiche

- Art. 1892 c.c.: riguarda dichiarazioni inesatte e reticenze con dolo o colpa grave. Il termine normativo concerne l'esercizio delle facoltà dell'assicuratore dopo la conoscenza dell'inesattezza o reticenza rilevante, non un termine generale dal sinistro per ogni contestazione.
- Art. 1913 c.c.: comunicazione in via generale entro tre giorni dall'evento o dalla conoscenza, salvo disciplina contrattuale o normativa diversa; nessuna decadenza automatica.
- Clausole: descrivere delimitazione della copertura, del rischio, esclusione o limitazione senza dichiarare automaticamente vessatorietà, nullità o inefficacia.
- Percorsi: distinguere reclamo alla compagnia, esposto/segnalazione IVASS, ricorso AAS, mediazione e giudizio.
- AAS: operativo dal 15 gennaio 2026; contributo di 20 euro rimborsato in caso di accoglimento; requisiti e termini devono rinviare alle fonti ufficiali vigenti.
- Ogni bozza deve essere dichiarata personalizzabile e da verificare prima dell'uso.

### Prove sociali e dimostrazioni

Rimuovere dalla homepage e dai metadati pubblici:

- valutazioni e recensioni dichiarate verificate senza fonte tecnica;
- somme recuperate o evitate non documentate;
- contatori clienti, vendite o conversioni;
- scarsità artificiale, disponibilità residue e badge “più scelto”;
- testimonianze non attribuite a una fonte verificabile.

Usare “simulazione dimostrativa” per report, lettere ed esempi non provenienti da un cliente reale. La simulazione deve mostrare metodo, documenti mancanti, incertezze, elementi favorevoli a entrambe le parti e limiti; non deve simulare una vittoria.

### Offerta legacy

Le route `/abbonati`, `/abbonamento/*`, `/reclamo-singolo` e le relative CTA non faranno parte della proposta pubblica. Saranno `noindex`, escluse dalla navigazione e dalla sitemap. Le pagine di conferma, gli endpoint PayPal/Play, i codici amministrativi e gli entitlement restano operativi per retrocompatibilità.

Durante la transizione le CTA principali punteranno a `/app/` per il caricamento/triage e a `/esempio-report` per la simulazione dimostrativa. Nessuna CTA prometterà i prezzi 12,90 euro o 24,90 euro finché i relativi prodotti non saranno implementati nella tranche monetizzazione.

## Privacy e sicurezza pubblica

Confrontare privacy e trasparenza con il codice effettivo per GA4/Firebase, Anthropic, Vercel, PayPal, Resend, KV e log. Usare “pseudonimizzato” per identificatori persistenti o IP trattati tramite hashing; non promettere anonimato o assenza di copie presso tutti i fornitori senza garanzia tecnica.

La tranche aggiorna le dichiarazioni e documenta i gap. Retention automatica, cancellazione self-service, esportazione dati e CSRF admin richiedono una specifica applicativa separata perché coinvolgono proprietà dei record e autenticazione.

## Gestione errori e configurazione

Una variabile o servizio mancante deve disabilitare elegantemente la funzione interessata, senza offerte fittizie, acquisti impliciti o messaggi di successo. I messaggi pubblici useranno codici e spiegazioni stabili, senza dettagli provider o dati personali.

## Test

Estendere i test statici affinché scandiscano tutte le superfici pubbliche, inclusa la PWA, per impedire:

- termine generale di tre mesi dal sinistro attribuito all'art. 1892;
- otto giorni attribuiti all'art. 1913;
- “ricorso IVASS”, IVASS decisore o termine generale di 120 giorni;
- qualificazioni automatiche di vessatorietà/nullità/inefficacia;
- “rimborso garantito”, “precisione legale”, “riferimenti sempre corretti” e lettera pronta senza avvertenza;
- prove sociali, somme recuperate, scarsità e “esempio reale” non verificabili;
- vecchi prezzi e piani nella navigazione o proposta principale;
- URL pubblici provvisori o canonical diversi dal dominio ufficiale.

Aggiungere test di route/configurazione per `noindex`, sitemap e conservazione tecnica dei prodotti legacy. Dopo ciascun blocco eseguire test mirati; prima della chiusura eseguire `npm test`, `npx astro check`, `npm run build`, `npm run test:e2e`, `git diff --check` e verifica dello stato Git.

## Documentazione prodotta

Creare o aggiornare almeno:

- `SITE_PUBLIC_AUDIT.md` con area, problema, gravità, impatto, correzione, file e stato;
- `PUBLIC_LEGAL_CONTENT_AUDIT.md` con inventario delle formulazioni e fonti;
- `PRIVACY_SECURITY_AUDIT.md` con comportamento osservato e residui;
- `SEO_AUDIT.md` con route indicizzate, sospese e canonical;
- `MONETIZATION_CHANGES.md`, `CODEX_IMPLEMENTATION_STATUS.md`, `PENDING_TASKS.md`, `TEST_RESULTS.md`, `DECISIONS.md`;
- `MANUAL_ACTIONS_REQUIRED.md` contenente soltanto azioni esterne indispensabili.

## Criteri di accettazione

La Fase 1 è completa quando:

- le regressioni legali elencate sono assenti da tutte le superfici pubbliche e coperte da test;
- prove sociali e risultati economici non verificabili sono rimossi;
- esempi non reali sono dichiarati simulazioni;
- offerta legacy non compare nella navigazione, homepage o sitemap ed è `noindex`;
- acquisti ed entitlement preesistenti restano tecnicamente compatibili;
- privacy e trasparenza non contraddicono i flussi osservati;
- il dominio ufficiale è unico nelle destinazioni pubbliche;
- audit e registri sono aggiornati;
- test, controllo statico, build ed E2E sono verdi;
- nessun file Android o attività Play Console è stato modificato.

## Rischi residui dichiarati

La revisione automatica non equivale ad approvazione professionale legale. La revisione editoriale completa delle guide, il nuovo design system, il triage, i nuovi prodotti, upload multiplo, report professionale, nuova pipeline AI, checkout automatico, retention/cancellazione e dashboard funnel appartengono a specifiche successive e non vengono anticipati in questa tranche.
