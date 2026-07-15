# Google Play Functionality Remediation Design

Data: 14 luglio 2026  
Target: Sherlock Polizze Android v4.6.7, versionCode 65  
Package: `it.sherlock.polizze`

## Obiettivo

Correggere la violazione Google Play relativa a icone o pulsanti che non restituiscono contenuti entro il 23 luglio 2026. La remediation copre sia il wrapper Android WebView sia la PWA incorporata, perché la versione pubblicata v4.6.6 contiene una copia statica dell'interfaccia distinta dal sito.

Il risultato atteso è un bundle AAB verificato e pronto per il caricamento manuale. Questa tranche non autorizza la pubblicazione in Google Play Console né un deploy web in produzione.

## Stato iniziale verificato

- Il sorgente Android è in `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project` e non è versionato.
- Il bundle pubblicato è `Sherlock-v4.6.6-vc64.aab`.
- L'app usa una WebView che carica `file:///android_asset/www/index.html`.
- Il bridge nativo espone API, link esterni, condivisione, vibrazione, analytics e Play Billing.
- Il backend Android punta ancora a un dominio Vercel provvisorio.
- La navigazione della PWA avviene soprattutto nello stesso documento; `WebView.canGoBack()` non rappresenta quindi tutte le schermate interne.
- Alcuni errori nativi sono ignorati o non restituiscono feedback all'utente.
- Il progetto contiene materiale di firma e fallback di password in Gradle che non deve essere importato nel repository.

## Strategia scelta

Usare una remediation coordinata, mantenendo l'architettura WebView attuale per ridurre il rischio. Non migrare ora a Trusted Web Activity e non limitarsi a correggere soltanto l'HTML.

La PWA web resta la fonte funzionale da allineare, ma l'asset Android mantiene adattamenti espliciti per bridge, Play Billing e modalità offline. Le differenze ammesse saranno documentate e testate.

## Confine di sicurezza e versionamento

Il progetto Android verrà copiato in una directory versionata del repository, senza output di build né credenziali. Saranno esclusi:

- keystore e password;
- `google-services.json` reale;
- service account JSON;
- AAB/APK e directory `build`/`.gradle`;
- token o configurazioni ambiente reali.

Gradle leggerà firma e segreti soltanto da variabili d'ambiente o proprietà locali ignorate. La password incorporata verrà rimossa. La rotazione della chiave/password, se necessaria, resterà un'attività manuale documentata perché coinvolge Google Play App Signing.

## Correzioni Android native

### Navigazione e tasto Indietro

Il bridge introdurrà un contratto con la PWA per sapere se esiste una schermata interna precedente. Il tasto Android Indietro chiederà prima alla PWA di gestire la navigazione interna; userà la cronologia WebView soltanto per vere navigazioni web; infine richiederà una seconda pressione o una conferma chiara prima di uscire dalla schermata principale.

### Link esterni

Gli URL saranno validati per schema. I link esterni verranno aperti con intent sicuro e produrranno un messaggio comprensibile se nessuna app può gestirli. I link interni ammessi non verranno inviati inutilmente al browser esterno. `mailto:` e pagine privacy/supporto avranno un fallback visibile.

### File chooser

Il selettore accetterà soltanto i MIME supportati, restituirà sempre la callback anche in caso di annullamento o errore e mostrerà feedback. Il ciclo di vita non lascerà callback pendenti. Permessi e fotocamera saranno richiesti soltanto quando realmente usati.

### Bridge e rete

Ogni operazione asincrona avrà esito esplicito: successo, errore classificato o timeout. Nessuna eccezione verrà ignorata quando impedisce un'azione dell'utente. Il backend canonico sarà `https://www.sherlockpolizze.it`. I messaggi non esporranno dettagli tecnici, URL sensibili o contenuto dei documenti.

### Play Billing e aggiornamenti

Acquisto, annullamento, attesa, prodotto non disponibile, verifica fallita e ripristino mostreranno stati distinti. I controlli non saranno lasciati in caricamento. Il flusso continuerà a distinguere test e reale lato server. Gli aggiornamenti in-app non potranno coprire permanentemente o bloccare l'interfaccia.

## Correzioni PWA e accessibilità

Verrà creato un inventario automatico e manuale degli elementi interattivi: pulsanti, link, icone, selettori, FAQ, upload, analisi, lettere, condivisione, paywall, attivazione, acquisto, recupero e assistenza.

Ogni controllo principale dovrà:

- avere testo visibile o nome accessibile;
- avere un target di almeno 48 × 48 CSS pixel quando usato come controllo touch principale;
- mostrare focus visibile;
- restituire feedback immediato;
- impedire doppi invii durante operazioni asincrone;
- riattivarsi dopo errore o timeout;
- mostrare uno stato disabilitato motivato;
- non essere coperto da overlay o decorazioni;
- consentire sempre recupero o ritorno.

Gli errori di rete, AI, file e pagamento useranno componenti coerenti con azione di retry controllata. Le schermate vuote mostreranno spiegazione e CTA pertinente. Il testo generato dinamicamente non userà HTML non fidato.

## Affinamento estetico controllato

La remediation include un polish visivo, non un redesign. Saranno mantenuti identità blu/oro, tipografia e struttura generale, migliorando:

- gerarchia della hero e chiarezza della CTA primaria;
- spaziatura e leggibilità di card documenti e risultati;
- stati premuto, focus, loading, successo ed errore;
- coerenza di icone, bordi, raggi e ombre;
- schermate vuote ed errori con illustrazione Sherlock e azione di recupero;
- transizioni brevi e non bloccanti, disattivate con `prefers-reduced-motion`;
- layout con viewport piccoli, landscape e testo ingrandito.

Nessun elemento puramente decorativo sembrerà cliccabile. Le animazioni non ritarderanno il feedback e non copriranno i controlli.

## Test

### Test web automatici

Playwright verrà aggiunto come dipendenza di sviluppo leggera e usato contro la PWA locale. La suite coprirà:

- mobile piccolo, Android medio, tablet e desktop;
- portrait e landscape;
- zoom/testo maggiorato;
- inventario dei controlli principali e nomi accessibili;
- target touch e focus;
- navigazione e ritorno;
- file valido, file non valido e annullamento;
- rete lenta/assente;
- errori API, AI e pagamento simulati;
- loading, timeout, retry e prevenzione doppio invio;
- assenza di schermate vuote e controlli coperti.

Gli screenshot prima/dopo saranno prodotti su casi rappresentativi e conservati come artefatti di audit, senza dati reali.

### Test Android

Si useranno test JVM/Robolectric o test strumentati compatibili con il progetto senza introdurre un framework applicativo nuovo. Saranno verificati almeno:

- decisione link interno/esterno;
- contratto del tasto Indietro;
- callback file chooser su successo, annullamento ed errore;
- mapping degli esiti Billing verso feedback JavaScript;
- timeout/errori del bridge;
- backend canonico e assenza del vecchio dominio.

Se un emulatore non è disponibile, il limite verrà dichiarato e saranno comunque prodotti build, test JVM, test browser e checklist manuale su dispositivo.

### Verifica bundle

La chiusura richiede:

1. test unitari e browser verdi;
2. build web e Android verdi;
3. AAB release versionCode 65 generato senza segreti nel repository;
4. ispezione del manifest e del contenuto bundle;
5. smoke test manuale su dispositivo o emulatore;
6. compilazione di `GOOGLE_PLAY_FUNCTIONALITY_REMEDIATION.md`.

La sola compilazione non costituisce prova di remediation.

## Documentazione e consegna

La tranche aggiornerà `CODEX_IMPLEMENTATION_STATUS.md`, `PENDING_TASKS.md`, `TEST_RESULTS.md`, `DECISIONS.md`, `.env.example`, le guide di deploy/rollback e creerà `GOOGLE_PLAY_FUNCTIONALITY_REMEDIATION.md`.

Il dossier Google Play conterrà inventario, difetti, correzioni, test, screenshot, rischi residui, comando per produrre il bundle e checklist/testo per la risposta in Console.

## Fuori ambito della tranche

- pubblicazione del bundle in Google Play Console;
- deploy web in produzione;
- migrazione a TWA;
- nuova monetizzazione per pratica, upload multiplo o report top di gamma, salvo correzioni minime necessarie a rendere i controlli esistenti funzionanti;
- uso di pagamenti, email o documenti reali.

Queste attività resteranno nelle fasi successive del programma generale.

## Criteri di accettazione

- Tutti i controlli principali inventariati hanno un esito verificabile e accessibile.
- Nessun flusso principale termina in schermata vuota o loading permanente.
- Tasto Indietro, link, file chooser, errori bridge e Play Billing hanno fallback espliciti.
- Il vecchio backend Vercel non compare nel codice destinato alla pubblicazione.
- Le credenziali di firma non sono presenti nel repository o in fallback Gradle.
- I test coprono viewport, rete, errori e interazioni segnalate dalla contestazione.
- Il polish visivo migliora l'interfaccia senza ridurre accessibilità o stabilità.
- Il bundle v4.6.7/versionCode 65 è generato e documentato, ma non pubblicato.
