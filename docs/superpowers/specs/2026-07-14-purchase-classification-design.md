# Classificazione commerciale degli acquisti

Data: 14 luglio 2026  
Stato: approvato nel dialogo, in attesa di revisione del documento

## Obiettivo

Introdurre una classificazione persistente e prudenziale degli acquisti affinché dashboard, ricavi, conversioni analytics e bonus referral non attribuiscano valore commerciale a transazioni di test, amministrative, rimborsate o incomplete.

## Decisioni approvate

- Ogni acquisto ha uno stato commerciale esplicito: `reale`, `test`, `rimborsato`, `incompleto` oppure `amministratore`.
- Solo `reale` contribuisce a ricavi, conteggi di vendita, conversioni `purchase` e bonus referral.
- I record storici privi di classificazione sono trattati come `test`; non vengono mai promossi implicitamente a `reale`.
- PayPal sandbox e acquisti Google Play identificati come test sono `test`.
- Le licenze create tramite strumenti amministrativi sono `amministratore`.
- Un pagamento iniziato ma non completato è `incompleto`.
- Un pagamento completato e successivamente rimborsato è `rimborsato`.
- Un pagamento di produzione, verificato e completato, è `reale`.
- Una riclassificazione conserva origine, data e motivo della transizione.

## Modello dati

`RecordPro` riceve metadati commerciali persistenti:

- `commercialStatus`: unione dei cinque stati;
- `commercialStatusUpdatedAt`: timestamp ISO dell'ultima classificazione;
- `commercialStatusReason`: codice tecnico non contenente dati personali;
- `paymentEnvironment`: `production`, `sandbox`, `test` o `unknown`;
- eventuale `refundedAt` quando noto.

La lettura passa da una funzione di normalizzazione unica. Se `commercialStatus` manca, la vista normalizzata restituisce `test` con motivo `legacy_unclassified`, senza modificare silenziosamente il dato persistito. Una migrazione esplicita e idempotente potrà materializzare la classificazione nei record storici.

`PayPalProcessingRecord` conserva lo stato commerciale fin dall'avvio: `incompleto` durante il processing, `test` per sandbox oppure `reale` soltanto dopo una cattura di produzione verificata. Errori e annullamenti restano `incompleto`. I record delle licenze ereditano lo stesso stato della transazione sorgente.

## Regole e transizioni

Le transizioni ammesse sono monotone rispetto alla certezza commerciale:

- `incompleto` → `reale` o `test` dopo verifica;
- `reale` → `rimborsato` dopo conferma del rimborso;
- `test` e `amministratore` non diventano automaticamente `reale`;
- `rimborsato` non torna automaticamente `reale`.

Qualunque correzione manuale futura dovrà passare da un'operazione amministrativa autenticata e registrare il motivo. Questa tranche non realizza un pannello di modifica manuale né una sincronizzazione webhook dei rimborsi: predispone modello e funzioni perché il rimborso verificato possa essere registrato in sicurezza.

## Flussi interessati

### PayPal

La configurazione server determina l'ambiente, senza fidarsi di dati inviati dal browser. Il record di processing nasce `incompleto`; dopo cattura valida riceve `test` in sandbox o `reale` in produzione. L'evento GA4 `purchase`, il contatore Founder e il referral vengono eseguiti solo per `reale`.

### Google Play

Il backend usa esclusivamente la risposta verificata di Google. Se la risposta espone un contesto di test, la licenza è `test`; altrimenti un acquisto completato e riconosciuto è `reale`. Stati pending o non acquistati non generano licenza commerciale né conversione.

### Amministrazione

`admin/migra-utente` crea record `amministratore`. Questi record possono mantenere il normale entitlement applicativo, ma sono esclusi da tutte le metriche commerciali.

### Dashboard e riepiloghi

La sintesi abbonati separa conteggi per stato e calcola ricavi esclusivamente dai record `reale`. L'interfaccia rende visibile la classificazione e presenta separatamente test, amministratore, incompleto e rimborsato. Nessun totale aggregato ambiguo viene etichettato come ricavo.

## Compatibilità e sicurezza

- Gli entitlement esistenti restano validi: la classificazione commerciale non revoca accessi.
- I record legacy restano leggibili e vengono esclusi prudenzialmente dalle metriche.
- La classificazione non usa email, pattern degli identificativi o euristiche lato client.
- I codici motivo sono enumerati e non includono payload del provider.
- Le scritture continuano a rispettare idempotenza PayPal e Google Play.

## Strategia di test

Lo sviluppo segue test-first. I test devono essere osservati in errore prima dell'implementazione e coprire:

1. normalizzazione legacy a `test`;
2. classificazione PayPal sandbox, produzione e processing incompleto;
3. classificazione Play test e produzione;
4. record amministrativi;
5. transizione da `reale` a `rimborsato` e rifiuto delle regressioni automatiche;
6. ricavi e conteggi limitati a `reale`;
7. mancata emissione GA4 `purchase`, mancato referral e mancato incremento Founder per stati non reali;
8. conservazione degli entitlement esistenti;
9. idempotenza delle letture e delle transizioni.

La verifica finale comprende suite Vitest completa, `astro check`, build Astro e `git diff --check`.

## Fuori ambito

- Webhook o polling automatico dei rimborsi PayPal/Google Play;
- riconciliazione contabile con estratti del provider;
- pannello amministrativo per riclassificazioni manuali;
- modifica dei prezzi o dei prodotti;
- deploy, push o migrazione dei dati di produzione.

## Criteri di accettazione

- Nessun record non classificato viene contato come reale.
- Solo una transazione di produzione verificata e completata produce metriche commerciali.
- Test, amministratore, rimborsato e incompleto sono visibili ma esclusi da ricavi, conversioni e referral.
- Gli account tecnici esistenti continuano a funzionare.
- Tutti i controlli finali passano senza nuovi errori.
