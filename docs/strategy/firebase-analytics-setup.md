# Firebase Analytics — setup Sherlock

**Project Firebase**: `sherlock-6f88c`
**Console**: https://console.firebase.google.com/u/0/project/sherlock-6f88c/overview

Obiettivo: tracciare il funnel reale (download → onboarding → analisi → paywall → abbonamento) per:
- ottimizzare Google Ads su conversioni vere, non install;
- vedere DOVE perdi utenti nel funnel;
- segmentare per lingua, region, source.

Il codice lato sito è già pronto (commit successivo); si attiva quando le env vars sono settate su Vercel. Il codice lato app va aggiunto tu insieme al file `google-services.json`.

---

## Parte 1 — Setup Firebase Console (15 min, fai tu)

### Step 1.1 — Registra app Web

1. Apri https://console.firebase.google.com/u/0/project/sherlock-6f88c/overview
2. Click sull'icona **`</>`** ("Add app" → Web) sotto "Get started by adding Firebase to your app".
3. Nickname app: `Sherlock Site` (qualsiasi nome — è interno).
4. **NON** flaggare "Set up Firebase Hosting".
5. Click "Register app".
6. Firebase ti mostra il **config object**. Copialo tutto. Esempio:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
     authDomain: "sherlock-6f88c.firebaseapp.com",
     projectId: "sherlock-6f88c",
     storageBucket: "sherlock-6f88c.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc123def456",
     measurementId: "G-XXXXXXXXXX",
   };
   ```
7. Click "Continue to console" — niente da installare a livello SDK; il sito usa CDN.

### Step 1.2 — Aggiungi le env vars su Vercel

1. https://vercel.com/sstefano-s-projects/sherlock-polizze-site/settings/environment-variables
2. Aggiungi 7 variabili (tutte con prefisso `PUBLIC_` — necessario per essere esposte al browser via Astro):

   | Name | Value (dal config Firebase) |
   |------|----------------------------|
   | `PUBLIC_FIREBASE_API_KEY` | `apiKey` |
   | `PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
   | `PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `PUBLIC_FIREBASE_APP_ID` | `appId` |
   | `PUBLIC_FIREBASE_MEASUREMENT_ID` | `measurementId` |

3. Environment: **Production** + **Preview** + **Development** (flagga tutti e tre).
4. Click "Save". Vercel triggera un nuovo deploy automaticamente.

### Step 1.3 — Registra app Android

1. Stessa pagina Firebase, click **icona Android** (Add app → Android).
2. Android package name: `it.sherlock.polizze` (esattamente questo — è già il package del tuo build.gradle).
3. App nickname: `Sherlock Android` (qualsiasi).
4. SHA-1 release: **opzionale per Analytics**, obbligatorio se in futuro vorrai App Check o Auth. Per ora salta.
5. Click "Register app".
6. **Scarica `google-services.json`** — file critico, va in `app/` del progetto Android.
   - Salva in: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\google-services.json`
   - **NON committarlo su git** (anche se l'app non è in repo git oggi, è buona prassi).
7. Click "Next" → "Continue to console" (le istruzioni Gradle che Firebase mostra le applichi dalla Parte 2 sotto).

---

## Parte 2 — Patch app Android (devo dartela io, applicherai tu)

> ⚠️ NON applicare queste patch prima di avere `google-services.json` dentro `app/`. Senza quel file il build crasha.

### Patch 2.1 — `app/build.gradle`

Aggiungi in cima al file il plugin:
```gradle
plugins {
    id 'com.android.application'
    id 'com.google.gms.google-services'   // <— NUOVO
}
```

Aggiungi dependencies (in fondo, dentro `android { ... }` o subito dopo):
```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:33.5.1')
    implementation 'com.google.firebase:firebase-analytics'
}
```

Bump versione (ogni release con cambi nuovi va bumpata): in `defaultConfig` cambia
```gradle
versionCode 46   →  47
versionName '3.6' →  '3.7'
```

E in `index.html`, riga ~811:
```js
var APP_BUILD=46  →  var APP_BUILD=47
```

### Patch 2.2 — Project-level Gradle (cartella `sherlock_project/`, NON `app/`)

Apri `sherlock_project/build.gradle` (root, non quello di `app/`). Se non esiste, va creato. Contenuto minimo:
```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.google.gms:google-services:4.4.2'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

### Patch 2.3 — Bridge JS↔Java in `MainActivity.java`

Aggiungi import in cima:
```java
import com.google.firebase.analytics.FirebaseAnalytics;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
```

Dentro la classe `MainActivity`, aggiungi field:
```java
private FirebaseAnalytics mFirebaseAnalytics;
```

In `onCreate`, dopo `super.onCreate(savedInstanceState);`:
```java
mFirebaseAnalytics = FirebaseAnalytics.getInstance(this);
```

Nel tuo `@JavascriptInterface` class (quella che espone `Android.*` al WebView), aggiungi un metodo:
```java
@JavascriptInterface
public void track(String eventName, String paramsJson) {
    if (mFirebaseAnalytics == null || eventName == null) return;
    Bundle bundle = new Bundle();
    if (paramsJson != null && !paramsJson.isEmpty()) {
        try {
            org.json.JSONObject json = new org.json.JSONObject(paramsJson);
            java.util.Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                Object v = json.opt(k);
                if (v instanceof String) bundle.putString(k, (String) v);
                else if (v instanceof Integer) bundle.putLong(k, ((Integer) v).longValue());
                else if (v instanceof Long) bundle.putLong(k, (Long) v);
                else if (v instanceof Double) bundle.putDouble(k, (Double) v);
                else if (v instanceof Boolean) bundle.putLong(k, ((Boolean) v) ? 1L : 0L);
                else bundle.putString(k, String.valueOf(v));
            }
        } catch (Exception e) { /* noop */ }
    }
    mFirebaseAnalytics.logEvent(eventName, bundle);
}
```

### Patch 2.4 — Wire-up JavaScript in `index.html`

In `app/src/main/assets/www/index.html`, cerca la riga ~659 dove c'è la definizione di `apicall(...)` o subito dopo le costanti `Br = {...}`. Aggiungi una funzione helper:
```js
function track(name, params) {
  try {
    if (window.Android && Android.track) {
      Android.track(name, params ? JSON.stringify(params) : "");
    }
  } catch (e) { /* noop */ }
}
```

Poi nei punti chiave dell'app aggiungi le chiamate (lista esatta in Parte 3 sotto).

---

## Parte 3 — Eventi da tracciare

Naming convention Firebase: `snake_case`, max 40 char nome, max 25 parametri per evento.

### Eventi sito (già wired-up dal codice base)

| Evento | Trigger | Parametri | Stato |
|--------|---------|-----------|-------|
| `page_view` | Automatico Firebase | - | Auto |
| `play_store_click` | Click su qualsiasi link a play.google.com | `from_path` | ✅ wired |
| `subscribe_plan_click` | Click su un piano `/abbonamento/<piano>` | `piano: mensile\|semestrale\|annuale` | ✅ wired |
| `paywall_view_intent` | Click su qualsiasi link a `/abbonati` | `from_path` | ✅ wired |

Da aggiungere su pagine specifiche (puoi farlo tu o chiedimi):
- `purchase_success` su `/abbonamento/conferma` quando PayPal capture-order ritorna OK.
- `guide_engaged` su pagine `/guide/*` dopo scroll > 50% (engagement vero, non bounce).

### Eventi app (da aggiungere con Patch 2.4)

Inserisci `track('evento', { params })` in questi punti di `index.html`:

| Evento | Dove | Parametri |
|--------|------|-----------|
| `app_open` | dentro `init()`, dopo `load()` | `is_pro: 0\|1`, `free_used: N` |
| `onboarding_completed` | quando `S.onboardingDone = true` viene settato | - |
| `language_changed` | dentro `applyLang(code)`, in fondo | `lang: it\|en\|es\|fr\|my\|zh` |
| `document_upload_started` | dentro `handleFile()`, prima di `show("analyzing")` | `mime: pdf\|image`, `size_kb` |
| `analysis_completed` | dentro `handleFile().then(a => ...)` | `rischio: BASSO\|MEDIO\|ALTO\|CRITICO`, `n_esclusioni: N`, `n_clausole: N` |
| `risk_high_detected` | stesso punto sopra, solo se `a.rischio === 'ALTO'` o `'CRITICO'` | `rischio` |
| `letter_preview_opened` | dentro `goPaywall()` (è il "wow moment" dove vedono preview) | `from_screen: result\|home\|settings` |
| `paywall_viewed` | dentro `goPaywall()` | `analyses_used: N` |
| `subscribe_external_click` | sul click di `#btn-subscribe` (riga 495) e `#btn-ex-subscribe` | - |
| `pro_activated` | dopo che `S.isPro = true` viene settato (sia via codice che via email) | `method: email\|code` |
| `letter_generated` | dentro `doLetter(...).then(...)` | `tipo: reclamo\|ivass\|diffida` |
| `pro_letter_sent` | (futuro, se aggiungerai funzione "invio diretto") | - |

### User properties (settate una volta per sessione)

- `ui_language` — lingua selezionata (è già wired-up via cookie sul sito).
- `pro_status` — `free | pro` (settata dopo `app_open`).
- `analyses_count` — numero analisi totali (utile per cohort analysis).

---

## Parte 4 — Setup conversioni in Google Ads (futuro)

Quando vorrai fare ads ottimizzate su conversioni vere (non install):
1. Su Firebase Console → Analytics → Events → flag `purchase_success` come **"Mark as conversion"**.
2. Su Google Ads → Tools → Conversions → "Import from Firebase" → seleziona `purchase_success`.
3. Setta le campagne ads in **"Maximize conversions"** mode targeting `purchase_success`.
4. Budget test 10-20 €/giorno solo Italia, solo keyword reclami/IVASS (vedi piano marketing).

---

## Parte 5 — Verifica funzionamento

### Lato sito

1. Dopo aver settato le env vars su Vercel, attendi nuovo deploy (1-2 min).
2. Apri https://sherlock-polizze-site-five.vercel.app/ con DevTools aperti → Network tab.
3. Cerca richieste a `firebase-analytics` o `googletagmanager.com`.
4. Su Firebase Console → Analytics → **Realtime** → vedi te stesso comparire entro 30 secondi.

### Lato app

1. Buildi `.aab` v3.7 con le patch (`./gradlew bundleRelease`).
2. Installi APK debug sul telefono.
3. Apri Firebase Console → Analytics → **DebugView**.
4. Sul telefono apri il terminale (Termux o `adb shell`):
   ```
   adb shell setprop debug.firebase.analytics.app it.sherlock.polizze
   ```
5. Apri l'app: in DebugView vedi gli eventi `app_open`, `screen_view`, ecc. in real-time.

---

## Quanto ti costa

Firebase Analytics è **gratis** fino a quasi qualsiasi volume. Non c'è rate limit pratico per app come Sherlock.

L'unico costo "nascosto" è la conformità GDPR: dovrai aggiungere un banner consent (cookiebot, klaro o simile) se vuoi essere pulito al 100% — Firebase tracking è un trattamento dati. Per ora la pagina `/trasparenza` documenta tutto (incluso che usiamo Firebase Analytics — ricordami di aggiungerlo lì quando attivi).

---

## Riepilogo passi (tuo ordine di esecuzione)

1. **Firebase Console** (15 min): registra app Web → copia config. Registra app Android → scarica `google-services.json`.
2. **Vercel env vars** (5 min): incolla i 7 `PUBLIC_FIREBASE_*`. Attendi auto-deploy.
3. **Verifica sito** (2 min): Realtime di Firebase mostra te stesso → ✅ funziona.
4. **Patch app** (15 min): applica le 4 patch (build.gradle root, app/build.gradle, MainActivity.java, index.html). Posiziona `google-services.json` in `app/`.
5. **Aggiungi track calls** nell'app (30 min): inserisci le 12 chiamate `track(...)` nei punti elencati in Parte 3.
6. **Build & test app** (15 min): `./gradlew bundleRelease` → installa APK debug → DebugView mostra eventi.
7. **Pubblica .aab v3.7** su Play Console.

Tempo totale: ~80 minuti di lavoro tuo, distribuibile su più sessioni.

Se vuoi che faccia io le track calls nell'app (passo 5), dimmelo e procedo. È meccanico — ho già la lista esatta.
