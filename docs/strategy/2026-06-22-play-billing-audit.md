# Audit Play Billing — Sherlock

**Data**: 2026-06-22
**Trigger**: revisione strategia post-launch per evitare rischio sospensione Play Store.

## Domanda

ChatGPT suggerisce di migrare a **Google Play Billing** come priorità assoluta. È davvero priorità per Sherlock, o c'è margine di tempo?

## Flow attuale (verificato leggendo `index.html` + `/api/paypal/`)

1. App WebView → utente clicca "Sblocca Sherlock Pro" (`#btn-subscribe`, riga 495 di `index.html`).
2. App invoca `Br.url(PP)` → apre il **browser esterno** verso `https://sherlock-polizze-site-five.vercel.app/` (riga 1038).
3. Sul sito web l'utente sceglie piano (mensile/semestrale/annuale).
4. `POST /api/paypal/create-order` → PayPal Approve URL.
5. Checkout PayPal sul sito web (NON nell'app).
6. `/api/paypal/capture-order` → genera codice `SHK-XXXX-XXXX` + email Resend.
7. L'utente torna nell'app, inserisce l'email o il codice nel paywall → Pro attivato.

**Punto chiave**: nessun pagamento avviene mai dentro l'app o dentro la WebView. L'app fa solo "steering" — porta l'utente fuori, sul browser di sistema, dove paga sul sito.

## Inquadramento Play Policy

### Regola generale
Google Play Payments policy: per **digital goods/services consumati nell'app**, lo sviluppatore deve usare Google Play Billing. Sherlock vende "analisi illimitate + lettere" → digital goods consumati nell'app → in linea di principio policy si applica.

### Cosa fa la differenza per Sherlock
1. **Il pagamento è fuori dall'app**: la transazione PayPal avviene sul browser, non in WebView. Storicamente Google ha tollerato questo pattern come "out-of-app purchases", ma le policy 2023+ sono più restrittive — anche solo "linkare" da dentro l'app a un metodo di pagamento esterno era considerato anti-steering.
2. **Digital Markets Act (UE)**: dal marzo 2024 Google deve permettere agli sviluppatori di linkare a sistemi di pagamento esterni e di promuoverli, nei paesi UE/SEE. Quindi per utenti italiani/europei il pattern attuale è **probabilmente compliant** sotto DMA.
3. **User Choice Billing**: programma Google introdotto in selezionati mercati (Corea, India, prove EU). Permette di affiancare un sistema di pagamento proprio a Play Billing, pagando a Google una commissione ridotta (~11% invece di ~15-30%). Richiede iscrizione manuale al programma + due metodi di pagamento offerti.

### Esposizione per region (analisi dati Play Console di Stefano)

Dai dati Play Console Stefano ha installazioni da: Myanmar, Brasile, Messico, Francia, Germania, Italia, UK, Etiopia, Tunisia, Turchia.

| Region | Status | Note |
|--------|--------|------|
| Italia + altri EU/SEE | Probabile OK | DMA permette pagamenti esterni |
| UK | Borderline | UK fuori DMA; CMA UK indaga, ma policy Google UK simile a EU |
| Brasile / Messico / Turchia | Rischio medio | Google sta espandendo User Choice Billing; transizione in corso |
| US (assente da dati ma listing globale) | Rischio alto | Google US applica regola standard |
| Myanmar / Etiopia / Tunisia | Rischio basso ma irrilevante | Mercati minuscoli, basso interesse Google |

### Probabilità di azione Google nei prossimi 6 mesi

Mia stima:
- **Bassa-media** che Google sospenda l'app come prima azione.
- **Alta** che Google mandi una **notifica di compliance** entro 12 mesi con scadenza 30-60 gg per migrare.
- **Molto bassa** che ci sia preavviso zero.

Cioè: non è "domani mi sospendono" ma è "entro un anno devo essere migrato". Non priorità assoluta, ma priorità importante.

## Decisione raccomandata

### Fase A — adesso (gratis, 1 ora)

1. **Limita la distribuzione Play Store ai paesi UE + Italia** finché il pricing non è migrato.
   - Play Console → Production → Countries/regions → seleziona solo EU/SEE + Svizzera + UK.
   - Riduce esposizione policy + concentra il marketing dove conta (Italia).
   - I download "casuali" da Myanmar/Brasile finora non hanno generato conversioni: niente da perdere.

2. **Aggiungi disclaimer esplicito sulla policy nel sito** (`/abbonati`):
   > "Il pagamento avviene sul sito web di Sherlock, non all'interno dell'app, in conformità con il Digital Markets Act (Regolamento UE 2022/1925) che permette agli sviluppatori di offrire metodi di pagamento alternativi."
   - Protegge: documenta che la scelta è esplicita e DMA-based, non un workaround.

3. **Monitora Play Console** per email di compliance settimanalmente.

### Fase B — quando segnale (notifica Google o 6 mesi senza segnali)

Migrazione vera a Play Billing. Stima **5-10 giorni di dev**:

1. **App nativa**: aggiungere Google Play Billing Library v6+ in `MainActivity.java` o classe dedicata.
2. **Configurare prodotti** in Play Console (in-app products `pro_mensile`, `pro_semestrale`, `pro_annuale` come subscriptions o one-time).
3. **Bridge JS↔Java**: estendere `Android.callAPI` con `Android.purchasePlan(planId)` che apre il purchase flow nativo.
4. **Backend**: nuovo endpoint `/api/play/verify-purchase` che valida `purchaseToken` contro l'API Google Play Developer (richiede service account + Google Cloud project).
5. **Webhook** `/api/play/notification` per `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_CANCELED`, ecc.
6. **Affianca, non sostituisce**: tieni PayPal in parallelo per i paesi non-Play (web) e come fallback nei mercati EU dove DMA è la regola.

### Fase C — opzionale futuro

Iscrizione formale a **User Choice Billing** quando Google la estende stabilmente al mercato europeo. In quel caso il tuo pattern attuale (PayPal esterno) diventa pienamente conforme senza dover migrare.

## Costo del fare nulla

Se ignori sia Fase A che Fase B: 6-18 mesi finché Google manda warning, poi 30-60 gg per migrare → sospensione.

## Costo della migrazione completa subito

- 5-10 giorni dev.
- Perdita ~15% margine (commissione Play vs PayPal 3,4%+).
- Lock-in con Google ecosystem.
- Conversione potenzialmente migliore (one-tap purchase), ma utenti pagano in lingue/valute diverse e questo è un effetto a doppio taglio.

## Raccomandazione finale

**Esegui Fase A subito** (1 ora, zero rischio, zero costo).
**Pianifica Fase B** ma non eseguirla finché non vedi segnali, perché:
- Sherlock è in fase di validazione (cercando product/market fit, non scala).
- Bruciare 5-10 giorni in migrazione billing prima di sapere se il pricing/messaging funziona è prematuro.
- Il margine PayPal ti finanzia gli ads e gli esperimenti — Play Billing al 15% riduce questo margine.

Quando vedi:
- → Il margine pulito mensile supera i 500 €/mese, OR
- → Google manda warning compliance, OR
- → 6 mesi senza warning ma vuoi sicurezza,

apri il progetto Fase B usando il piano qui sopra.

## Fase A — checklist operativa

Faccio io solo (1) lato sito, tu fai (2)-(3):

- [ ] **(io, in questo branch)** Aggiungere disclaimer DMA su `/abbonati` e nella pagina di pagamento.
- [ ] **(tu, Play Console)** Limitare countries a EU/SEE + UK + Svizzera. Production → Countries/regions → unselezionare extra-EU.
- [ ] **(tu, calendario)** Reminder mensile "controlla Inbox dev@ per warning Google policy".

Nessuna delle tre azioni Fase A richiede modifica all'app stessa. Quindi la nuova `.aab` v3.6/vc46 può andare su Play Console subito, **senza aspettare nient'altro**.
