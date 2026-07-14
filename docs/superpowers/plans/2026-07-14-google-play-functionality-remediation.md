# Google Play Functionality Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produrre Sherlock Android v4.6.7/versionCode 65 con controlli funzionanti, accessibili e testati, pronto come AAB per la risposta alla violazione Google Play.

**Architecture:** Conservare il wrapper WebView e importarne una copia sanificata in `android/`, con policy native pure e testabili per navigazione e URL. Allineare la PWA incorporata alla PWA web, aggiungere un contratto esplicito per navigazione/feedback con il bridge Android e verificare i flussi principali con Vitest, JUnit e Playwright.

**Tech Stack:** Java 8, Android Gradle Plugin 8.7.3, Gradle 8.9, Android SDK 35, BillingClient 7.1.1, Astro 6, JavaScript, Vitest 3.2.6, Playwright.

## Global Constraints

- Non lavorare su `main` o `master`; usare `codex/complete-sherlock-commercial-hardening`.
- Non eseguire deploy web, upload Google Play, pagamenti o email reali.
- Package Android esatto: `it.sherlock.polizze`.
- Nuova versione: `versionName 4.6.7`, `versionCode 65`.
- Backend canonico: `https://www.sherlockpolizze.it`.
- Non committare keystore, password, `google-services.json`, service account, AAB/APK o dati reali.
- Conservare Play Billing e Firebase esistenti; nessuna migrazione a TWA.
- Ogni controllo touch principale deve avere target minimo 48 × 48 CSS pixel e nome accessibile.
- Le animazioni devono rispettare `prefers-reduced-motion`.
- Gli abbellimenti non possono aggiungere controlli ambigui o ridurre contrasto, leggibilità o stabilità.
- Il bundle viene preparato e verificato, non pubblicato.

---

### Task 1: Import Android sanificato e configurazione sicura

**Files:**
- Create: `android/settings.gradle`
- Create: `android/build.gradle`
- Create: `android/gradle.properties`
- Create: `android/gradle/wrapper/gradle-wrapper.properties`
- Create: `android/gradlew`
- Create: `android/gradlew.bat`
- Create: `android/app/build.gradle`
- Create: `android/app/proguard-rules.pro`
- Create: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/java/it/sherlock/polizze/MainActivity.java`
- Create: `android/app/src/main/java/it/sherlock/polizze/BillingManager.java`
- Create: `android/app/src/main/res/values/strings.xml`
- Create: `android/app/src/main/res/mipmap-*/ic_launcher.png`
- Create: `android/app/src/main/assets/www/index.html`
- Create: `android/app/src/main/assets/www/img/*`
- Modify: `.gitignore`
- Modify: `.env.example`
- Test: `tests/content/android-security-regressions.test.ts`

**Interfaces:**
- Consumes: sorgente v4.6.6 dalla cartella locale indicata nella specifica.
- Produces: progetto Android riproducibile in `android/`, privo di segreti e con `BACKEND_URL` canonico.

- [ ] **Step 1: Scrivere il test di sicurezza in stato rosso**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const build = () => readFileSync('android/app/build.gradle', 'utf8');
const main = () => readFileSync('android/app/src/main/java/it/sherlock/polizze/MainActivity.java', 'utf8');

describe('Android release security', () => {
  it('usa versione 65 e dominio canonico senza password incorporate', () => {
    expect(build()).toContain('versionCode 65');
    expect(build()).toContain("versionName '4.6.7'");
    expect(build()).not.toMatch(/storePassword\s+.*['"][^'"]+['"]/);
    expect(build()).not.toMatch(/keyPassword\s+.*['"][^'"]+['"]/);
    expect(main()).toContain('https://www.sherlockpolizze.it');
    expect(main()).not.toContain('sherlock-polizze-site-five.vercel.app');
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare il fallimento**

Run: `npm test -- --run tests/content/android-security-regressions.test.ts`  
Expected: FAIL perché `android/app/build.gradle` non esiste.

- [ ] **Step 3: Copiare soltanto i file ammessi e aggiornare Gradle**

Usare `Copy-Item` per sorgenti, wrapper, risorse e asset; non copiare `keystore/`, `google-services.json`, `build/`, `.gradle/` o `app/release/`. In `android/app/build.gradle` usare:

```groovy
defaultConfig {
    applicationId 'it.sherlock.polizze'
    minSdk 21
    targetSdk 35
    versionCode 65
    versionName '4.6.7'
}

def releaseKeystore = System.getenv('KEYSTORE_PATH')
def releaseStorePassword = System.getenv('KEYSTORE_PASSWORD')
def releaseAlias = System.getenv('KEY_ALIAS')
def releaseKeyPassword = System.getenv('KEY_PASSWORD')

signingConfigs {
    release {
        if (releaseKeystore && releaseStorePassword && releaseAlias && releaseKeyPassword) {
            storeFile file(releaseKeystore)
            storePassword releaseStorePassword
            keyAlias releaseAlias
            keyPassword releaseKeyPassword
        }
    }
}
```

Impostare `BACKEND_URL` a `https://www.sherlockpolizze.it`.

- [ ] **Step 4: Escludere segreti e output**

Aggiungere a `.gitignore`:

```gitignore
android/.gradle/
android/**/build/
android/local.properties
android/**/*.jks
android/**/*.keystore
android/**/google-services.json
android/**/*.aab
android/**/*.apk
```

Aggiungere a `.env.example` soltanto i nomi:

```dotenv
KEYSTORE_PATH=
KEYSTORE_PASSWORD=
KEY_ALIAS=
KEY_PASSWORD=
```

- [ ] **Step 5: Verificare test e assenza di artefatti sensibili**

Run: `npm test -- --run tests/content/android-security-regressions.test.ts`  
Expected: PASS.

Run: `git status --short --ignored android | Select-String 'keystore|google-services|\.aab|\.apk'`  
Expected: nessun file sensibile tracciabile; eventuali file devono risultare ignorati.

- [ ] **Step 6: Commit**

```powershell
git add android .gitignore .env.example tests/content/android-security-regressions.test.ts
git commit -m "build: import sanitized Android application"
```

---

### Task 2: Policy native per URL e navigazione Indietro

**Files:**
- Create: `android/app/src/main/java/it/sherlock/polizze/NavigationPolicy.java`
- Create: `android/app/src/test/java/it/sherlock/polizze/NavigationPolicyTest.java`
- Modify: `android/app/src/main/java/it/sherlock/polizze/MainActivity.java`

**Interfaces:**
- Produces: `NavigationPolicy.classify(String): Destination` e contratto JS `window.SherlockNavigation.canGoBack()` / `window.SherlockNavigation.goBack()`.
- Destination: `INTERNAL`, `EXTERNAL`, `EMAIL`, `REJECTED`.

- [ ] **Step 1: Scrivere test JUnit in stato rosso**

```java
@Test public void classifiesCanonicalUrlsAsInternal() {
    assertEquals(INTERNAL, NavigationPolicy.classify("https://www.sherlockpolizze.it/privacy"));
}
@Test public void rejectsDangerousSchemes() {
    assertEquals(REJECTED, NavigationPolicy.classify("javascript:alert(1)"));
}
@Test public void classifiesMailAndExternalHttps() {
    assertEquals(EMAIL, NavigationPolicy.classify("mailto:info@example.it"));
    assertEquals(EXTERNAL, NavigationPolicy.classify("https://www.ivass.it"));
}
```

- [ ] **Step 2: Eseguire il test rosso**

Run: `cd android; .\gradlew.bat testDebugUnitTest --tests it.sherlock.polizze.NavigationPolicyTest`  
Expected: FAIL perché `NavigationPolicy` non esiste.

- [ ] **Step 3: Implementare la policy pura**

```java
public final class NavigationPolicy {
    public enum Destination { INTERNAL, EXTERNAL, EMAIL, REJECTED }
    public static Destination classify(String raw) {
        if (raw == null) return Destination.REJECTED;
        Uri uri = Uri.parse(raw.trim());
        String scheme = uri.getScheme();
        if ("mailto".equalsIgnoreCase(scheme)) return Destination.EMAIL;
        if (!"https".equalsIgnoreCase(scheme)) return Destination.REJECTED;
        return "www.sherlockpolizze.it".equalsIgnoreCase(uri.getHost())
            ? Destination.INTERNAL : Destination.EXTERNAL;
    }
    private NavigationPolicy() {}
}
```

- [ ] **Step 4: Integrare URL e tasto Indietro in MainActivity**

Per URL interni usare `view.loadUrl(url)`. Per esterni/email usare `ACTION_VIEW`, catturare `ActivityNotFoundException` e mostrare “Nessuna app disponibile per aprire questo link”. Per Indietro interrogare:

```java
webView.evaluateJavascript(
    "Boolean(window.SherlockNavigation&&window.SherlockNavigation.canGoBack())",
    value -> {
        if ("true".equals(value)) webView.evaluateJavascript("window.SherlockNavigation.goBack()", null);
        else if (webView.canGoBack()) webView.goBack();
        else handleExitConfirmation();
    });
```

La prima pressione sulla home mostra toast “Premi di nuovo Indietro per uscire”; la seconda entro 2 secondi chiude.

- [ ] **Step 5: Verificare test**

Run: `cd android; .\gradlew.bat testDebugUnitTest --tests it.sherlock.polizze.NavigationPolicyTest`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add android/app/src/main/java android/app/src/test/java
git commit -m "fix: make Android navigation recoverable"
```

---

### Task 3: File chooser e bridge con esiti espliciti

**Files:**
- Create: `android/app/src/main/java/it/sherlock/polizze/BridgeResult.java`
- Create: `android/app/src/test/java/it/sherlock/polizze/BridgeResultTest.java`
- Modify: `android/app/src/main/java/it/sherlock/polizze/MainActivity.java`

**Interfaces:**
- Produces: `BridgeResult.success(String)` / `BridgeResult.error(String)` serializzati in JSON; callback file chooser sempre conclusa.

- [ ] **Step 1: Scrivere test del risultato bridge**

```java
@Test public void errorResultContainsOnlyStableCode() throws Exception {
    JSONObject json = new JSONObject(BridgeResult.error("network_timeout").toJson());
    assertFalse(json.getBoolean("ok"));
    assertEquals("network_timeout", json.getString("error"));
    assertFalse(json.has("exception"));
}
```

- [ ] **Step 2: Eseguire il test rosso**

Run: `cd android; .\gradlew.bat testDebugUnitTest --tests it.sherlock.polizze.BridgeResultTest`  
Expected: FAIL perché `BridgeResult` non esiste.

- [ ] **Step 3: Implementare risultati stabili e timeout**

```java
public final class BridgeResult {
    private final boolean ok; private final String payload; private final String error;
    public static BridgeResult success(String payload) { return new BridgeResult(true, payload, null); }
    public static BridgeResult error(String code) { return new BridgeResult(false, null, code); }
    public String toJson() throws JSONException {
        JSONObject out = new JSONObject().put("ok", ok);
        if (payload != null) out.put("payload", payload);
        if (error != null) out.put("error", error);
        return out.toString();
    }
}
```

Mappare eccezioni su `network_timeout`, `network_unavailable`, `server_error` e `invalid_response`, senza includere `e.getMessage()` nel risultato utente.

- [ ] **Step 4: Chiudere sempre il file chooser**

In `onShowFileChooser`, annullare prima la callback precedente. In `onActivityResult`, invocare sempre `filePathCallback.onReceiveValue(resultsOrNull)` in `finally` e azzerare la callback. Catturare `ActivityNotFoundException` all'avvio e mostrare “Nessun selettore file disponibile”.

- [ ] **Step 5: Verificare test**

Run: `cd android; .\gradlew.bat testDebugUnitTest`  
Expected: tutti i test Android PASS.

- [ ] **Step 6: Commit**

```powershell
git add android/app/src/main/java android/app/src/test/java
git commit -m "fix: return explicit Android bridge outcomes"
```

---

### Task 4: Contratto PWA, accessibilità e polish visivo

**Files:**
- Modify: `public/app/index.html`
- Modify: `android/app/src/main/assets/www/index.html`
- Test: `tests/content/pwa-interactions.test.ts`

**Interfaces:**
- Produces: `window.SherlockNavigation`, helper `setBusy(button, busy, label)`, componenti `.app-feedback`, `.empty-state`, `.btn-icon`.

- [ ] **Step 1: Scrivere test statici in stato rosso**

```ts
it('espone navigazione interna e accessibilità dei controlli icona', () => {
  const html = readFileSync('public/app/index.html', 'utf8');
  expect(html).toContain('window.SherlockNavigation');
  expect(html).toContain('prefers-reduced-motion: reduce');
  expect(html).toMatch(/id="btn-home-gear"[^>]+aria-label="Impostazioni"/);
  expect(html).toContain('min-height:48px');
});
```

Aggiungere un test che estrae tutti i `<button>` statici e fallisce se non hanno testo normalizzato né `aria-label`.

- [ ] **Step 2: Eseguire test rosso**

Run: `npm test -- --run tests/content/pwa-interactions.test.ts`  
Expected: FAIL sui nuovi requisiti.

- [ ] **Step 3: Applicare accessibilità e stati**

Aggiungere `aria-label`, `aria-live="polite"`, `aria-busy`, focus visibile e target touch. Implementare:

```js
window.SherlockNavigation = {
  canGoBack: function () { return Array.isArray(S.navStack) && S.navStack.length > 1; },
  goBack: function () {
    if (!this.canGoBack()) return false;
    S.navStack.pop();
    showScreen(S.navStack[S.navStack.length - 1], { fromBack: true });
    return true;
  }
};
```

Ogni cambio schermata aggiunge una sola voce, salvo navigazione Indietro.

- [ ] **Step 4: Applicare il polish visivo controllato**

Usare la skill `frontend-design` prima di questa modifica. Mantenere palette blu/oro; introdurre stati coerenti, gerarchia delle card e transizioni non bloccanti:

```css
.btn,.btn-icon{min-height:48px;touch-action:manipulation}
:where(button,a,input,summary):focus-visible{outline:3px solid #f2c94c;outline-offset:3px}
.app-feedback[hidden]{display:none}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
```

Le illustrazioni Sherlock esistenti possono comparire solo con `alt` descrittivo oppure `alt=""` se decorative.

- [ ] **Step 5: Sincronizzare la PWA Android**

Applicare le stesse correzioni funzionali a `android/app/src/main/assets/www/index.html`, preservando le chiamate `Android.*` e Play Billing. Aggiungere un test che confronta la presenza degli ID principali e del contratto `SherlockNavigation` in entrambi i file.

- [ ] **Step 6: Verificare test**

Run: `npm test -- --run tests/content/pwa-interactions.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add public/app/index.html android/app/src/main/assets/www/index.html tests/content/pwa-interactions.test.ts
git commit -m "fix: make PWA controls accessible and responsive"
```

---

### Task 5: Errori, retry e Play Billing senza loading permanente

**Files:**
- Modify: `public/app/index.html`
- Modify: `android/app/src/main/assets/www/index.html`
- Modify: `android/app/src/main/java/it/sherlock/polizze/MainActivity.java`
- Test: `tests/content/pwa-interactions.test.ts`
- Test: `android/app/src/test/java/it/sherlock/polizze/BridgeResultTest.java`

**Interfaces:**
- Produces: `showFeedback({kind,title,message,retry})`, `withUiTimeout(promise, ms)`, callback Billing complete.

- [ ] **Step 1: Scrivere test rosso per feedback e timeout**

```ts
it('prevede feedback recuperabile per rete, AI e pagamento', () => {
  const html = readFileSync('public/app/index.html', 'utf8');
  expect(html).toContain('function showFeedback');
  expect(html).toContain('function withUiTimeout');
  expect(html).toContain('window.onPurchasePending');
  expect(html).toContain('window.onPurchaseError');
  expect(html).toContain('aria-live="assertive"');
});
```

- [ ] **Step 2: Eseguire test rosso**

Run: `npm test -- --run tests/content/pwa-interactions.test.ts`  
Expected: FAIL per helper mancanti.

- [ ] **Step 3: Implementare helper e ripristino pulsanti**

```js
function withUiTimeout(promise, ms) {
  return Promise.race([promise, new Promise(function(_, reject){
    setTimeout(function(){ reject(new Error('timeout')); }, ms);
  })]);
}
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  if (label) button.textContent = label;
}
```

Ogni `catch` usa un codice stabile per scegliere messaggio e retry; ogni `finally` ripristina il controllo. Il retry non parte automaticamente e non duplica acquisti o analisi.

- [ ] **Step 4: Completare callback Billing**

Definire feedback distinti per cancellato, pending, errore, verifica e ripristino. `onPurchasePending` deve riattivare la UI e spiegare che l'acquisto sarà completato da Google Play; `onPurchaseError` deve offrire retry solo prima della conferma provider.

- [ ] **Step 5: Verificare test web e Android**

Run: `npm test -- --run tests/content/pwa-interactions.test.ts; cd android; .\gradlew.bat testDebugUnitTest`  
Expected: entrambe le suite PASS.

- [ ] **Step 6: Commit**

```powershell
git add public/app/index.html android tests/content/pwa-interactions.test.ts
git commit -m "fix: recover PWA actions from service failures"
```

---

### Task 6: Test end-to-end Playwright e screenshot

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/pwa-functionality.spec.ts`
- Create: `test-results/google-play/.gitkeep`
- Modify: `.gitignore`

**Interfaces:**
- Produces: comando `npm run test:e2e`, screenshot e report HTML ignorati da Git; screenshot approvati copiabili nell'audit.

- [ ] **Step 1: Installare Playwright come dev dependency**

Run: `npm install --save-dev @playwright/test`  
Expected: package e lockfile aggiornati senza dipendenze invalide.

- [ ] **Step 2: Configurare browser e web server**

```ts
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:4321/app/', reuseExistingServer: false },
  projects: [
    { name: 'mobile-small', use: { viewport: { width: 320, height: 568 } } },
    { name: 'android', use: { viewport: { width: 412, height: 915 } } },
    { name: 'tablet-landscape', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }
  ]
});
```

- [ ] **Step 3: Scrivere i test E2E iniziali**

```ts
test('all visible primary controls have names and feedback', async ({ page }) => {
  await page.goto('/app/');
  await page.getByRole('button', { name: /salta/i }).click();
  for (const button of await page.getByRole('button').all()) {
    if (await button.isVisible()) await expect(button).toHaveAccessibleName(/\S/);
  }
  await page.getByRole('button', { name: /carica pdf/i }).click();
  await expect(page.locator('input[type=file]')).toHaveAttribute('accept', /pdf/);
});
```

Aggiungere scenari con routing di rete per `/api/analizza`, `/api/lettera` e pagamenti: offline, 500, timeout e risposta invalida. Verificare che compaiano messaggio e azione di recupero e che il pulsante torni abilitato.

- [ ] **Step 4: Eseguire test rosso e correggere solo regressioni osservate**

Run: `npx playwright install chromium; npm run test:e2e`  
Expected iniziale: eventuali failure puntuali documentati; correggere PWA finché tutti i progetti passano.

- [ ] **Step 5: Produrre screenshot rappresentativi**

Salvare con `page.screenshot()` home, upload, errore rete recuperabile e paywall su Android medio e mobile piccolo in `test-results/google-play/`. Non usare dati personali.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json playwright.config.ts tests/e2e .gitignore test-results/google-play/.gitkeep public/app/index.html android/app/src/main/assets/www/index.html
git commit -m "test: cover Google Play interaction flows"
```

---

### Task 7: Build Android, ispezione AAB e smoke test

**Files:**
- Modify: `android/app/build.gradle` solo se la build rivela incompatibilità verificata.
- Create locally, ignored: `android/app/google-services.json`
- Create locally, ignored: `artifacts/Sherlock-v4.6.7-vc65.aab`

**Interfaces:**
- Consumes: credenziali e file firma locali esistenti, mai copiati nel controllo versione.
- Produces: AAB v4.6.7/vc65 e hash SHA-256 documentabile.

- [ ] **Step 1: Preparare configurazione locale ignorata**

Copiare `google-services.json` e impostare `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` nella sola sessione di build. Prima verificare che `git check-ignore` li riconosca.

- [ ] **Step 2: Eseguire test e build debug**

Run: `cd android; .\gradlew.bat clean testDebugUnitTest assembleDebug`  
Expected: BUILD SUCCESSFUL e test verdi.

- [ ] **Step 3: Eseguire build release**

Run: `cd android; .\gradlew.bat bundleRelease`  
Expected: BUILD SUCCESSFUL e `app/build/outputs/bundle/release/app-release.aab`.

- [ ] **Step 4: Verificare bundle**

Usare `bundletool dump manifest --bundle ...` oppure `apkanalyzer manifest print ...` per confermare package, versionCode 65, versionName 4.6.7, target SDK 35 e activity launcher. Calcolare `Get-FileHash -Algorithm SHA256`.

- [ ] **Step 5: Smoke test su emulatore/dispositivo disponibile**

Installare un APK derivato dal bundle solo su dispositivo di test. Verificare onboarding, lingua, impostazioni, upload/annullamento, analisi con errore simulato, paywall, Billing test, privacy/link, condivisione e tasto Indietro in ogni schermata. Nessun pagamento reale.

- [ ] **Step 6: Conservare artefatto fuori dal Git**

Copiare AAB in `artifacts/Sherlock-v4.6.7-vc65.aab`, verificare che sia ignorato e non eseguire upload.

---

### Task 8: Dossier Google Play e chiusura documentale

**Files:**
- Create: `GOOGLE_PLAY_FUNCTIONALITY_REMEDIATION.md`
- Modify: `CODEX_IMPLEMENTATION_STATUS.md`
- Modify: `PENDING_TASKS.md`
- Modify: `TEST_RESULTS.md`
- Modify: `DECISIONS.md`
- Modify: `DEPLOYMENT_GUIDE.md`
- Modify: `ROLLBACK_GUIDE.md`
- Modify: `POST_DEPLOY_CHECKLIST.md`

**Interfaces:**
- Produces: inventario verificato, prove, istruzioni bundle, checklist e testo prudente per Google Play Console.

- [ ] **Step 1: Redigere inventario e matrice difetti**

Per ogni controllo indicare schermata, ID/nome, esito iniziale, difetto, correzione, test automatico/manuale e stato. Separare “verificato”, “corretto” e “residuo”.

- [ ] **Step 2: Registrare evidenze reali**

Riportare comandi, exit code, conteggio test, dispositivi/viewport, hash AAB e percorsi screenshot. Non dichiarare eseguito un test manuale non effettuato.

- [ ] **Step 3: Scrivere istruzioni Console**

Includere: backup release corrente, creazione release su track di test, caricamento vc65, controllo Data Safety, test pre-launch, staged rollout, testo risposta alla contestazione e rollback a deployment stabile. L'operazione resta manuale.

- [ ] **Step 4: Eseguire verifica completa fresca**

Run:

```powershell
npm test
npx astro check
npm run build
npm run test:e2e
cd android
.\gradlew.bat testDebugUnitTest bundleRelease
cd ..
git diff --check
git status --short
```

Expected: 0 test falliti, 0 errori Astro, entrambe le build riuscite, nessun segreto o output tracciato.

- [ ] **Step 5: Commit finale della tranche**

```powershell
git add GOOGLE_PLAY_FUNCTIONALITY_REMEDIATION.md CODEX_IMPLEMENTATION_STATUS.md PENDING_TASKS.md TEST_RESULTS.md DECISIONS.md DEPLOYMENT_GUIDE.md ROLLBACK_GUIDE.md POST_DEPLOY_CHECKLIST.md
git commit -m "docs: complete Google Play remediation dossier"
```

- [ ] **Step 6: Fermarsi prima delle azioni irreversibili**

Non eseguire deploy web, push non necessario o upload in Google Play. Consegnare percorso AAB, SHA-256, commit, risultati e attività manuali residue.
