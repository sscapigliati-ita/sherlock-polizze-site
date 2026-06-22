# Supporto multilingua Sherlock — Piano implementativo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aggiungere 5 lingue (EN, ES, FR, MY, ZH-CN) al sito Astro e all'app Android Sherlock, selezionabili tramite bandierine in barra menu.

**Architecture:** sito tradotto runtime via widget Google Translate; app con dizionario JS locale per UI statica + nuovo campo `lingua` passato al backend per forzare la lingua delle risposte Anthropic.

**Tech Stack:** Astro 5 SSR + Vercel adapter; HTML+JS in WebView Android; backend serverless TypeScript con Anthropic SDK via fetch.

## Global Constraints

- Lingue supportate (codici whitelist backend): `it`, `en`, `es`, `fr`, `my`, `zh`.
- Codici Google Translate widget: `en, es, fr, my, zh-CN` (italiano è la `pageLanguage`).
- Mappatura nome lingua per system prompt Anthropic:
  `{it:'italiano', en:'English', es:'español', fr:'français', my:'Burmese', zh:'Chinese (Simplified)'}`.
- L'app è attualmente a `versionCode 45` / `versionName "3.5"` / `APP_BUILD=45` → il piano bumpa a `46 / "3.6" / 46`.
- Repo Astro (`C:\Users\Stefano\sherlock-site\`): branch principale `main`.
- App Android sorgenti: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\`.
- File WebView monolitico: `app/src/main/assets/www/index.html` (~915 righe).
- Output release `.aab` (mai APK per Play): `app/build/outputs/bundle/release/app-release.aab`.
- Nessun framework di test nel progetto: le verifiche sono manuali (curl per backend, `npm run dev` per sito, side-load APK debug per app).

---

### Task 1: Backend — parametro `lingua` in `/api/analizza`

**Files:**
- Modify: `C:\Users\Stefano\sherlock-site\src\pages\api\analizza.ts` (linee 12-21, 133, 175)

**Interfaces:**
- Consumes: nulla (prima task)
- Produces: endpoint POST `/api/analizza` che accetta `body.lingua ∈ {it,en,es,fr,my,zh}` opzionale (default `it`) e ritorna report con tutti i campi-stringa nella lingua richiesta.

- [ ] **Step 1: Aggiungere costante `LANG_NAMES` e funzione di estrazione**

Aprire `src/pages/api/analizza.ts`. Subito sotto `const ANTHROPIC_API_URL = ...` (linea 10), aggiungere:

```ts
const LANG_NAMES = {
  it: 'italiano',
  en: 'English',
  es: 'español',
  fr: 'français',
  my: 'Burmese',
  zh: 'Chinese (Simplified)',
} as const;
type LangCode = keyof typeof LANG_NAMES;

function normalizzaLingua(raw: unknown): LangCode {
  return typeof raw === 'string' && raw in LANG_NAMES ? (raw as LangCode) : 'it';
}

function istruzioneLingua(lang: LangCode): string {
  return `\n\nIMPORTANT: Respond entirely in ${LANG_NAMES[lang]}, regardless of the document's original language. All headings, labels, summary text, exclusion descriptions, recommendations, and tool field values must be in ${LANG_NAMES[lang]}.`;
}
```

- [ ] **Step 2: Estendere il tipo del payload**

Trovare la dichiarazione del payload (linea 133):

```ts
let payload: { documento_base64?: string; mime?: string; sinistro_testo?: string };
```

Sostituire con:

```ts
let payload: { documento_base64?: string; mime?: string; sinistro_testo?: string; lingua?: string };
```

- [ ] **Step 3: Estrarre la lingua e iniettarla nel system prompt**

Subito dopo `const sinistroTesto = ...` (intorno linea 142) aggiungere:

```ts
const lingua = normalizzaLingua(payload.lingua);
```

Poi nella `body: JSON.stringify({...})` della fetch (linea 172-186) cambiare il campo `system`:

Da:
```ts
system: sinistroTesto ? SYS_CON_SINISTRO : SYS_BASE,
```

A:
```ts
system: (sinistroTesto ? SYS_CON_SINISTRO : SYS_BASE) + istruzioneLingua(lingua),
```

- [ ] **Step 4: Avviare il dev server e verificare in italiano (compat)**

Aprire un terminale e lanciare:

```bash
cd C:/Users/Stefano/sherlock-site
npm run dev
```

Attendere il messaggio `astro  v5.x.x ready in ... ms` e l'URL locale (tipicamente `http://localhost:4321`).

In un secondo terminale eseguire (Bash):

```bash
curl -s -X POST http://localhost:4321/api/analizza \
  -H "Content-Type: application/json" \
  -d '{"documento_base64":"JVBERi0xLjQKJeLjz9MKMSAwIG9iag==","mime":"application/pdf"}' \
  | head -c 400
```

Expected: risposta JSON con `{"error":"..."}` (PDF fake) **in italiano** — verifica della backward compat (nessun campo `lingua` → default IT). Se il PDF fake passa l'estrazione, va bene anche un errore Anthropic; conta solo che il messaggio risulti italiano.

- [ ] **Step 5: Verificare con lingua=fr**

Stesso `curl` con `"lingua":"fr"`:

```bash
curl -s -X POST http://localhost:4321/api/analizza \
  -H "Content-Type: application/json" \
  -d '{"documento_base64":"JVBERi0xLjQKJeLjz9MKMSAwIG9iag==","mime":"application/pdf","lingua":"fr"}' \
  | head -c 400
```

Expected: status 200 con report tradotto in francese (se il PDF è valido) oppure errore — l'importante è che la richiesta non venga rifiutata per `lingua` non riconosciuta. Per un test semantico più solido usare un PDF reale di test e verificare che `riepilogo` sia in francese.

- [ ] **Step 6: Verificare fallback con lingua sconosciuta**

```bash
curl -s -X POST http://localhost:4321/api/analizza \
  -H "Content-Type: application/json" \
  -d '{"documento_base64":"JVBERi0xLjQKJeLjz9MKMSAwIG9iag==","mime":"application/pdf","lingua":"xx"}' \
  | head -c 400
```

Expected: comportamento identico a Step 4 (fallback `it`). Nessun 400.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/Stefano/sherlock-site
git add src/pages/api/analizza.ts
git commit -m "feat(analizza): parametro lingua opzionale (default it)

Whitelist {it,en,es,fr,my,zh}. Aggiunge istruzione esplicita
al system prompt per forzare la lingua di risposta. Compat: campo
omesso o non valido = italiano (nessuna regressione per app < 3.6)."
```

---

### Task 2: Backend — parametro `lingua` in `/api/lettera`

**Files:**
- Modify: `C:\Users\Stefano\sherlock-site\src\pages\api\lettera.ts` (linee 10-17, 53, 81-93)

**Interfaces:**
- Consumes: nessuna dipendenza diretta da Task 1 a livello di codice (le costanti vivono nel singolo file); a livello concettuale stessa whitelist e nomi lingua.
- Produces: endpoint POST `/api/lettera` che accetta `body.lingua` opzionale (default `it`) e genera lettera reclamo/IVASS/diffida nella lingua richiesta.

- [ ] **Step 1: Aggiungere costanti e helper duplicati (DRY locale, no shared util)**

Aprire `src/pages/api/lettera.ts`. Subito dopo `const ANTHROPIC_API_URL = ...` (linea 8), aggiungere lo stesso blocco di Task 1:

```ts
const LANG_NAMES = {
  it: 'italiano',
  en: 'English',
  es: 'español',
  fr: 'français',
  my: 'Burmese',
  zh: 'Chinese (Simplified)',
} as const;
type LangCode = keyof typeof LANG_NAMES;

function normalizzaLingua(raw: unknown): LangCode {
  return typeof raw === 'string' && raw in LANG_NAMES ? (raw as LangCode) : 'it';
}

function istruzioneLingua(lang: LangCode): string {
  return `\n\nIMPORTANT: Write the entire letter in ${LANG_NAMES[lang]}, including the header ("Città", "Data"), the salutation, body, legal references (translate Italian law article names), and signature line.`;
}
```

Nota: l'istruzione è leggermente diversa rispetto ad `analizza.ts` perché qui è una lettera formale, non un report. Mantenere i due blocchi separati invece di estrarli in `lib/`.

- [ ] **Step 2: Estendere il tipo del payload**

Trovare (linea 53):

```ts
let payload: { analisi?: any; tipo?: string; extra?: string };
```

Sostituire con:

```ts
let payload: { analisi?: any; tipo?: string; extra?: string; lingua?: string };
```

- [ ] **Step 3: Estrarre la lingua e concatenarla al system prompt**

Subito dopo `const { analisi, tipo, extra } = payload;` (linea 61) aggiungere:

```ts
const lingua = normalizzaLingua(payload.lingua);
```

Poi trovare:

```ts
const system = LSYS[tipo] ?? LSYS.reclamo;
```

(linea 81) e cambiare in:

```ts
const system = (LSYS[tipo] ?? LSYS.reclamo) + istruzioneLingua(lingua);
```

- [ ] **Step 4: Verificare con curl in spagnolo**

Prerequisito: env `PRO_CODES` o KV con almeno un codice Pro valido in dev (vedi `.env.local`). Sostituire `SHK-XXXX-XXXX` con un codice valido:

```bash
curl -s -X POST http://localhost:4321/api/lettera \
  -H "Content-Type: application/json" \
  -H "x-pro-code: SHK-XXXX-XXXX" \
  -d '{"analisi":{"compagnia":"Test","tipo_polizza":"RC Auto","rischio":"ALTO","riepilogo":"test","esclusioni_critiche":[],"base_legale_contestabile":[]},"tipo":"reclamo","lingua":"es"}'
```

Expected: JSON `{"lettera":"..."}` con corpo lettera in **spagnolo** (intestazione "Ciudad / Fecha", saluti formali in spagnolo).

- [ ] **Step 5: Verificare backward-compat senza campo `lingua`**

Stesso `curl` senza `"lingua":"es"`:

```bash
curl -s -X POST http://localhost:4321/api/lettera \
  -H "Content-Type: application/json" \
  -H "x-pro-code: SHK-XXXX-XXXX" \
  -d '{"analisi":{"compagnia":"Test","tipo_polizza":"RC Auto","rischio":"ALTO","riepilogo":"test","esclusioni_critiche":[],"base_legale_contestabile":[]},"tipo":"reclamo"}'
```

Expected: lettera in italiano (compat).

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/lettera.ts
git commit -m "feat(lettera): parametro lingua opzionale (default it)

Stessa whitelist e helper di /api/analizza. Lettera scritta
integralmente nella lingua richiesta, incluse intestazione e
riferimenti normativi (tradotti)."
```

---

### Task 3: Sito — componente `LangSwitcher.astro` + integrazione header

**Files:**
- Create: `C:\Users\Stefano\sherlock-site\src\components\LangSwitcher.astro`
- Modify: `C:\Users\Stefano\sherlock-site\src\components\Header.astro` (aggiungo `<LangSwitcher />`)

**Interfaces:**
- Consumes: nessuna (Task 4 dipenderà dal cookie `googtrans` letto da questo componente)
- Produces: componente Astro che renderizza 6 bottoni bandiera, imposta cookie `googtrans=/it/<codice>` al click e ricarica la pagina; legge il cookie corrente per evidenziare la bandiera attiva.

- [ ] **Step 1: Creare `LangSwitcher.astro`**

Creare `src/components/LangSwitcher.astro` con il contenuto:

```astro
---
const lingue = [
  { code: 'it', google: '', flag: '🇮🇹', name: 'Italiano' },
  { code: 'en', google: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'es', google: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'fr', google: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'my', google: 'my', flag: '🇲🇲', name: 'မြန်မာ' },
  { code: 'zh', google: 'zh-CN', flag: '🇨🇳', name: '中文' },
];
---
<div class="flex items-center gap-1 notranslate" translate="no" id="lang-switcher" aria-label="Selezione lingua">
  {lingue.map(({ code, google, flag, name }) => (
    <button
      type="button"
      data-lang={code}
      data-google={google}
      title={name}
      aria-label={name}
      class="text-lg leading-none px-1.5 py-1 rounded opacity-50 hover:opacity-100 transition border border-transparent"
    >{flag}</button>
  ))}
</div>

<script is:inline>
(function(){
  function getCookie(name){
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setGoogTrans(googleCode){
    var host = location.hostname;
    var value = googleCode ? '/it/' + googleCode : '/it/it';
    // Cookie sia su host nudo sia con prefisso . per coprire subdomini Vercel
    document.cookie = 'googtrans=' + value + ';path=/;max-age=' + (60*60*24*365);
    if (host && host.indexOf('.') !== -1) {
      document.cookie = 'googtrans=' + value + ';path=/;domain=.' + host + ';max-age=' + (60*60*24*365);
    }
  }
  function currentLang(){
    var c = getCookie('googtrans');
    if (!c || c === '/it/it') return 'it';
    var m = c.match(/^\/it\/(.+)$/);
    if (!m) return 'it';
    var g = m[1];
    return g === 'zh-CN' ? 'zh' : g;
  }
  function highlight(){
    var active = currentLang();
    document.querySelectorAll('#lang-switcher button').forEach(function(btn){
      var on = btn.getAttribute('data-lang') === active;
      btn.style.opacity = on ? '1' : '0.5';
      btn.style.borderColor = on ? 'rgb(250 204 21)' : 'transparent';
    });
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('#lang-switcher button');
    if (!btn) return;
    setGoogTrans(btn.getAttribute('data-google'));
    location.reload();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', highlight);
  } else {
    highlight();
  }
})();
</script>
```

- [ ] **Step 2: Integrare in `Header.astro`**

Aprire `src/components/Header.astro`. Sostituire l'intero file con:

```astro
---
import LangSwitcher from './LangSwitcher.astro';
---
<header class="sticky top-0 z-50 bg-navy-950/85 backdrop-blur-md border-b border-navy-800">
  <div class="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
    <a href="/" class="flex items-center gap-2 group notranslate" translate="no">
      <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center group-hover:scale-105 transition">
        <svg viewBox="0 0 24 24" class="w-5 h-5 text-navy-900" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="16" y1="16" x2="21" y2="21" />
        </svg>
      </div>
      <div>
        <div class="font-extrabold text-white tracking-tight leading-none">Sherlock</div>
        <div class="text-[10px] uppercase tracking-widest text-navy-400 leading-none">Detective Polizze</div>
      </div>
    </a>

    <nav class="hidden md:flex items-center gap-6 text-sm text-navy-300">
      <a href="/" class="hover:text-white transition">Home</a>
      <a href="/guide" class="hover:text-white transition">Guide</a>
      <a href="/abbonati" class="hover:text-white transition">Abbonamento</a>
    </nav>

    <div class="flex items-center gap-3">
      <LangSwitcher />
      <a
        href="/abbonati"
        class="bg-gold-400 text-navy-900 font-bold text-sm px-4 py-2 rounded-lg hover:bg-gold-300 transition shadow-lg shadow-gold-400/20"
      >
        Abbonati
      </a>
    </div>
  </div>
</header>
```

Le modifiche rispetto all'originale:
- import `LangSwitcher`;
- `gap-4` aggiunto al flex container per evitare collisioni;
- brand wrappato in `notranslate translate="no"`;
- bottone "Abbonati" + switcher raggruppati a destra in un `<div>`.

- [ ] **Step 3: Verificare visivamente con dev server**

Se `npm run dev` è già attivo, ricaricare. Altrimenti lanciarlo.

Aprire `http://localhost:4321/` nel browser. Expected:
- Header mostra logo a sinistra, nav al centro, 6 bandierine + bottone Abbonati a destra.
- Su mobile (viewport < 768px) le bandierine restano visibili (il nav `hidden md:flex` sparisce, il resto sì).
- Click su 🇬🇧 → la pagina ricarica; tornare a 🇮🇹 → ricarica e torna in italiano.

In questa fase Google Translate non è ancora attivo (Task 4), quindi il click cambia solo il cookie ma il testo non si traduce. Verificare in DevTools → Application → Cookies che `googtrans=/it/en` venga settato e che la bandierina UK sia evidenziata (opacità 1 + bordo giallo) al ricarico.

- [ ] **Step 4: Commit**

```bash
git add src/components/LangSwitcher.astro src/components/Header.astro
git commit -m "feat(site): LangSwitcher con 6 bandiere nell'header

Imposta cookie googtrans={code} al click e ricarica. Evidenzia
la lingua attiva con bordo gold-400. Brand 'Sherlock' marcato
notranslate. La traduzione effettiva arriva nella prossima task
con l'integrazione del widget Google Translate."
```

---

### Task 4: Sito — widget Google Translate in `BaseLayout` + esclusione admin

**Files:**
- Modify: `C:\Users\Stefano\sherlock-site\src\layouts\BaseLayout.astro` (aggiunta script + CSS + container)
- Modify: `C:\Users\Stefano\sherlock-site\src\pages\admin\*.astro` (aggiunta `translate="no"` sui contenuti admin)

**Interfaces:**
- Consumes: cookie `googtrans` impostato dal `LangSwitcher` (Task 3).
- Produces: pagine non-admin tradotte runtime nella lingua scelta; pagine admin sempre in italiano.

- [ ] **Step 1: Aggiungere widget e CSS nel BaseLayout**

Aprire `src/layouts/BaseLayout.astro`. Dentro `<head>`, subito prima di `{jsonLd.map(...)}` (linea 68), aggiungere:

```astro
  <!-- Google Translate widget (caricato solo se cookie googtrans presente) -->
  <style is:global>
    .skiptranslate { display: none !important; }
    body { top: 0 !important; }
    font.translated-ltr, font.translated-rtl { background: transparent !important; box-shadow: none !important; }
  </style>
  <script is:inline>
    (function(){
      // Carica il widget solo se l'utente ha scelto una lingua != it
      var c = document.cookie.match(/(?:^|; )googtrans=([^;]*)/);
      if (!c) return;
      var v = decodeURIComponent(c[1]);
      if (!v || v === '/it/it') return;
      window.googleTranslateElementInit = function(){
        new google.translate.TranslateElement({
          pageLanguage: 'it',
          includedLanguages: 'en,es,fr,my,zh-CN',
          layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        }, 'google_translate_element');
      };
      var s = document.createElement('script');
      s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      s.async = true;
      document.head.appendChild(s);
    })();
  </script>
```

Sempre nel `<body>` (linea 72), subito dopo `<body class="...">`, aggiungere il container nascosto:

```astro
  <div id="google_translate_element" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true"></div>
```

- [ ] **Step 2: Escludere le pagine admin**

Aprire ognuna delle pagine sotto `src/pages/admin/`. Su ogni pagina aggiungere `translate="no"` all'elemento radice del contenuto.

Listare i file:

```bash
ls C:/Users/Stefano/sherlock-site/src/pages/admin/
```

Per ognuno, individuare il primo `<div>` o `<section>` di pagina (subito dopo `<BaseLayout>` o equivalente) e aggiungere `translate="no" class="notranslate"`. Esempio:

```astro
<BaseLayout title="..." description="...">
  <Header slot="header" />
  <section class="notranslate" translate="no">
    ...
  </section>
</BaseLayout>
```

In alternativa, se l'admin ha un proprio layout (es. `AdminLayout.astro`), aggiungere `translate="no"` una sola volta sul `<body>` o sul wrapper principale di quel layout.

- [ ] **Step 3: Marcare elementi tecnici notranslate**

Cercare nelle pagine pubbliche occorrenze di:
- pattern `SHK-` (codici Pro)
- brand standalone "Sherlock" usato come nome marchio (NON nel testo libero come "Sherlock analizza ...")

Usare grep:

```bash
cd C:/Users/Stefano/sherlock-site
grep -rn "SHK-" src/pages src/components 2>&1 | head
```

Per ogni occorrenza tipografica del codice (es. `<code>SHK-XXXX-XXXX</code>`), aggiungere classe `notranslate`. Esempio:

```astro
<code class="notranslate" translate="no">SHK-AB12-CD34</code>
```

Saltare le occorrenze nei commenti, nelle stringhe TypeScript o nelle costanti di logica.

- [ ] **Step 4: Verificare end-to-end in browser**

`npm run dev` attivo. Aprire `http://localhost:4321/`:

1. Click bandiera 🇬🇧 → pagina ricarica, titolo H1 e copy passano in inglese. Banner Google in alto NON visibile (CSS `skiptranslate { display:none }`).
2. Click 🇲🇲 → testo in birmano. Caratteri visualizzati correttamente (font fallback del browser; se illeggibili, accettabile per MVP).
3. Click 🇨🇳 → cinese semplificato.
4. Click 🇮🇹 → cookie `googtrans=/it/it`, ricarica, italiano restaurato, widget Google non caricato (script non aggiunto).
5. Navigare a `/abbonati` con lingua EN attiva → la traduzione persiste (cookie su `path=/`).
6. Aprire `/admin` (anche se chiede login, basta vedere la pagina di login) → testo italiano anche con lingua EN nel cookie.
7. Verificare che codici di esempio tipo `SHK-XXXX-XXXX` non vengano tradotti.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/admin
git commit -m "feat(site): widget Google Translate runtime su pagine pubbliche

Il widget viene caricato lazy solo se il cookie googtrans è
impostato (≠ italiano). Banner Google nascosto via CSS.
Pagine admin marcate translate=no per restare in italiano.
Codici Pro SHK-* marcati notranslate."
```

---

### Task 5: App — barra bandiere, dizionario I18N e `applyLang`

**Files:**
- Modify: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\assets\www\index.html`

**Interfaces:**
- Consumes: nulla (file monolitico, contesto interno)
- Produces:
  - variabile globale `currentLang` (`'it'|'en'|'es'|'fr'|'my'|'zh'`)
  - funzione `applyLang(code)` che aggiorna i `textContent`/`placeholder` dei nodi con `data-i18n` e salva in `localStorage.sherlockLang`
  - barra di 6 bottoni bandiera in cima ad ogni schermata, con la bandiera attiva evidenziata.

- [ ] **Step 1: Aggiungere CSS della barra bandiere**

Aprire `index.html`. Nel blocco `<style>` (intorno linea 11+), prima della chiusura `</style>` (cercare l'ultima regola CSS e aggiungere dopo):

```css
.lang-bar{display:flex;justify-content:center;gap:6px;padding:8px 10px 6px;background:rgba(7,11,24,.7);border-bottom:1px solid var(--border);flex-shrink:0;}
.lang-btn{background:transparent;border:1px solid transparent;border-radius:8px;padding:4px 8px;font-size:1.15rem;line-height:1;opacity:.5;cursor:pointer;transition:all .15s;}
.lang-btn.active{opacity:1;border-color:var(--amber);box-shadow:0 0 8px rgba(251,191,36,.4);}
.lang-btn:active{transform:scale(.92);}
```

- [ ] **Step 2: Aggiungere markup della barra bandiere dentro `#app`**

Trovare il container `#app` (linea 33-36: `#app{position:fixed;inset:0;...}`). Subito DENTRO `<div id="app">` (cercare il tag nell'HTML body — è il primo figlio del `<body>`), come PRIMO figlio aggiungere:

```html
<div class="lang-bar" id="lang-bar" role="toolbar" aria-label="Lingua">
  <button class="lang-btn" data-lang="it" aria-label="Italiano">🇮🇹</button>
  <button class="lang-btn" data-lang="en" aria-label="English">🇬🇧</button>
  <button class="lang-btn" data-lang="es" aria-label="Español">🇪🇸</button>
  <button class="lang-btn" data-lang="fr" aria-label="Français">🇫🇷</button>
  <button class="lang-btn" data-lang="my" aria-label="Burmese">🇲🇲</button>
  <button class="lang-btn" data-lang="zh" aria-label="中文">🇨🇳</button>
</div>
```

Nota: la `lang-bar` è `flex-shrink:0` quindi non comprime il contenuto sottostante; le `screen` `.active` continuano a riempire lo spazio rimanente.

- [ ] **Step 3: Aggiungere costante `I18N` e variabile `currentLang`**

Trovare la sezione delle costanti (linea 642-648, dove c'è `BE_BASE`, `APP_BUILD`, `S=...`). Subito PRIMA di `var APP_BUILD=45;` (linea 647), inserire:

```js
var I18N = {
  it: {
    splash_sub: 'DETECTIVE POLIZZE',
    nav_home: 'Home',
    nav_scan: 'Analizza',
    nav_settings: 'Impostazioni',
    btn_upload: 'Carica polizza',
    btn_camera: 'Scatta foto',
    btn_analyze: 'Avvia analisi',
    btn_generate_letter: 'Genera lettera di reclamo',
    placeholder_sinistro: 'Descrivi il sinistro (opzionale)...',
    placeholder_email: 'tua@email.it',
    placeholder_code: 'SHK-XXXX-XXXX',
    title_analysis: 'Analisi della polizza',
    title_settings: 'Impostazioni',
    title_pro: 'Sherlock Pro',
    label_compagnia: 'Compagnia',
    label_tipo: 'Tipo polizza',
    label_rischio: 'Rischio',
    label_riepilogo: 'Riepilogo',
    label_esclusioni: 'Esclusioni critiche',
    label_clausole: 'Clausole rischiose',
    label_termini: 'Termini di decadenza',
    label_raccomandazioni: 'Raccomandazioni',
    err_generic: 'Errore. Riprova.',
    err_no_doc: 'Carica prima un documento.',
    free_used: 'analisi gratuite usate',
    activate_pro: 'Attiva Pro',
    activate_email_btn: 'Attiva con email',
    activating: 'Attivazione in corso...',
  },
  en: {
    splash_sub: 'INSURANCE DETECTIVE',
    nav_home: 'Home', nav_scan: 'Analyze', nav_settings: 'Settings',
    btn_upload: 'Upload policy', btn_camera: 'Take photo',
    btn_analyze: 'Start analysis', btn_generate_letter: 'Generate complaint letter',
    placeholder_sinistro: 'Describe the incident (optional)...',
    placeholder_email: 'your@email.com', placeholder_code: 'SHK-XXXX-XXXX',
    title_analysis: 'Policy analysis', title_settings: 'Settings', title_pro: 'Sherlock Pro',
    label_compagnia: 'Company', label_tipo: 'Policy type', label_rischio: 'Risk',
    label_riepilogo: 'Summary', label_esclusioni: 'Critical exclusions',
    label_clausole: 'Risky clauses', label_termini: 'Deadlines',
    label_raccomandazioni: 'Recommendations',
    err_generic: 'Error. Please retry.', err_no_doc: 'Upload a document first.',
    free_used: 'free analyses used', activate_pro: 'Activate Pro',
    activate_email_btn: 'Activate with email', activating: 'Activating...',
  },
  es: {
    splash_sub: 'DETECTIVE DE PÓLIZAS',
    nav_home: 'Inicio', nav_scan: 'Analizar', nav_settings: 'Ajustes',
    btn_upload: 'Subir póliza', btn_camera: 'Tomar foto',
    btn_analyze: 'Iniciar análisis', btn_generate_letter: 'Generar carta de reclamación',
    placeholder_sinistro: 'Describe el siniestro (opcional)...',
    placeholder_email: 'tu@email.es', placeholder_code: 'SHK-XXXX-XXXX',
    title_analysis: 'Análisis de la póliza', title_settings: 'Ajustes', title_pro: 'Sherlock Pro',
    label_compagnia: 'Compañía', label_tipo: 'Tipo de póliza', label_rischio: 'Riesgo',
    label_riepilogo: 'Resumen', label_esclusioni: 'Exclusiones críticas',
    label_clausole: 'Cláusulas arriesgadas', label_termini: 'Plazos',
    label_raccomandazioni: 'Recomendaciones',
    err_generic: 'Error. Inténtalo de nuevo.', err_no_doc: 'Sube un documento primero.',
    free_used: 'análisis gratuitos usados', activate_pro: 'Activar Pro',
    activate_email_btn: 'Activar con email', activating: 'Activando...',
  },
  fr: {
    splash_sub: 'DÉTECTIVE DES POLICES',
    nav_home: 'Accueil', nav_scan: 'Analyser', nav_settings: 'Paramètres',
    btn_upload: 'Téléverser la police', btn_camera: 'Prendre une photo',
    btn_analyze: "Lancer l'analyse", btn_generate_letter: 'Générer la lettre de réclamation',
    placeholder_sinistro: 'Décrivez le sinistre (facultatif)...',
    placeholder_email: 'votre@email.fr', placeholder_code: 'SHK-XXXX-XXXX',
    title_analysis: 'Analyse de la police', title_settings: 'Paramètres', title_pro: 'Sherlock Pro',
    label_compagnia: 'Compagnie', label_tipo: 'Type de police', label_rischio: 'Risque',
    label_riepilogo: 'Résumé', label_esclusioni: 'Exclusions critiques',
    label_clausole: 'Clauses risquées', label_termini: 'Délais',
    label_raccomandazioni: 'Recommandations',
    err_generic: 'Erreur. Réessayez.', err_no_doc: "Téléversez d'abord un document.",
    free_used: 'analyses gratuites utilisées', activate_pro: 'Activer Pro',
    activate_email_btn: 'Activer par email', activating: 'Activation en cours...',
  },
  my: {
    splash_sub: 'အာမခံ စုံစမ်းသူ',
    nav_home: 'ပင်မ', nav_scan: 'စိစစ်ရန်', nav_settings: 'ဆက်တင်များ',
    btn_upload: 'မူဝါဒ တင်ရန်', btn_camera: 'ဓာတ်ပုံ ရိုက်ရန်',
    btn_analyze: 'စိစစ်မှု စတင်ရန်', btn_generate_letter: 'တိုင်တန်းစာ ထုတ်ပေးရန်',
    placeholder_sinistro: 'ဖြစ်ရပ်ကို ဖော်ပြပါ (ရွေးချယ်ခွင့်)...',
    placeholder_email: 'oh@email.com', placeholder_code: 'SHK-XXXX-XXXX',
    title_analysis: 'မူဝါဒ ခွဲခြမ်းစိတ်ဖြာမှု', title_settings: 'ဆက်တင်များ', title_pro: 'Sherlock Pro',
    label_compagnia: 'ကုမ္ပဏီ', label_tipo: 'မူဝါဒ အမျိုးအစား', label_rischio: 'အန္တရာယ်',
    label_riepilogo: 'အကျဉ်းချုပ်', label_esclusioni: 'အရေးကြီး ဖယ်ထုတ်ချက်များ',
    label_clausole: 'အန္တရာယ်ရှိ စည်းကမ်းချက်များ', label_termini: 'အချိန်ကာလများ',
    label_raccomandazioni: 'အကြံပြုချက်များ',
    err_generic: 'အမှား ဖြစ်ပေါ်နေသည်။ ပြန်လည် စမ်းကြည့်ပါ။',
    err_no_doc: 'ဦးစွာ စာရွက်စာတမ်း တင်ပါ။',
    free_used: 'အခမဲ့ စိစစ်မှု အသုံးပြုပြီး',
    activate_pro: 'Pro ဖွင့်ရန်',
    activate_email_btn: 'အီးမေးလ်ဖြင့် ဖွင့်ရန်',
    activating: 'ဖွင့်နေသည်...',
  },
  zh: {
    splash_sub: '保单侦探',
    nav_home: '首页', nav_scan: '分析', nav_settings: '设置',
    btn_upload: '上传保单', btn_camera: '拍照',
    btn_analyze: '开始分析', btn_generate_letter: '生成投诉信',
    placeholder_sinistro: '描述事故（可选）...',
    placeholder_email: 'your@email.com', placeholder_code: 'SHK-XXXX-XXXX',
    title_analysis: '保单分析', title_settings: '设置', title_pro: 'Sherlock Pro',
    label_compagnia: '公司', label_tipo: '保单类型', label_rischio: '风险',
    label_riepilogo: '摘要', label_esclusioni: '关键除外条款',
    label_clausole: '风险条款', label_termini: '期限',
    label_raccomandazioni: '建议',
    err_generic: '出错了，请重试。', err_no_doc: '请先上传文档。',
    free_used: '次免费分析已用', activate_pro: '激活 Pro',
    activate_email_btn: '通过邮箱激活', activating: '激活中...',
  },
};
var currentLang = 'it';
```

- [ ] **Step 4: Aggiungere funzione `applyLang` e wire-up della barra**

Subito DOPO la dichiarazione di `var I18N = {...}; var currentLang = 'it';` aggiunti allo Step 3, inserire:

```js
function applyLang(code){
  if (!I18N[code]) code = 'it';
  currentLang = code;
  try { localStorage.setItem('sherlockLang', code); } catch(e){}
  var dict = I18N[code];
  // textContent
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    var key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  // attributi: data-i18n-attr="placeholder:placeholder_email"
  document.querySelectorAll('[data-i18n-attr]').forEach(function(el){
    el.getAttribute('data-i18n-attr').split(',').forEach(function(pair){
      var p = pair.split(':');
      if (p.length === 2 && dict[p[1]]) el.setAttribute(p[0], dict[p[1]]);
    });
  });
  // stato barra
  document.querySelectorAll('#lang-bar .lang-btn').forEach(function(btn){
    btn.classList.toggle('active', btn.getAttribute('data-lang') === code);
  });
  document.documentElement.setAttribute('lang', code);
}

document.addEventListener('click', function(e){
  var btn = e.target.closest && e.target.closest('#lang-bar .lang-btn');
  if (!btn) return;
  applyLang(btn.getAttribute('data-lang'));
});

(function initLang(){
  var saved = 'it';
  try { saved = localStorage.getItem('sherlockLang') || 'it'; } catch(e){}
  applyLang(saved);
})();
```

- [ ] **Step 5: Marcare i nodi DOM statici con `data-i18n`**

Usare grep per identificare i punti chiave:

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/assets/www"
grep -n "DETECTIVE POLIZZE\|Carica polizza\|Avvia analisi\|Genera lettera\|Impostazioni\|Esclusioni critiche\|Clausole rischiose\|Termini di decadenza\|Raccomandazioni\|analisi gratuite" index.html
```

Per ogni linea individuata, aggiungere `data-i18n="<chiave>"` al tag che contiene il testo. Le chiavi devono corrispondere a quelle di `I18N` (vedi Step 3). Esempi:

```html
<!-- prima -->
<div class="sp-sub">DETECTIVE POLIZZE</div>
<!-- dopo -->
<div class="sp-sub" data-i18n="splash_sub">DETECTIVE POLIZZE</div>
```

```html
<!-- prima -->
<button class="btn btn-gold btn-full" id="rb1">&#128221; Genera lettera di reclamo</button>
<!-- dopo -->
<button class="btn btn-gold btn-full" id="rb1" data-i18n="btn_generate_letter">📝 Genera lettera di reclamo</button>
```

Nota: il testo statico originale (italiano) viene perso al `applyLang('it')` perché viene sovrascritto. Mantenere la chiave `it` del dizionario sincronizzata con il copy originale italiano (incluse eventuali emoji nel testo).

Per i placeholder, usare `data-i18n-attr`:

```html
<input type="email" class="input" id="email-input" placeholder="tua@email.it"
       data-i18n-attr="placeholder:placeholder_email">
```

Coprire almeno tutti i testi nelle chiavi del dizionario. Per testi più dinamici (es. messaggi composti runtime) si itera nei prossimi passi.

- [ ] **Step 6: Verificare con browser desktop (file://)**

Per un test rapido senza Android, aprire il file `index.html` in Chrome:

```bash
start "" "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/assets/www/index.html"
```

Verifica:
- La barra delle 6 bandiere appare in cima.
- IT è attiva di default.
- Click su 🇬🇧: tutti i nodi `data-i18n` cambiano in inglese, IT perde il bordo e EN lo prende.
- Click su 🇲🇲: testo in birmano (font fallback Chrome).
- Reload pagina: la lingua scelta persiste (localStorage).

Nota: le fetch al backend daranno errore CORS perché aperte da `file://`, ignorabile a questo stadio (testato in Task 6).

- [ ] **Step 7: Commit (worktree non git — fare backup zip invece)**

La cartella `Sherlock app final/` in Downloads non è una repo git. Fare un backup zip prima di proseguire:

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final"
powershell -Command "Compress-Archive -Path 'sherlock_project_patched' -DestinationPath ('sherlock_project_pre_i18n_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.zip')"
```

(Eseguito da bash chiamando powershell). Verificare che lo zip esista (`ls *.zip`).

---

### Task 6: App — lingua nelle fetch, bump versione, build .aab

**Files:**
- Modify: `app/src/main/assets/www/index.html` (linee 786-788, 793, 647)
- Modify: `app/build.gradle` (linee 13-14)

**Interfaces:**
- Consumes: `currentLang` (globale dal Task 5), `applyLang` (per init).
- Produces: file `app/build/outputs/bundle/release/app-release.aab` pronto per Play Console.

- [ ] **Step 1: Aggiungere `lingua` al payload `doAnalyze`**

Trovare in `index.html` (linea 786):

```js
var body={documento_base64:b64,mime:mime};
if(sinistroTxt && sinistroTxt.trim())body.sinistro_testo=sinistroTxt.trim();
```

Sostituire con:

```js
var body={documento_base64:b64,mime:mime,lingua:currentLang};
if(sinistroTxt && sinistroTxt.trim())body.sinistro_testo=sinistroTxt.trim();
```

- [ ] **Step 2: Aggiungere `lingua` al payload `doLetter`**

Trovare (linea 793):

```js
return apicall(ENDP_LETTERA,"POST",hdrs,JSON.stringify({analisi:a,tipo:type,extra:extra||""})).then(...
```

Sostituire con:

```js
return apicall(ENDP_LETTERA,"POST",hdrs,JSON.stringify({analisi:a,tipo:type,extra:extra||"",lingua:currentLang})).then(...
```

- [ ] **Step 3: Bumpare `APP_BUILD`**

Trovare (linea 647):

```js
var APP_BUILD=45; // versionCode — bumpare quando si vuole resettare freeUsed
```

Sostituire con:

```js
var APP_BUILD=46; // versionCode — bumpare quando si vuole resettare freeUsed
```

- [ ] **Step 4: Bumpare `versionCode` e `versionName` in `build.gradle`**

Aprire `app/build.gradle`. Sostituire:

```gradle
        versionCode 45
        versionName '3.5'
```

con:

```gradle
        versionCode 46
        versionName '3.6'
```

- [ ] **Step 5: Build APK debug per side-load di verifica**

Da terminale (Bash o PowerShell):

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project"
./gradlew assembleDebug
```

Expected: build OK, output in `app/build/outputs/apk/debug/app-debug.apk`.

Installare sul telefono via ADB (USB debugging attivo):

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Avviare l'app. Verifiche:
1. Splash → home con barra bandiere visibile in alto.
2. IT attiva, testo italiano.
3. Tocca 🇫🇷 → tutto in francese, persistenza dopo restart.
4. Carica una polizza (PDF o foto), avvia analisi. Verifica che la risposta dell'AI sia in francese.
5. Tocca 🇲🇲 → genera nuova analisi → AI risponde in birmano.
6. Se Pro abilitato: genera lettera in spagnolo → testo lettera in spagnolo.

- [ ] **Step 6: Build .aab release**

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project"
./gradlew bundleRelease
```

Expected: build OK, output `app/build/outputs/bundle/release/app-release.aab`.

Copiare il file con nome versionato in Downloads per archivio:

```bash
cp app/build/outputs/bundle/release/app-release.aab "C:/Users/Stefano/Downloads/Sherlock-v3.6-vc46.aab"
```

- [ ] **Step 7: Backup zip post-modifica**

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final"
powershell -Command "Compress-Archive -Path 'sherlock_project_patched' -DestinationPath ('sherlock_project_v3.6_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.zip') -Force"
```

---

### Task 7: Deploy backend + sito su Vercel, verifica produzione

**Files:** (nessuno — operazioni di deploy)

**Interfaces:**
- Consumes: tutti i commit dei task 1-4 mergiati su `main`.
- Produces: backend e sito tradotti in produzione, app .aab pronta per upload Play Console.

- [ ] **Step 1: Push branch sito e deploy**

```bash
cd C:/Users/Stefano/sherlock-site
git push origin main
```

Vercel auto-deploya su push a `main`. Attendere la build (~1-2 min) e verificare nella dashboard Vercel che il deployment sia `Ready`.

- [ ] **Step 2: Smoke test produzione sito**

Aprire `https://sherlock-polizze-site-five.vercel.app/` in incognito. Ripetere i test di Task 4 Step 4 (cambio bandiera, persistenza tra pagine, admin in italiano).

- [ ] **Step 3: Smoke test produzione backend con curl**

```bash
curl -s -X POST https://sherlock-polizze-site-five.vercel.app/api/analizza \
  -H "Content-Type: application/json" \
  -d '{"documento_base64":"JVBERi0xLjQK","mime":"application/pdf","lingua":"en"}' \
  | head -c 200
```

Expected: errore JSON in inglese (PDF fake). Conferma che il campo `lingua` è gestito anche in produzione.

- [ ] **Step 4: Upload .aab su Play Console**

Apertura manuale browser:
1. `https://play.google.com/console` → app Sherlock → Produzione → Crea nuova release.
2. Caricare `C:/Users/Stefano/Downloads/Sherlock-v3.6-vc46.aab`.
3. Note di rilascio (max 500 caratteri per lingua, esempio inglese):
   > Added 5 languages (English, Spanish, French, Burmese, Chinese) selectable from the flag bar at the top. AI analysis responds in the chosen language.
4. Pubblicare in "Test interno" o "Produzione" secondo preferenza.

- [ ] **Step 5: Verifica post-pubblicazione (24-48h dopo)**

Dopo che la release è disponibile sul Play Store:
1. Aggiornare l'app dal telefono.
2. Avviare → verificare che `freeUsed=0` (effetto del bump `APP_BUILD`).
3. Cambio lingua + analisi → tutto funzionante in produzione.

---

## Self-review (eseguito dall'autore del piano)

**Spec coverage:**
- ✅ Selettore bandierine sito → Task 3
- ✅ Widget Google Translate → Task 4
- ✅ Esclusione admin / notranslate codici → Task 4
- ✅ Barra bandiere app → Task 5
- ✅ Dizionario stringhe app → Task 5
- ✅ Persistenza localStorage → Task 5
- ✅ Lingua nel body fetch → Task 6
- ✅ Backend `lingua` → Task 1-2
- ✅ Bump versione + build .aab → Task 6
- ✅ Deploy + verifica produzione → Task 7

**Placeholder scan:** nessun TBD/TODO; ogni step contiene codice o comando concreto.

**Type consistency:** `LangCode` ed `I18N` chiavi coerenti tra task; `currentLang` referenziato in Task 5 (definito) e Task 6 (consumato).

**Scope:** focalizzato su una sola feature (multilingua) divisa in 7 task indipendentemente verificabili.
