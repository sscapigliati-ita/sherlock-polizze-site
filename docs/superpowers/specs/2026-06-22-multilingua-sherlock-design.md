# Design: supporto multilingua per Sherlock (sito + app)

**Data**: 2026-06-22
**Scope**: aggiungere 5 lingue oltre all'italiano (inglese, spagnolo, francese, birmano, cinese semplificato) sia al sito Astro `sherlock-site` sia all'app Android `it.sherlock.polizze`, con selettore a bandierine nella barra menu.

## Obiettivo

Permettere a un utente non italofono di:
1. Leggere la landing page commerciale, le guide e il flusso paywall del sito nella propria lingua.
2. Usare l'app (UI statica + risposte AI) interamente nella propria lingua.

Le lingue richieste sono italiano (default), inglese, spagnolo, francese, birmano, cinese semplificato.

## Approccio scelto

- **Sito**: widget Google Translate (decisione utente). Zero traduzione manuale, integrazione runtime.
- **App**: dizionario JS statico per le poche stringhe UI + parametro `lingua` passato al backend per forzare la lingua delle risposte AI.
- **Backend (parte del sito)**: gli endpoint `/api/analizza` e `/api/lettera` accettano un campo `lingua` opzionale e iniettano un'istruzione esplicita nel system prompt Anthropic.

## Architettura

### Sito Astro (`C:\Users\Stefano\sherlock-site\`)

**File nuovi**
- `src/components/LangSwitcher.astro` — barra di 6 bandierine cliccabili. Bandiera attiva con bordo `gold-400`. Click → set cookie `googtrans=/it/<codice>` (sia su dominio nudo sia con prefisso `.`) e `location.reload()`. Allo script di inizializzazione legge il cookie corrente per evidenziare la bandiera giusta.

**File modificati**
- `src/components/Header.astro` — include `<LangSwitcher />` a destra del nav.
- `src/layouts/BaseLayout.astro` — aggiunge:
  - `<div id="google_translate_element" class="hidden">` nascosto.
  - Script `googleTranslateElementInit()` con `{pageLanguage: 'it', includedLanguages: 'en,es,fr,my,zh-CN', layout: SIMPLE, autoDisplay: false}`.
  - `<script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async>`.
  - CSS globale per nascondere il banner di Google: `.skiptranslate { display: none !important; } body { top: 0 !important; }`.
- Le pagine `src/pages/admin/*` aggiungono attributo `translate="no"` sull'elemento radice → restano in italiano (uso interno admin).
- Codici Pro `SHK-XXXX-XXXX`, brand "Sherlock" e nomi tecnici: marcati con classe `notranslate` dove appaiono.

**Lingue Google Translate**: codici `en`, `es`, `fr`, `my`, `zh-CN`.

### App Android (`C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\`)

**File modificato**: `app/src/main/assets/www/index.html`.

Aggiunte:
1. **Barra bandiere** in cima alla SPA, sopra il titolo: 6 bottoni con SVG/emoji bandiera (24×16). Bandiera attiva: opacità 1 + bordo oro 2px; inattive: opacità 0.5.
2. **Costante `I18N`**: oggetto con le stringhe statiche in 6 lingue.
   ```js
   const I18N = {
     it: { upload_btn: "Carica polizza", ... },
     en: { upload_btn: "Upload policy", ... },
     es: { upload_btn: "Subir póliza", ... },
     fr: { upload_btn: "Téléverser la police", ... },
     my: { upload_btn: "မူဝါဒ တင်ရန်", ... },
     zh: { upload_btn: "上传保单", ... },
   };
   ```
3. **Marcatori DOM**: ogni nodo traducibile ha `data-i18n="chiave"` (per `textContent`) e/o `data-i18n-attr="placeholder:chiave"` per attributi.
4. **Funzione `applyLang(lang)`**: itera i nodi marcati e li aggiorna; salva `localStorage.sherlockLang = lang`; aggiorna lo stato visivo della barra bandiere.
5. **Init**: al boot legge `localStorage.sherlockLang` (default `it`), chiama `applyLang(...)`.
6. **Variabile globale `currentLang`** referenziata dalle funzioni che fanno fetch verso il backend.
7. Tutte le `fetch` verso `BE_BASE + '/api/analizza'` e `BE_BASE + '/api/lettera'` aggiungono `lingua: currentLang` nel body JSON.

**Bump versione**: `app/build.gradle` → `versionCode 45→46`, `versionName "3.5"→"3.6"`. `APP_BUILD` in `index.html` allineato a `46` (così l'aggiornamento resetta `freeUsed=0` come da convenzione del progetto). Nota: la memoria al momento del brainstorm indicava 43, ma il sorgente corrente in `Downloads\Sherlock app final\...\build.gradle` è già a 45/3.5.

### Backend (parte del sito) — `src/pages/api/`

**File modificati**: `analizza.ts`, `lettera.ts`.

Logica:
```ts
const LANG_NAMES: Record<string,string> = {
  it: 'italiano',
  en: 'English',
  es: 'español',
  fr: 'français',
  my: 'Burmese',
  zh: 'Chinese (Simplified)',
};
const lingua = (body.lingua && body.lingua in LANG_NAMES) ? body.lingua : 'it';
const langInstruction = `\n\nIMPORTANT: Respond entirely in ${LANG_NAMES[lingua]}, regardless of the document's original language. All headings, labels, and explanations must be in ${LANG_NAMES[lingua]}.`;
// concateno langInstruction al system prompt esistente
```

Compat: se `lingua` manca (app pre-3.4) → default `it`, nessuna regressione.

## Flusso utente

1. Utente apre il sito Sherlock in italiano (default).
2. Clicca bandiera EN → cookie `googtrans=/it/en`, ricarica, pagina tradotta da Google.
3. Naviga su `/abbonati`: la traduzione persiste (cookie sul dominio).
4. Sull'app, apre Sherlock → vede UI in italiano + barra bandiere in alto.
5. Tocca bandiera 🇲🇲 → UI passa in birmano (dizionario locale) e `localStorage` salva `my`.
6. Carica una polizza in italiano → l'app POST `/api/analizza` con `{...payload, lingua: 'my'}`.
7. L'AI risponde in birmano anche se il documento è italiano.

## Edge case / decisioni

- **Cinese**: solo semplificato (mainland). Bandierina 🇨🇳. Codice Google `zh-CN`, codice backend `zh`.
- **Birmano**: 🇲🇲, codice `my`. Anthropic supporta il birmano in output, qualità accettabile per MVP.
- **Guide MDX** del sito: tradotte runtime da Google (nessuna traduzione manuale).
- **Pagine admin**: `translate="no"` → restano in italiano.
- **Etichette tecniche** (codici `SHK-`, brand "Sherlock"): classe `notranslate` dove ricorrono.
- **Bottoni PayPal SDK**: lingua determinata dal browser/SDK PayPal, non controllabile.
- **Fallback chiave i18n mancante**: la funzione `applyLang` lascia il `textContent` originale (italiano) se la chiave manca → niente crash.

## Test manuali (golden path)

**Sito**:
1. Aprire landing in italiano → 6 bandiere visibili, IT attiva.
2. Click 🇬🇧 → reload, titolo H1 in inglese, banner Google nascosto, codici `SHK-` non tradotti.
3. Navigare a `/abbonati`, `/guide/*` → traduzione persiste.
4. Aprire `/admin` → resta in italiano.

**App** (side-load APK debug prima del bundle):
1. Avvio app fresca → IT attiva, UI in italiano.
2. Tocca 🇪🇸 → labels in spagnolo, persistenza dopo restart.
3. Carica polizza italiana → risposta AI in spagnolo.
4. Tocca 🇲🇲 → labels in birmano, nuova analisi → risposta in birmano.
5. Verificare che la richiesta a `/api/analizza` contenga `lingua: 'my'` (DevTools / chrome://inspect).

**Backend**:
1. `curl -X POST /api/analizza -d '{"testo":"...","lingua":"fr"}'` → risposta in francese.
2. `curl -X POST /api/analizza -d '{"testo":"..."}'` (senza `lingua`) → risposta in italiano (compat).
3. `curl ... -d '{"testo":"...","lingua":"xx"}'` → fallback italiano (whitelist).

## File toccati (riepilogo)

**Sito**:
- `src/components/LangSwitcher.astro` (nuovo)
- `src/components/Header.astro` (modificato)
- `src/layouts/BaseLayout.astro` (modificato)
- `src/pages/admin/*.astro` (aggiunto `translate="no"`)
- `src/pages/api/analizza.ts` (modificato)
- `src/pages/api/lettera.ts` (modificato)

**App**:
- `app/build.gradle` (bump version)
- `app/src/main/assets/www/index.html` (barra + I18N + applyLang + lingua nelle fetch + APP_BUILD)

## Fuori scope

- Traduzione manuale qualità SEO (i18n routing Astro): rimandato a una seconda fase se serve indicizzazione locale.
- Pagina admin tradotta.
- Email transazionali (Resend) tradotte: restano in italiano.
- Selezione dialetto cinese (tradizionale/Hong Kong).
- Localizzazione formati data/valuta nell'app.
