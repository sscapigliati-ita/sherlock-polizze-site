# Play Billing — Pass Pro a vita (Founder) in app

**Data**: 2026-06-30
**Autore**: Stefano Scapigliati (con Claude)
**Versione app target**: v4.3 / versionCode 53
**Stato**: design approvato, pronto per implementation plan

## Sommario esecutivo

Oggi l'app Sherlock Android (`it.sherlock.polizze`) gestisce il pagamento Pro così: tap su CTA → apre `/abbonati` nel browser → utente paga su PayPal → riceve codice via email → torna in app → incolla manualmente il codice. Questa frizione (apri browser, paga, aspetta mail, cerca codice, copia, incolla) collassa la conversione fra "click Pro" e "Pro attivo" praticamente a zero.

Questa spec definisce l'integrazione di **Google Play Billing v7** in app per il solo prodotto **Pass Pro a vita (Founder, 19,90€)**, eliminando la frizione: tap → dialog Play → biometria → Pro attivo in < 30 secondi, senza mai uscire dall'app.

I piani Pass Pro 1/6/12 mesi e Lettera Singola **non** vengono migrati in questa release (restano disponibili solo da browser su `/abbonati`). Decisione scope: pilota su un singolo prodotto non-consumable, massimo impatto / minimo rischio.

## Decisioni chiave (prese durante brainstorming)

| Decisione | Scelta | Motivo |
|---|---|---|
| Scope prodotti | Solo `founder_lifetime` | Pilota a basso rischio; in-app product non-consumable è il caso più semplice |
| Coesistenza con PayPal | PayPal continua a funzionare per gli utenti esistenti e su sito browser. App v4.3 mostra Play come metodo primario, codice manuale come fallback collapse | Zero attriti per utenti pre-esistenti; rispetto policy Google in app |
| Migrazione utenti già paganti | Continuano col codice attuale fino a scadenza; nessuna azione richiesta | Più semplice da costruire, zero impatto user |
| Strategia rilascio | Production 100% subito (preceduto da Internal Testing minimo) | Scelta utente; mitigato da test plan stringente prima del promote |
| Acknowledge | Lo fa il backend dopo verify | Best practice ufficiale Google; se backend giù → Play rimborsa entro 3gg = safety net |
| Verify server-side | Sempre, via Play Developer API + Service Account | Sicurezza: impossibile fingere un purchase token valido |
| Email al checkout | Opzionale, abilita rescue cross-device | Niente friction obbligatoria, ma chi la fornisce sblocca recovery |
| Codice virtuale `PLAY-*` | Generato server-side e salvato in Upstash come `RecordPro` con `fonte: 'play'` | Coerenza con sistema esistente (header `x-pro-code` continua a funzionare invariato per `/api/lettera`, `/api/compara`, ecc.) |

## Architettura

```
┌─────────────────────────┐       ┌──────────────────────┐       ┌────────────────────┐
│  App Android v4.3       │       │  Backend Vercel       │       │  Google Play       │
│  (WebView su SPA)       │◄────► │  (sherlock-site)      │◄────► │  Developer API     │
│                         │       │                       │       │                    │
│ • MainActivity.java     │       │ /api/play-billing/    │       │ • Verify           │
│   + BillingClient       │ purch.│   verify (POST)       │ token │   purchaseToken    │
│   + JsInterface bridge  │ token │                       │       │ • Acknowledge      │
│                         │──────►│ • Verifica token      │──────►│   purchase         │
│ • assets/www/index.html │       │ • Acknowledge         │       │                    │
│   nuovo blocco UI       │       │ • Emette codice PLAY- │       └────────────────────┘
│   "Pass Pro a vita"     │       │ • Salva in Upstash    │
│   chiama Android.startPurchase()│ • Restituisce codice  │       ┌────────────────────┐
│                         │◄──────│   Pro virtuale        │       │  Play Console      │
└─────────────────────────┘ codice└──────────────────────┘       │ (config one-time)  │
                                                                  │ • Prodotto         │
                                                                  │   founder_lifetime │
                                                                  │ • Service account  │
                                                                  │   per Developer API│
                                                                  └────────────────────┘
```

### Flusso utente (golden path)

1. Utente apre app v4.3, vede schermata paywall con un unico CTA prominente: **"Sblocca Pass Pro a vita · 19,90€"**
2. Tap → `Android.startPurchase("founder_lifetime")` chiamato via `JsInterface`
3. `MainActivity` apre dialog nativo Google Play con prezzo localizzato
4. Utente conferma con biometria/PIN Google → Play addebita, ritorna `purchaseToken`
5. `MainActivity` chiama `POST /api/play-billing/verify` con `{ purchaseToken, productId, optional_email }`
6. Backend verifica il token via Play Developer API (Service Account), fa `acknowledge`, genera codice virtuale (es. `PLAY-XXXXXXXX`), salva in Upstash come `piano: founder, fonte: play`, restituisce codice
7. `MainActivity` notifica WebView (`window.onProActivated(codice)`) → SPA salva codice in localStorage e setta `isPro=true`
8. UI Pro sbloccata immediatamente

### Flusso ripristino (cambio device / reinstall)

- Al `onResume`, `MainActivity` chiama `queryPurchasesAsync` di Play. Se trova `founder_lifetime` già acquistato dallo stesso Google account: re-invia il purchaseToken al backend (idempotente — se codice esiste, restituisce quello; altrimenti emette nuovo), bridge → WebView → Pro sbloccato.

## Lato Android (`sherlock_project/app/`)

### `build.gradle`

```gradle
dependencies {
    implementation 'com.android.billingclient:billing:7.1.1'
}
```

No Kotlin plugin — manteniamo Java per coerenza col codice esistente.

### `MainActivity.java` — modifiche localizzate

1. Nuovo campo `private BillingManager billing;`
2. In `onCreate`: `billing = new BillingManager(this, this::onPurchaseResult); billing.connect();`
3. In `onResume`: `billing.queryExistingPurchases();` per restore al boot
4. In `onDestroy`: `billing.disconnect();`
5. Bridge `SherlockBridge` esteso con 3 metodi `@JavascriptInterface`:
   - `startPurchase(String productId)` → invoca `billing.launchPurchase()` su UI thread
   - `startPurchase(String productId, String email)` → variante con email per rescue
   - `isPlayBillingAvailable()` → boolean per fallback UX
6. Callback `onPurchaseResult(PurchaseResult)`:
   - SUCCESS → POST a `BE_BASE/api/play-billing/verify`; se 200, esegui `webView.evaluateJavascript("window.onProActivated('" + codice + "')", null)`
   - USER_CANCELED → `evaluateJavascript("window.onPurchaseCancelled()")`
   - ERROR → `evaluateJavascript("window.onPurchaseError('" + reasonSlug + "')")`
   - PENDING → `evaluateJavascript("window.onPurchasePending()")`

### `BillingManager.java` (NUOVO, ~200 righe)

Classe isolata per non gonfiare `MainActivity`. Interfaccia pubblica:

```java
public class BillingManager implements PurchasesUpdatedListener {
    public interface ResultListener { void onResult(PurchaseResult r); }
    public BillingManager(Activity host, ResultListener listener);
    public void connect();
    public void disconnect();
    public boolean isReady();
    public void launchPurchase(Activity host, String productId);
    public void queryExistingPurchases();
}
```

Logica interna:
- Connessione con `enablePendingPurchases()` + retry exponential backoff
- `launchPurchase`: `queryProductDetailsAsync(INAPP)` per `founder_lifetime`, poi `launchBillingFlow`
- `onPurchasesUpdated`: filtra `PURCHASED && !isAcknowledged`, chiama listener
- **Acknowledge NON in app** — lo fa il backend dopo verify (safety net Play rimborsa entro 3gg)
- `queryExistingPurchases`: restore silenzioso da `onResume`, manda token a backend solo se utente non già Pro locale

### Eventi Firebase Analytics nativi (via `SherlockBridge.track`)

- `play_billing_dialog_opened` — quando `launchBillingFlow` chiamato
- `play_billing_cancelled` — user dismiss
- `play_billing_error` — con `reason` slug
- `play_billing_purchased` — dialog success, prima del verify
- `play_billing_verified` — dopo risposta 200 dal backend
- `play_billing_restored` — quando `queryExistingPurchases` trova acquisto pre-esistente

### `AndroidManifest.xml`

Niente da aggiungere — `com.android.vending.BILLING` merged automaticamente dalla libreria.

### Version bump

`versionCode 52 → 53`, `versionName 4.2 → 4.3`. `APP_BUILD` in `index.html` **non** lo tocchiamo (nessun cambio al free trial — coerente con convenzione esistente).

## Lato WebView (`assets/www/index.html`)

### Paywall ridisegnato (`#screen-paywall`)

Stato attuale (semplificato):
```
[Sblocca Sherlock Pro]
[ Pulsante che apre /abbonati nel browser ]
[ "Hai un codice? Inseriscilo qui" ]
```

Nuovo stato v4.3:
```
🏆 Pass Pro a vita
   Una tantum, accesso permanente. Numero limitato.

   [ Email (opzionale, per recuperare il Pro su altri device) ]

   [ Sblocca a 19,90€ ]    ← CTA oro, chiama Android.startPurchase('founder_lifetime', email?)

   ─── oppure ───

   Hai già un codice Pro? [Inseriscilo qui ▼]   ← collapse, flusso esistente invariato
```

**Importante (policy Google)**: rimuoviamo dal paywall qualunque link a `/abbonati` o ai piani mensile/semestrale/annuale. Restano disponibili solo da browser sul sito. L'app non li nomina né linka.

### Nuove funzioni globali esposte al bridge

```js
window.onProActivated = function(codice) {
  S.proCode = codice;
  S.isPro = true;
  localStorage.setItem('proCode', codice);
  track('play_billing_pro_activated', { codice_prefix: codice.slice(0,5) });
  toast('✅ Pass Pro attivato!', 'success');
  goHome();
};
window.onPurchaseCancelled = function() {
  track('play_billing_user_dismissed');
};
window.onPurchaseError = function(reasonSlug) {
  track('play_billing_error_ui', { reason: reasonSlug });
  toast("Pagamento non riuscito. Riprova o contatta supporto.", 'error');
};
window.onPurchasePending = function() {
  toast("Pagamento in attesa di approvazione. Riceverai conferma a breve.", 'info');
};
```

### Funzione `startPlayPurchase()` lato JS

```js
function startPlayPurchase() {
  if (typeof Android === 'undefined' || !Android.isPlayBillingAvailable || !Android.isPlayBillingAvailable()) {
    toast("Pagamento non disponibile. Aggiorna l'app o riprova più tardi.", 'error');
    track('play_billing_unavailable');
    return;
  }
  track('play_billing_initiated');
  const email = document.getElementById('founder-email')?.value?.trim() || '';
  if (email) Android.startPurchase('founder_lifetime', email);
  else Android.startPurchase('founder_lifetime');
}
```

Debounce 500ms incluso per gestire doppio tap.

### Eventi JS aggiuntivi

- `play_billing_ui_shown` — `#screen-paywall` aperto
- `play_billing_initiated` — tap CTA
- `play_billing_pro_activated` — Pro attivo (success path)
- `play_billing_unavailable` — fallback (per misurare device non compatibili)

### Cosa NON cambia in `index.html`

Sistema codici esistente (inserimento manuale codice), `Android.track`, `Android.share`, `i18n`, splash, schermate analisi/lettera/compara — tutto invariato.

## Lato Backend (`sherlock-site/`)

### Nuovo: `src/pages/api/play-billing/verify.ts`

Endpoint POST chiamato da `MainActivity` dopo dialog Play success.

**Input**:
```json
{ "purchaseToken": "...", "productId": "founder_lifetime", "email": "stefano@x.it" /* opzionale */ }
```

**Logica**:
1. Validate input (productId in whitelist `['founder_lifetime']`; purchaseToken non vuoto)
2. **Verify token** via Play Developer API: `GET /androidpublisher/v3/applications/it.sherlock.polizze/purchases/products/{productId}/tokens/{purchaseToken}` con bearer del Service Account
3. Check risposta: `purchaseState == 0` (PURCHASED), `consumptionState == 0` (non consumato)
4. **Idempotenza**: se `purchaseToken` già registrato in Upstash → restituisci codice esistente (caso restore/retry)
5. **Acknowledge** se `acknowledgementState == 0`: `POST .../tokens/{token}:acknowledge`
6. Genera codice virtuale `PLAY-` + 8 hex random
7. Salva `RecordPro` con `piano: 'founder'`, `fonte: 'play'`, `purchaseToken`, `email` (se fornita), `dataAcquisto` da `purchaseTimeMillis`, `dataScadenza: null` (lifetime)
8. Server-side GA4: `ga4TrackServer('play_billing_verified', purchaseToken.slice(0,8), { product, value: 19.90, currency: 'EUR' })`
9. Restituisci `{ codice, piano: 'founder', dataScadenza: null }`

**Errori espliciti** (status 400/409/502 con `error` slug):
- `INVALID_TOKEN` (Play API 410/404)
- `TOKEN_NOT_PURCHASED` (purchaseState ≠ 0)
- `ALREADY_REGISTERED_DIFFERENT_EMAIL` (token già usato da altra email)
- `PLAY_API_ERROR` (5xx upstream)

### Nuovo: `src/lib/play-billing.ts`

Wrapper sottile su Play Developer API. Riusa `accessToken()` già esportato da `src/lib/play.ts` aggiungendo scope `androidpublisher`:

```ts
export async function verifyInappPurchase(productId, purchaseToken): Promise<PlayPurchase | { errore }>
export async function acknowledgePurchase(productId, purchaseToken): Promise<boolean>
```

### Estensione `src/lib/storage.ts`

Tipo `RecordPro` esteso (campi opzionali, retrocompat):

```ts
type RecordPro = {
  codice: string;
  email: string | null;
  piano: PianoId;
  dataAcquisto: string;
  dataScadenza: string | null;          // null = lifetime
  // NUOVI campi opzionali:
  fonte?: 'paypal' | 'play';            // default 'paypal' per retrocompat
  purchaseToken?: string;               // solo se fonte=play
  playOrderId?: string;                 // dal purchase Play
};
```

Nuova funzione `cercaPerPurchaseToken(token)` per idempotenza.

### Storage layout Upstash

Indice secondario per lookup veloce:
- `play_token:{purchaseToken}` → `codice`

### Config / env vars

Già esistenti (da Play Reporting):
- `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`

Da aggiungere:
- `PLAY_PACKAGE_NAME=it.sherlock.polizze` (verificare se già presente come `pkg()` in `play.ts`)

**Azione Play Console (una tantum, utente)**: Service Account esistente deve avere il permission **"View financial data, orders, and cancellation survey responses"** sull'app Sherlock. Se oggi ha solo "View app information" (per Reporting), Play Developer API restituirà 403.

### Cosa NON cambia nel backend

- `/api/lettera`, `/api/analizza`, `/api/compara`: leggono `x-pro-code` invariato — codice `PLAY-*` equivalente a PayPal
- `/api/paypal/*`: continua a funzionare per il sito
- `/api/attiva-pro`: troverà anche codici `PLAY-*` se l'utente ha fornito email al checkout

### Sicurezza

- Nessuna autenticazione utente: il purchaseToken stesso è la prova (verificato server-side via Google)
- Rate limit: 10 req/min per IP

## Play Console setup (one-time, ~30 min)

### Configurazione preliminare

1. **Monetization setup**: verifica merchant account attivo, paese Italia/EU incluso
2. **Tax settings**: IVA UE (Google gestisce automaticamente se "Google as merchant" attivo)

### Creazione prodotto

3. Sherlock > **Products > In-app products** > Create
   - **Product ID**: `founder_lifetime` (case-sensitive, non rinominabile dopo)
   - **Name**: `Pass Pro a vita (Founder)`
   - **Description**: "accesso a tutte le funzioni Pro per sempre, una tantum"
   - **Pricing**: `19.90 EUR` per Italia
   - **Status**: Active

### Service Account

4. **Users and permissions** > SA esistente (Reporting API)
   - Aggiungi permission **"View financial data, orders, and cancellation survey responses"**
   - Attendi 5-10 min propagazione

### License testing

5. **Setup > License testing**
   - Aggiungi `stefano.scapigliati@gmail.com` + eventuali altri tester
   - Test response: `RESPOND_NORMALLY` (flusso realistico senza addebito reale)

## Sequenza operativa di rilascio

**Giorno 0 — Setup Play Console (utente)**
1. Punti 1-5 sopra
2. Conferma a Claude completati

**Giorno 1 — Backend (`sherlock-site/`)**
3. `src/lib/play-billing.ts` + `src/pages/api/play-billing/verify.ts` + estensione `storage.ts`
4. Deploy preview Vercel + test con curl simulato (mock purchaseToken: 410 INVALID_TOKEN atteso)
5. Merge → production
6. Check: backend pronto e inutilizzato

**Giorno 2 — App (`sherlock_project/`)**
7. `app/build.gradle`: aggiungo `billing:7.1.1`
8. `BillingManager.java` (nuovo)
9. `MainActivity.java` (bridge + lifecycle)
10. `assets/www/index.html` (paywall + funzioni globali)
11. Bump `versionCode 52→53`, `versionName 4.2→4.3`
12. Build `.aab` firmato

**Giorno 3 — Internal Testing track**
13. Upload `.aab` su **Internal testing** (NON production)
14. Aggiungo tester
15. 3 test reali (matrix sotto)
16. Verifica `/admin` (`fonte: 'play'`)
17. Verifica GA4 DebugView eventi

**Giorno 4 — Promote a Production**
18. Se test passano: promote release Internal → Production
19. Rollout 100% (scelta utente)
20. Monitor /admin + GA4 prime 24h

**Giorno 4+ — Post-rilascio**
21. Anomalie → halt rollout via Play Console (utenti non aggiornati restano su v4.2)
22. Verifica manuale primi 10 acquisti reali in KV

## Test plan

| # | Caso | Setup | Atteso | Come verifico |
|---|------|-------|--------|---------------|
| 1 | Happy path nuovo acquisto | Account tester, mai acquistato | Dialog → conferma → Pro attivo entro 5s, codice `PLAY-*` in `/admin` | UI + dashboard + DebugView |
| 2 | Restore dopo reinstall | Account che ha già comprato, disinstalla, reinstalla | All'apertura, senza intervento, Pro re-attivo entro 3s, niente dialog | UI + logcat (`play_billing_restored`) |
| 3 | Restore dopo clear data | Stesso, ma "Cancella dati" | Idem #2 | Idem |
| 4 | Dismiss dialog | Tap "Sblocca", back appena appare Play | `onPurchaseCancelled`, nessun toast, nessun side effect | Logcat + UI |
| 5 | Backend down durante verify | Acquisto vero, backend 500 forzato | Dialog success, toast errore + retry button, KV vuoto. Play **non** ack → entro 3gg Google rimborsa auto | Logcat + KV vuoto + email +72h |
| 6 | Retry dopo failure #5 | Stesso device, app riaperta dopo fix backend | `queryPurchasesAsync` su onResume rileva acquisto non-ack, re-verify OK, Pro attiva | Logcat + KV popolato |
| 7 | Bridge Android non disponibile | `index.html` da browser desktop | `isPlayBillingAvailable()` undefined → toast "non disponibile" + `play_billing_unavailable` | DevTools |
| 8 | Doppio tap rapido | Tap CTA 3 volte in 200ms | Solo un dialog (debounce), niente doppio acquisto | Logcat |
| 9 | Codice manuale parallelo | Utente PayPal-code + dopo 1g compra Founder Play | Entrambi i record in KV, app usa il più favorevole (Play vince per scadenza) | KV check |
| 10 | Network drop durante dialog | Modalità aereo durante dialog Play | Dialog gestisce nativamente, `onPurchaseError('network')` | UI + logcat |

## Criteri di successo (prime 2 settimane post-rilascio)

| Metrica | Baseline (v4.2) | Target (v4.3) | Strumento |
|---|---|---|---|
| Ratio `paywall_view → purchase_completed` | ~0 (frizione codice) | ≥ 30% | GA4 funnel |
| Tempo medio paywall → Pro attivo | ore/giorni | < 30 secondi | GA4 timing custom |
| Tickets "ho pagato ma non funziona" | N/mese | 0 | casella supporto |
| Crash rate v4.3 | < 0,5% | < 0,5% (no regression) | Play Vitals |

Se ratio < 15% dopo 2 settimane → bug nel funnel, non nella decisione. Se Vitals esplodono → halt rollout.

## Fuori scope (YAGNI esplicito)

- **Subscription Play** (mensile/semestrale/annuale): restano su PayPal/sito. Migrazione candidata v4.4+.
- **Lettera singola 3,99€** via Play (consumable): resta su PayPal/sito.
- **Promo codes Play**: non configurati ora.
- **Refund self-service in app**: utente passa da Google Play standard ("My orders").
- **Cross-Google-account restore**: chi cambia mail Google deve rifare acquisto o usare codice PayPal fallback.
- **iOS / App Store IAP**: app non esiste su iOS (è una PWA). PayPal resta unica via web.
- **Server webhook Play** (`pubsub` per refunds asincroni): non settiamo ora. v4.4 candidate.

## Risk assessment

| Rischio | Prob | Impatto | Mitigazione |
|---|---|---|---|
| SA permessi non propagati → tutte le verify falliscono | Media | Alto | Test #1 scopre subito; rollback Play Console |
| Bug `BillingManager` → crash Android < 9 | Bassa | Medio | minSdk ≥ 21; test su Android 8 in internal |
| Utente PayPal pre-esistente pensa di aver "perso" il Pro | Bassa | Basso | Collapse "Hai un codice?" sempre visibile; copy chiaro |
| Google rifiuta release per compliance | Bassissima | Alto | App già pubblicata, modifica payment è standard |

## Prossimo step

Implementation plan dettagliato (skill `writing-plans`) con sequenza task atomici, file/sezioni esatte, ordine di esecuzione tra repo `sherlock-site` e `sherlock_project`.
