# Sherlock v4.2 — Confronto polizze + pre-splash Android

**Data**: 2026-06-29
**Versione app target**: 4.2 (versionCode 52)
**Scope**: 2 cambiamenti coordinati per la stessa release
1. Nuova feature backend+frontend "Compara polizze" (Pro only)
2. Immagine pre-splash 4 secondi all'avvio app Android

---

## 1. Architettura

```
[App Android v4.2]                            [sherlock-site su Vercel]
┌───────────────────────────────┐             ┌───────────────────────────────┐
│ MainActivity.java             │             │ src/pages/api/compara.ts      │
│  ├─ ImageView (pre-splash 4s) │   HTTPS     │  ├─ valuta codice Pro         │
│  │  ├─ tap → fade-out         │ ──────────▶ │  ├─ chiama Anthropic con      │
│  │  └─ overlay rimosso a 4s   │ POST JSON   │  │   2 PDF in input + tool    │
│  └─ WebView                   │ {polizzaA,B │  ├─ loggaEvento(tipo:compara) │
│     └─ assets/www/index.html  │  ,codice}   │  └─ ritorna report JSON       │
│        ├─ screen-splash       │             │                               │
│        ├─ screen-home         │             │ src/lib/log.ts                │
│        ├─ screen-analisi      │             │  └─ tipo allargato a          │
│        ├─ screen-lettera      │             │     'analizza'|'lettera'|     │
│        └─ screen-compara      │             │     'compara'                 │
│           ├─ slot polizza A   │             │                               │
│           ├─ slot polizza B   │             │ Dashboard /admin              │
│           ├─ btn Confronta    │             │  └─ nuova card                │
│           └─ render risultato │             │     'Richieste compara'       │
│              da JSON          │             │                               │
└───────────────────────────────┘             └───────────────────────────────┘
                                              + drawables: pre_splash.png in
                                                res/drawable-nodpi/
```

**File toccati**:

| File | Tipo |
|---|---|
| `sherlock-site/src/pages/api/compara.ts` | NUOVO |
| `sherlock-site/src/lib/log.ts` | MODIFICATO (estensione tipo `EventoAPI['tipo']` + 4 campi in `StatsAPI`) |
| `sherlock-site/src/pages/admin/index.astro` | MODIFICATO (nuova card "Richieste compara" + breakdown a 3) |
| `sherlock-site/src/lib/auth.ts` | LETTURA (riuso `valutaCodice`/`getModel`/`getAnthropicKey`) |
| `sherlock-app/.../MainActivity.java` | MODIFICATO (overlay pre-splash ~30 righe additive) |
| `sherlock-app/.../res/drawable-nodpi/pre_splash.png` | NUOVO |
| `sherlock-app/.../res/values/colors.xml` | NUOVO (`pre_splash_bg`) |
| `sherlock-app/.../assets/www/index.html` | MODIFICATO (nuovo screen `screen-compara` + entry point in home) |
| `sherlock-app/.../app/build.gradle` | MODIFICATO (`versionCode 52`, `versionName '4.2'`) |

---

## 2. Schema dati output `/api/compara`

Forzato via Anthropic `tool_use` con `tool_choice: { type: 'tool', name: 'report_confronto_polizze' }` → output garantito conforme, niente parser fragile (stesso pattern di `analizza.ts`).

```ts
type ReportConfronto = {
  polizze: [
    { etichetta: 'A' | 'B'; compagnia: string; tipo_polizza: string; numero_polizza?: string },
    { etichetta: 'A' | 'B'; compagnia: string; tipo_polizza: string; numero_polizza?: string }
  ];
  // Catturato dall'AI quando i tipi sono incompatibili (auto vs casa) → tutti
  // gli altri campi possono essere minimi/vuoti, ma questo spiega all'utente.
  avviso_compatibilita: string | null;

  // Top dell'UI: tabella sintetica con righe scelte dall'AI.
  tabella_sintesi: Array<{
    aspetto: string;            // es. "Massimale RC", "Furto incluso", "Franchigia"
    valore_a: string;           // "€ 500.000" | "Sì" | "€ 250 per sinistro"
    valore_b: string;
    vantaggio: 'a' | 'b' | 'pari' | 'non_confrontabile';
  }>;

  // Sezioni espandibili dell'UI
  differenze_chiave: Array<{
    titolo: string;
    descrizione: string;
    impatto: 'alto' | 'medio' | 'basso';
    vantaggio: 'a' | 'b';
  }>;
  esclusioni_solo_a: Array<{ titolo: string; descrizione: string; gravita: 'alta' | 'media' | 'bassa' }>;
  esclusioni_solo_b: Array<{ titolo: string; descrizione: string; gravita: 'alta' | 'media' | 'bassa' }>;
  coperture_solo_a: Array<{ titolo: string; descrizione: string }>;
  coperture_solo_b: Array<{ titolo: string; descrizione: string }>;

  // Verdetto finale — sempre presente, 'dipende' è opzione valida.
  verdetto: {
    raccomandazione: 'a' | 'b' | 'dipende';
    motivazione: string;          // 2-4 frasi
    caveat: string;               // disclaimer obbligatorio
    quando_scegliere_a: string;   // 1 frase: profilo per cui A è migliore
    quando_scegliere_b: string;
  };
};
```

**Note di design**:
- `etichetta: 'A' | 'B'` è ridondante coi posti dell'array ma rende il JSON auto-descrittivo se serializzato fuori contesto.
- `vantaggio: 'non_confrontabile'` cattura righe con valore presente in A ma assente in B → UI mostra "—" invece di rosso/verde.
- `raccomandazione: 'dipende'` esplicitamente prevista per evitare overconfidence del modello quando i pro/contro si bilanciano in modo dipendente dal profilo utente.
- `caveat` è campo separato per essere sempre renderizzato come box grigio sotto al verdetto, indipendentemente dal sentiment.
- Nessuna persistenza server-side: il JSON torna al client e basta (come `analizza` attuale). Per "rivedere il confronto" → caching client-side in `sessionStorage`.

---

## 3. Flusso utente (WebView)

```
HOME → tap [⚖️ Confronta 2 polizze] → SCREEN-COMPARA (stato 'vuoto')
                                          │
                                          │ utente carica A e B via file picker
                                          ▼
                                       stato 'pronto' → tap [Confronta polizze]
                                          │
                                          ▼
                              Check Pro client-side (codice in localStorage)
                                  │                      │
                                  NO                     SÌ
                                  │                      │
                                  ▼                      ▼
                          modal "Funzione Pro"   stato 'loading' (~30-40s, abort possibile)
                          + link /abbonamento           │
                                                        ▼
                                              stato 'risultato'
                                                  • avviso compatibilità (se non-null)
                                                  • box verdetto + caveat
                                                  • tabella sintesi
                                                  • 4 sezioni espandibili
                                                  • azioni: [Condividi] [Nuovo confronto]
```

**Stati**: `vuoto` → `parziale` (1 PDF) → `pronto` (2 PDF) → `loading` → `risultato | errore`.

**Touch point col codice esistente**:
- File picker: già esposto da `MainActivity.onShowFileChooser` (accetta `application/pdf` e immagini) → nessuna modifica nativa per questa parte.
- Check Pro + modal paywall: identico a `screen-lettera`. Validazione server-side via `valutaCodice` (`src/lib/auth.ts`).
- Loader animato + barra: già presente in `screen-analisi` → estratto in componente CSS+JS riusabile dentro `index.html`.
- Condividi: `Android.shareText(text, subject)` già esposto dal bridge → si passa un riassunto markdown del verdetto + tabella.
- Back button: `webView.canGoBack()` già gestito in `MainActivity.onBackPressed` → torna a `screen-home`.

---

## 4. Prompt AI + chiamata Anthropic

```ts
// src/pages/api/compara.ts — estratto richiesta a Anthropic
const SYS = (
  'Sei Sherlock, esperto analista di polizze assicurative italiane ' +
  '(d.lgs. 209/2005, artt. 1882-1932 c.c., normativa IVASS). ' +
  'Ti vengono fornite DUE polizze etichettate "Polizza A" e "Polizza B". ' +
  'Confronta condizioni, coperture, esclusioni, massimali, franchigie e clausole, ' +
  'evidenziando solo le differenze rilevanti per la scelta. ' +
  'Compila lo schema report_confronto_polizze in modo esaustivo. ' +
  'Se le polizze sono di tipologie diverse (es. una auto e una casa) ' +
  'imposta avviso_compatibilita e lascia gli altri campi minimi. ' +
  'Sii imparziale: la raccomandazione "dipende" è una conclusione legittima ' +
  'quando i pro/contro si bilanciano in modo dipendente dal profilo utente. ' +
  'Caveat OBBLIGATORIO: scrivi sempre nel campo caveat che la valutazione è ' +
  'algoritmica e non sostituisce un parere professionale.'
);

const body = {
  model: getModel(),                    // Haiku 4.5 (riuso analizza)
  max_tokens: 8000,
  system: SYS + istruzioneLingua(lang),
  tools: [{
    name: 'report_confronto_polizze',
    description: 'Restituisce il confronto strutturato fra le due polizze',
    input_schema: SCHEMA_CONFRONTO,
  }],
  tool_choice: { type: 'tool', name: 'report_confronto_polizze' },
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Polizza A (file allegato di seguito):' },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfA_b64 } },
      { type: 'text', text: 'Polizza B (file allegato di seguito):' },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB_b64 } },
      { type: 'text', text: 'Confronta le due polizze e chiama il tool con l\'analisi.' },
    ],
  }],
};
```

**Decisioni di prompt**:
- `tool_choice` forzato → output sempre conforme allo schema.
- Caveat ridondato (system prompt + schema `required`) per non perderlo.
- Imparzialità + legittimità di "dipende" esplicite per evitare verdetti forzati quando i dati non li giustificano.
- Multilingua via `istruzioneLingua(lang)`, stesso pattern di `analizza.ts`. Default `'it'`.
- Modello: `getModel()` → Haiku 4.5. Costo stimato ~$0.04-0.08 per confronto (vs ~$0.02 per analisi singola).

**Input dal client**:
```ts
type ReqCompara = {
  polizzaA: string;  // base64 PDF, max 20MB per file
  polizzaB: string;
  codice: string;    // codice Pro
  lang?: 'it' | 'en' | 'es' | 'fr' | 'my' | 'zh';
};
```

**Vincoli operativi**:
- `maxDuration = 300` (cap Vercel Hobby+Fluid Compute, stesso di `analizza`).
- 20 MB per PDF, 35 MB body totale.
- Validazione magic byte (`%PDF-`) prima della chiamata Anthropic per fallire fast su file non validi.

---

## 5. Pre-splash Android

**Risorse**:
- `app/src/main/res/drawable-nodpi/pre_splash.png` ← immagine fornita dall'utente (Sherlock illustrazione con testo). `drawable-nodpi/` per non scalarla per densità: una sola copia, `scaleType="centerCrop"` a runtime.
- `app/src/main/res/values/colors.xml` (nuovo): `<color name="pre_splash_bg">#070b18</color>`.

**Modifica `MainActivity.java`** (~30 righe additive, dopo `setContentView(root)` e prima di `webView.loadUrl(...)`):

```java
final ImageView preSplash = new ImageView(this);
preSplash.setImageResource(R.drawable.pre_splash);
preSplash.setScaleType(ImageView.ScaleType.CENTER_CROP);
preSplash.setBackgroundColor(BG);
preSplash.setClickable(true);       // intercetta tap, non passa alla WebView sotto
root.addView(preSplash, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT));

// La WebView carica in background SOTTO l'overlay: quando l'utente vede sparire
// la pre-splash, lo splash HTML è già renderizzato → niente flash bianco.
webView.loadUrl("file:///android_asset/www/index.html");

final Runnable removeOverlay = new Runnable() {
    @Override public void run() {
        if (preSplash.getParent() == null) return;  // idempotenza: già rimosso
        preSplash.animate()
            .alpha(0f)
            .setDuration(350)
            .withEndAction(new Runnable() {
                @Override public void run() { root.removeView(preSplash); }
            })
            .start();
    }
};
preSplash.setOnClickListener(new View.OnClickListener() {
    @Override public void onClick(View v) { removeOverlay.run(); }
});
preSplash.postDelayed(removeOverlay, 4000);
```

**Decisioni**:
- **Overlay nello stesso `FrameLayout` esistente**, non SplashActivity → nessun cambio al manifest, nessun Intent, nessun flash di transizione.
- **WebView carica in parallelo dietro l'overlay** → quando il fade termina, lo splash HTML è già visibile. UX percepita molto più liscia di "splash nativo → schermata nera → splash WebView".
- **Idempotenza tap-vs-timer**: `getParent() == null` check evita doppia animazione se tap e timeout coincidono. `setClickable(true)` evita che il tap passi alla WebView sotto.
- **Fade 350ms** non aggiunge tempo percepito ma toglie lo stacco brutto.
- **`drawable-nodpi/`** invece di `drawable-xxhdpi/` perché l'immagine 1024×~1820 è grande abbastanza per qualunque schermo: una copia anziché 4-5 duplicate.

**Bump versione `app/build.gradle`**:
```gradle
versionCode 52       // era 51
versionName '4.2'    // era '4.1'
```

---

## 6. Errori, logging, analytics, testing

### Gestione errori

| Livello | Caso | Esito |
|---|---|---|
| Client (WebView) | PDF > 20 MB | bloccato in JS, toast "PDF troppo grande" — niente chiamata |
| Client (WebView) | <2 PDF caricati | bottone "Confronta" disabilitato |
| Client (WebView) | abort utente (loading) | `controller.abort()` — niente evento logato |
| Server validazione | body > 35 MB | 413, `traccia('bloccato', 'body_too_large')` |
| Server validazione | manca `polizzaA`/`polizzaB`/`codice` | 400, `traccia('bloccato', 'missing_field')` |
| Server validazione | PDF magic byte assente | 400, `traccia('bloccato', 'invalid_pdf')` |
| Server auth | `valutaCodice` invalido/scaduto | 402 + body `{ paywall: true }`, `traccia('bloccato', 'no_pro')` — client mostra modal abbonamento |
| Server AI | Anthropic 5xx / timeout | 502, 1 retry automatico (+5s backoff), poi `traccia('errore', 'anthropic_5xx')` |
| Server AI | tool_use mancante | 502, `traccia('errore', 'no_tool_use')` — difesa-in-profondità nonostante `tool_choice` forzato |
| Server AI | JSON non conforme allo schema | 502, `traccia('errore', 'schema_violation')` |

Fallback finale: tutte le eccezioni non gestite finiscono in `traccia('errore', e.message)`, identico a `analizza.ts`.

### Logging — modifiche a `src/lib/log.ts`

```ts
export type EventoAPI = {
  // ...
  tipo: 'analizza' | 'lettera' | 'compara';   // ← aggiunto 'compara'
  // ...
};

export type StatsAPI = {
  // ...esistenti...
  comparaTotali: number;
  comparaOggi: number;
  erroriComparaTotali: number;
  bloccatiComparaTotali: number;
};
```

I counter `count:compara:total`, `count:compara:<g>`, `count:errore:compara:*`, `count:bloccato:compara:*` partono da 0 e si popolano automaticamente: il pattern `count:${ev.tipo}:total` e `count:errore:${ev.tipo}:total` è già parametrizzato dal commit `cbb0092`. Nessun cambio strutturale in `loggaEvento`, solo l'estensione del tipo unione.

### Dashboard `/admin` — modifiche a `index.astro`

Sezione "Utilizzo API" passa da griglia 5 a griglia 6 (`md:grid-cols-6`):
- "Richieste analisi" — invariata
- "Analisi oggi" — invariata
- "Richieste lettera" — invariata
- **NUOVA "Richieste compara"** con sottotitolo `err: X · bloc: Y`
- "Bloccate (tot.)" — breakdown passa da `an/le` a `an/le/cp`
- "Errori AI (tot.)" — breakdown passa da `an/le` a `an/le/cp`

Le righe `pre: N` (pre-split) restano come adesso. I nuovi totali compara mostrano `0` finché non maturano richieste reali post-deploy.

### Analytics (Firebase, via bridge `Android.track`)

Eventi:
- `compara_start` — apertura screen
- `compara_pdf_uploaded` — `{ slot: 'A'|'B' }`
- `compara_submit` — `{ size_a_kb, size_b_kb }`
- `compara_success` — `{ ms, vantaggio_verdetto: 'a'|'b'|'dipende' }`
- `compara_error` — `{ error: string }`
- `compara_paywall_hit`
- `compara_share`

### Testing manuale

Il progetto non ha framework di test automatizzati. Checklist da eseguire prima del deploy:

1. **Backend OK**: `curl` su `/api/compara` con 2 PDF reali + codice Pro valido → 200 + JSON valido vs schema.
2. **Backend paywall**: stessa chiamata senza/con codice scaduto → 402 con `{paywall:true}`.
3. **Backend incompatibili**: polizza auto + polizza casa → `avviso_compatibilita` non null.
4. **WebView end-to-end**: build APK debug, install su device fisico, flow completo dall'home al verdetto.
5. **Pre-splash**: cold start → immagine 4s → tap interrompe a 1s → riapertura dopo 1s background NON rimostra l'immagine; cold start successivo SÌ rimostra (4s fissi, ogni cold start).
6. **Dashboard**: dopo 1 confronto riuscito, `/admin` mostra "Richieste compara: 1".
7. **Compatibilità minSdk 21**: `View.animate()` esiste da API 12, OK.

### Anti-YAGNI (non in scope)

- ❌ Cache server-side del confronto (i PDF cambiano spesso, hit rate basso)
- ❌ Storico confronti utente (no auth utente vero, solo codice Pro condiviso)
- ❌ Confronto misto con polizze pre-analizzate dallo storico (opzione scartata in Domanda 1 del brainstorming)
- ❌ Esposizione su sito Astro (`/compara.astro`) — rimandato a v2 se conversioni interessanti
- ❌ Versione iOS / PWA standalone — la PWA del sito non monta lo screen "compara" in questa release
- ❌ Test automatizzati — il progetto non ne ha, introdurli ora è scope creep

---

## Decisioni dal brainstorming (riferimento)

| # | Domanda | Risposta |
|---|---|---|
| 1 | Modalità input confronto | Solo PDF, entrambi caricati |
| 2 | Numero polizze | Esattamente 2 |
| 3 | Accesso | Solo Pro (mensile/semestrale/annuale/founder) |
| 4 | Formato output | Tabella + verdetto + dettagli espandibili |
| 5 | Frequenza pre-splash | Ogni cold start |
| 6 | Skip pre-splash | Tap ovunque |
