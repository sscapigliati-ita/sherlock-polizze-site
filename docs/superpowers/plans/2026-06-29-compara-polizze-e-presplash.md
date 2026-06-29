# Sherlock v4.2 — Compara polizze + pre-splash Android (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare la feature "Compara polizze" (Pro, 2 PDF in input, output tabella+verdetto+sezioni espandibili) e aggiungere un'immagine pre-splash di 4 secondi (tap-to-skip) all'avvio cold dell'app Android — il tutto per la release v4.2 (versionCode 52).

**Architecture:** Nuovo endpoint serverless `/api/compara` su sherlock-site (Astro+Vercel) che chiama Anthropic via `tool_use` con schema forzato. Frontend nuovo "screen-compara" dentro la SPA `assets/www/index.html` della WebView. Pre-splash come `ImageView` overlay nel `FrameLayout` esistente di `MainActivity.java` — niente SplashActivity dedicata, la WebView carica in parallelo dietro l'overlay.

**Tech Stack:**
- Backend: Astro 5 (server output), TypeScript, @upstash/redis, Anthropic Messages API + tool_use, deploy Vercel
- WebView UI: vanilla HTML/CSS/JS inside `assets/www/index.html` (SPA esistente, ~1260 righe)
- Android nativo: Java, minSdk 21, targetSdk 35, Firebase Analytics

## Global Constraints

- **Backend project path:** `C:\Users\Stefano\sherlock-site\`
- **Android project path:** `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\`
- **Pre-splash image source:** `C:\Users\Stefano\Downloads\Gemini_Generated_Image_.png`
- **Branch:** `main` (NON master). Mai force-push.
- **Lingua:** italiano per documenti, commenti, copy utente. Identificatori in italiano dove la codebase già lo fa (es. `valutaCodice`, `traccia`).
- **Encoding file:** UTF-8 (LF→CRLF conversion automatica su Windows è OK, il warning git è benigno).
- **Versione target app:** versionCode 52, versionName '4.2'.
- **Anthropic model:** sempre via `getModel()` da `src/lib/auth.ts` (oggi Haiku 4.5).
- **No nuovi test framework:** il progetto non ne ha. Verifiche via `npm run build`, `curl`, install device fisico.
- **Commit style:** prefisso minuscolo + descrizione italiana (es. `compara: endpoint /api/compara con tool_use`). Firma `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- **Mai `git add -A`** nella home; nel repo sherlock-site va bene `git add <file>` esplicito.
- **PDF limit:** 20 MB per file, 35 MB body totale.
- **Caveat AI obbligatorio:** ogni output del confronto DEVE includere un disclaimer "valutazione algoritmica, non sostituisce consulenza professionale".

---

## File Structure

### Backend (`sherlock-site/`)
| File | Tipo | Responsabilità |
|---|---|---|
| `src/lib/log.ts` | MODIFY | Estensione tipo `EventoAPI['tipo']` a `'analizza'\|'lettera'\|'compara'`; 4 nuovi campi in `StatsAPI`; fetch counter `compara` |
| `src/pages/api/compara.ts` | CREATE | Endpoint POST: valida input, valuta codice Pro, chiama Anthropic con `tool_use`, logga evento, ritorna JSON |
| `src/pages/admin/index.astro` | MODIFY | Griglia "Utilizzo API" da 5→6 card; nuova card "Richieste compara"; breakdown a 3 in card bloccate/errori |

### WebView SPA (`Android/assets/www/`)
| File | Tipo | Responsabilità |
|---|---|---|
| `index.html` | MODIFY | Bottone entry point in `screen-home`; nuovo `<div id="screen-compara">` con stati vuoto/parziale/pronto/loading/risultato; JS state machine; render JSON in HTML |

### Android nativo
| File | Tipo | Responsabilità |
|---|---|---|
| `app/src/main/res/drawable-nodpi/pre_splash.png` | CREATE | Immagine pre-splash (copia dal file Gemini in Downloads) |
| `app/src/main/res/values/colors.xml` | CREATE | `<color name="pre_splash_bg">#070b18</color>` |
| `app/src/main/java/it/sherlock/polizze/MainActivity.java` | MODIFY | ~30 righe additive: `ImageView` overlay, tap-to-skip, fade 350ms, removal a 4s |
| `app/build.gradle` | MODIFY | `versionCode 52`, `versionName '4.2'` |

---

## Task list

- **Blocco A — Backend & dashboard:** Task 1 → 4
- **Blocco B — WebView UI:** Task 5 → 8
- **Blocco C — Android pre-splash:** Task 9 → 11
- **Blocco D — Deploy & verifica end-to-end:** Task 12 → 13

I task di un blocco vanno fatti in ordine (alcuni dipendono dai precedenti). Tra blocchi A↔C non c'è dipendenza, B dipende da A (deve esistere l'endpoint). Suggerimento ordine: A → C → B → D (così l'app Android è pronta mentre si testa la API e poi si attacca la UI).

---

### Task 1: Estendere `EventoAPI['tipo']` e `StatsAPI` per supportare 'compara'

**Files:**
- Modify: `C:\Users\Stefano\sherlock-site\src\lib\log.ts`

**Interfaces:**
- Consumes: (nessuno, è il primo task)
- Produces: tipo `EventoAPI` accetta `tipo: 'compara'`; `StatsAPI` ha campi `comparaTotali`, `comparaOggi`, `erroriComparaTotali`, `bloccatiComparaTotali`. I counter Redis `count:compara:*` e `count:errore:compara:*`/`count:bloccato:compara:*` vengono popolati automaticamente dal pattern parametrico già in `loggaEvento` (commit `cbb0092`).

- [ ] **Step 1: Estendere il tipo unione `EventoAPI['tipo']`**

In `C:\Users\Stefano\sherlock-site\src\lib\log.ts`, sostituire:

```ts
export type EventoAPI = {
  ts: string; // ISO timestamp
  tipo: 'analizza' | 'lettera';
  esito: 'ok' | 'errore' | 'bloccato';
```

con:

```ts
export type EventoAPI = {
  ts: string; // ISO timestamp
  tipo: 'analizza' | 'lettera' | 'compara';
  esito: 'ok' | 'errore' | 'bloccato';
```

- [ ] **Step 2: Estendere `StatsAPI`**

In `C:\Users\Stefano\sherlock-site\src\lib\log.ts`, sostituire la definizione di `StatsAPI` con questa versione (aggiunge 4 campi e mantiene gli esistenti):

```ts
export type StatsAPI = {
  analisiTotali: number;
  analisiOggi: number;
  lettereTotali: number;
  lettereOggi: number;
  comparaTotali: number;
  comparaOggi: number;
  // Aggregato storico (analizza + lettera + compara) — mantenuto per back-compat.
  erroriTotali: number;
  bloccatiTotali: number;
  // Per-tipo (disponibili dal deploy che ha introdotto lo split: pre-esistenti
  // contati solo come aggregato).
  erroriAnalizzaTotali: number;
  erroriLetteraTotali: number;
  erroriComparaTotali: number;
  bloccatiAnalizzaTotali: number;
  bloccatiLetteraTotali: number;
  bloccatiComparaTotali: number;
  perGiorno: Array<{ giorno: string; analisi: number; errori: number }>;
};
```

- [ ] **Step 3: Aggiornare la branch fallback in-memory di `leggiStats`**

In `leggiStats()`, dentro il blocco `if (!kvOn()) { ... }`, sostituire il `return` con:

```ts
return {
  analisiTotali: tot('analizza'),
  analisiOggi: totOggi('analizza'),
  lettereTotali: tot('lettera'),
  lettereOggi: totOggi('lettera'),
  comparaTotali: tot('compara'),
  comparaOggi: totOggi('compara'),
  erroriTotali: errs,
  bloccatiTotali: blocs,
  erroriAnalizzaTotali: errsTipo('analizza'),
  erroriLetteraTotali: errsTipo('lettera'),
  erroriComparaTotali: errsTipo('compara'),
  bloccatiAnalizzaTotali: blocsTipo('analizza'),
  bloccatiLetteraTotali: blocsTipo('lettera'),
  bloccatiComparaTotali: blocsTipo('compara'),
  perGiorno: serie7giorni(fallbackLog),
};
```

Il TypeScript chiederà di estendere il parametro di `tot`/`totOggi`/`errsTipo`/`blocsTipo`. Cambia le firme in:

```ts
const tot = (tipo: 'analizza' | 'lettera' | 'compara') => fallbackLog.filter((e) => e.tipo === tipo).length;
const totOggi = (tipo: 'analizza' | 'lettera' | 'compara') =>
  fallbackLog.filter((e) => e.tipo === tipo && dateKey(new Date(e.ts)) === oggi).length;
// ...
const errsTipo = (tipo: 'analizza' | 'lettera' | 'compara') =>
  fallbackLog.filter((e) => e.esito === 'errore' && e.tipo === tipo).length;
const blocsTipo = (tipo: 'analizza' | 'lettera' | 'compara') =>
  fallbackLog.filter((e) => e.esito === 'bloccato' && e.tipo === tipo).length;
```

- [ ] **Step 4: Aggiornare la branch KV di `leggiStats`**

Nel `Promise.all` della branch KV, aggiungere le 3 `get` per i counter `compara`:

```ts
const [
  analisiT, analisiO, lettereT, lettereO,
  erroriT, bloccatiT,
  erroriAnalizzaT, erroriLetteraT,
  bloccatiAnalizzaT, bloccatiLetteraT,
  comparaT, comparaO,
  erroriComparaT, bloccatiComparaT,
] = await Promise.all([
  r.get<number>('count:analizza:total'),
  r.get<number>(`count:analizza:${oggi}`),
  r.get<number>('count:lettera:total'),
  r.get<number>(`count:lettera:${oggi}`),
  r.get<number>('count:errore:total'),
  r.get<number>('count:bloccato:total'),
  r.get<number>('count:errore:analizza:total'),
  r.get<number>('count:errore:lettera:total'),
  r.get<number>('count:bloccato:analizza:total'),
  r.get<number>('count:bloccato:lettera:total'),
  r.get<number>('count:compara:total'),
  r.get<number>(`count:compara:${oggi}`),
  r.get<number>('count:errore:compara:total'),
  r.get<number>('count:bloccato:compara:total'),
]);
```

Sostituire il `return` finale con:

```ts
return {
  analisiTotali: analisiT ?? 0,
  analisiOggi: analisiO ?? 0,
  lettereTotali: lettereT ?? 0,
  lettereOggi: lettereO ?? 0,
  comparaTotali: comparaT ?? 0,
  comparaOggi: comparaO ?? 0,
  erroriTotali: erroriT ?? 0,
  bloccatiTotali: bloccatiT ?? 0,
  erroriAnalizzaTotali: erroriAnalizzaT ?? 0,
  erroriLetteraTotali: erroriLetteraT ?? 0,
  erroriComparaTotali: erroriComparaT ?? 0,
  bloccatiAnalizzaTotali: bloccatiAnalizzaT ?? 0,
  bloccatiLetteraTotali: bloccatiLetteraT ?? 0,
  bloccatiComparaTotali: bloccatiComparaT ?? 0,
  perGiorno: perGiornoRaw,
};
```

- [ ] **Step 5: Verifica build**

```bash
cd /c/Users/Stefano/sherlock-site
npm run build
```

Atteso: output termina con `[build] Complete!`. Nessun errore TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/lib/log.ts
git commit -m "$(cat <<'EOF'
log: aggiungi tipo 'compara' a EventoAPI e StatsAPI

Estende l'unione dei tipi evento per supportare il futuro endpoint
/api/compara e popola 4 nuovi campi in StatsAPI (comparaTotali, oggi,
errori e bloccati). I counter Redis count:compara:* sono parametrici
e si popolano automaticamente dal pattern già in loggaEvento.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `/api/compara.ts` — scaffold + validazione input + paywall

**Files:**
- Create: `C:\Users\Stefano\sherlock-site\src\pages\api\compara.ts`

**Interfaces:**
- Consumes: `loggaEvento`, `nuovoRequestId`, `estraiIp`, `EventoAPI` (da `src/lib/log.ts`); `valutaCodice`, `getAnthropicKey`, `getModel` (da `src/lib/auth.ts`).
- Produces: endpoint POST `/api/compara` che accetta `{ polizzaA: string, polizzaB: string, codice: string, lang?: string }` con `polizzaA/B` in base64 PDF. Risponde 400/402/413/200 con i pattern descritti in Task 3. Questo task implementa SOLO validazione e paywall; la chiamata Anthropic arriva in Task 3.

- [ ] **Step 1: Creare il file con scaffold validation+paywall**

Crea `C:\Users\Stefano\sherlock-site\src\pages\api\compara.ts` con questo contenuto:

```ts
import type { APIRoute } from 'astro';
import { getAnthropicKey, getModel, valutaCodice } from '../../lib/auth';
import { estraiIp, loggaEvento, nuovoRequestId, type EventoAPI } from '../../lib/log';

export const prerender = false;
// Cap massimo Hobby+Fluid Compute. Il modello Haiku 4.5 normalmente sta sotto
// i 60 secondi per 2 PDF, ma teniamo il margine massimo per PDF molto grossi.
export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_PDF_BYTES = 20 * 1024 * 1024;       // 20 MB per file
const MAX_BODY_BYTES = 35 * 1024 * 1024;      // 35 MB totale

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
  return `\n\nIMPORTANT: Respond entirely in ${LANG_NAMES[lang]}, regardless of the documents' original language. All headings, labels, summary text, exclusion descriptions, table values, and recommendations must be in ${LANG_NAMES[lang]}.`;
}

// Valida che la stringa base64 decodificata inizi col magic byte di un PDF.
function isValidPdfB64(b64: string): boolean {
  try {
    const head = Buffer.from(b64.slice(0, 16), 'base64').toString('ascii');
    return head.startsWith('%PDF-');
  } catch { return false; }
}

export const POST: APIRoute = async ({ request }) => {
  const t0 = Date.now();
  const requestId = nuovoRequestId();
  const ip = estraiIp(request);

  // Helper di logging identico a analizza.ts: l'await garantisce che il counter
  // KV venga incrementato anche se l'invocazione serverless viene sospesa subito
  // dopo la response.
  const traccia = (esito: EventoAPI['esito'], errore?: string) =>
    loggaEvento({
      ts: new Date().toISOString(),
      tipo: 'compara',
      esito,
      errore,
      requestId,
      ip,
      ms: Date.now() - t0,
    }).catch(() => undefined);

  // --- Validazione body ---
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    await traccia('bloccato', 'body_too_large');
    return new Response(JSON.stringify({ errore: 'Documenti troppo grandi (max 35 MB totali)' }), {
      status: 413, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    await traccia('bloccato', 'invalid_json');
    return new Response(JSON.stringify({ errore: 'JSON non valido' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const polizzaA = typeof body?.polizzaA === 'string' ? body.polizzaA : '';
  const polizzaB = typeof body?.polizzaB === 'string' ? body.polizzaB : '';
  const codice = typeof body?.codice === 'string' ? body.codice : '';
  const lang = normalizzaLingua(body?.lang);

  if (!polizzaA || !polizzaB || !codice) {
    await traccia('bloccato', 'missing_field');
    return new Response(JSON.stringify({ errore: 'Campi polizzaA, polizzaB e codice obbligatori' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Stima dimensione decodificata: base64 = ~1.33× il binario.
  const sizeA = Math.floor(polizzaA.length * 0.75);
  const sizeB = Math.floor(polizzaB.length * 0.75);
  if (sizeA > MAX_PDF_BYTES || sizeB > MAX_PDF_BYTES) {
    await traccia('bloccato', 'pdf_too_large');
    return new Response(JSON.stringify({ errore: 'PDF troppo grande (max 20 MB per file)' }), {
      status: 413, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidPdfB64(polizzaA) || !isValidPdfB64(polizzaB)) {
    await traccia('bloccato', 'invalid_pdf');
    return new Response(JSON.stringify({ errore: 'Uno dei file caricati non è un PDF valido' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Paywall: codice Pro obbligatorio ---
  const esito = await valutaCodice(codice);
  if (!esito.valido || (esito.tipo !== 'pro' && esito.tipo !== 'dev' && esito.tipo !== 'whitelist')) {
    await traccia('bloccato', 'no_pro');
    return new Response(JSON.stringify({ errore: 'Codice Pro richiesto', paywall: true }), {
      status: 402, headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- TODO Task 3: chiamata Anthropic + tool_use ---
  // Per ora rispondiamo 501 così possiamo testare la validazione in isolamento.
  return new Response(JSON.stringify({ errore: 'Implementazione AI in arrivo' }), {
    status: 501, headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Verifica build**

```bash
cd /c/Users/Stefano/sherlock-site
npm run build
```

Atteso: `[build] Complete!` senza errori TS.

- [ ] **Step 3: Smoke test validazione (richiede dev server in altro terminale)**

Apri un secondo terminale e fai partire il dev server:

```bash
cd /c/Users/Stefano/sherlock-site
npm run dev
```

Aspetta che dica `Local: http://localhost:4321/`. Poi nel terminale principale:

```bash
# Test 1: missing field → 400
curl -sS -X POST http://localhost:4321/api/compara \
  -H 'Content-Type: application/json' \
  -d '{}' | head -c 500
echo
```

Atteso: `{"errore":"Campi polizzaA, polizzaB e codice obbligatori"}`.

```bash
# Test 2: invalid pdf → 400
curl -sS -X POST http://localhost:4321/api/compara \
  -H 'Content-Type: application/json' \
  -d '{"polizzaA":"bm90X2FfcGRm","polizzaB":"bm90X2FfcGRm","codice":"TEST"}' | head -c 500
echo
```

Atteso: `{"errore":"Uno dei file caricati non è un PDF valido"}`.

```bash
# Test 3: invalid code → 402 con paywall
curl -sS -X POST http://localhost:4321/api/compara \
  -H 'Content-Type: application/json' \
  -d '{"polizzaA":"JVBERi0xLjQK","polizzaB":"JVBERi0xLjQK","codice":"INVALID_CODE_XYZ"}' | head -c 500
echo
```

Atteso: `{"errore":"Codice Pro richiesto","paywall":true}`.

Ferma il dev server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/compara.ts
git commit -m "$(cat <<'EOF'
compara: scaffold endpoint /api/compara con validazione + paywall

Validazione body (max 35MB), per-file (max 20MB), magic byte PDF, codice
Pro obbligatorio (riusa valutaCodice). Risponde 400/402/413 nei casi
di errore con log evento 'bloccato' e ragione. La chiamata Anthropic
arriva nel task successivo (per ora 501).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `/api/compara.ts` — integrazione Anthropic con `tool_use` schema forzato

**Files:**
- Modify: `C:\Users\Stefano\sherlock-site\src\pages\api\compara.ts`

**Interfaces:**
- Consumes: `getAnthropicKey()`, `getModel()` (da `src/lib/auth.ts`), `Anthropic Messages API` (`https://api.anthropic.com/v1/messages`).
- Produces: endpoint completo che, a paywall superato, ritorna 200 con `ReportConfronto` JSON conforme allo schema definito in Sez. 2 dello spec. Errori AI mappati a 502 con `traccia('errore', ...)`.

- [ ] **Step 1: Aggiungere schema + costanti subito sotto le costanti esistenti**

In `C:\Users\Stefano\sherlock-site\src\pages\api\compara.ts`, subito dopo `const MAX_BODY_BYTES = ...;`, aggiungere:

```ts
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

// Schema JSON forzato — l'output di Anthropic via tool_use è garantito JSON
// valido conforme a questo schema. Stesso pattern di analizza.ts.
const SCHEMA_CONFRONTO = {
  type: 'object',
  required: ['polizze', 'avviso_compatibilita', 'tabella_sintesi', 'differenze_chiave', 'esclusioni_solo_a', 'esclusioni_solo_b', 'coperture_solo_a', 'coperture_solo_b', 'verdetto'],
  properties: {
    polizze: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'object',
        required: ['etichetta', 'compagnia', 'tipo_polizza'],
        properties: {
          etichetta: { type: 'string', enum: ['A', 'B'] },
          compagnia: { type: 'string' },
          tipo_polizza: { type: 'string' },
          numero_polizza: { type: 'string' },
        },
      },
    },
    avviso_compatibilita: { type: ['string', 'null'] },
    tabella_sintesi: {
      type: 'array',
      items: {
        type: 'object',
        required: ['aspetto', 'valore_a', 'valore_b', 'vantaggio'],
        properties: {
          aspetto: { type: 'string' },
          valore_a: { type: 'string' },
          valore_b: { type: 'string' },
          vantaggio: { type: 'string', enum: ['a', 'b', 'pari', 'non_confrontabile'] },
        },
      },
    },
    differenze_chiave: {
      type: 'array',
      items: {
        type: 'object',
        required: ['titolo', 'descrizione', 'impatto', 'vantaggio'],
        properties: {
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          impatto: { type: 'string', enum: ['alto', 'medio', 'basso'] },
          vantaggio: { type: 'string', enum: ['a', 'b'] },
        },
      },
    },
    esclusioni_solo_a: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          gravita: { type: 'string', enum: ['alta', 'media', 'bassa'] },
        },
      },
    },
    esclusioni_solo_b: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          gravita: { type: 'string', enum: ['alta', 'media', 'bassa'] },
        },
      },
    },
    coperture_solo_a: {
      type: 'array',
      items: {
        type: 'object',
        properties: { titolo: { type: 'string' }, descrizione: { type: 'string' } },
      },
    },
    coperture_solo_b: {
      type: 'array',
      items: {
        type: 'object',
        properties: { titolo: { type: 'string' }, descrizione: { type: 'string' } },
      },
    },
    verdetto: {
      type: 'object',
      required: ['raccomandazione', 'motivazione', 'caveat', 'quando_scegliere_a', 'quando_scegliere_b'],
      properties: {
        raccomandazione: { type: 'string', enum: ['a', 'b', 'dipende'] },
        motivazione: { type: 'string' },
        caveat: { type: 'string' },
        quando_scegliere_a: { type: 'string' },
        quando_scegliere_b: { type: 'string' },
      },
    },
  },
};
```

- [ ] **Step 2: Aggiungere helper retry singolo per Anthropic**

Subito dopo `SCHEMA_CONFRONTO`, aggiungere:

```ts
// Retry singolo con backoff fisso 5s su errori 5xx Anthropic. Non ritenta su
// errori 4xx (es. invalid_request) né su timeout (li lasciamo bubblare per non
// raddoppiare l'attesa utente che è già 30-40s).
async function chiamaAnthropicConRetry(reqInit: RequestInit): Promise<Response> {
  let r = await fetch(ANTHROPIC_API_URL, reqInit);
  if (r.status >= 500 && r.status < 600) {
    await new Promise((res) => setTimeout(res, 5000));
    r = await fetch(ANTHROPIC_API_URL, reqInit);
  }
  return r;
}
```

- [ ] **Step 3: Sostituire la response 501 con la chiamata Anthropic completa**

In `C:\Users\Stefano\sherlock-site\src\pages\api\compara.ts`, sostituire il blocco:

```ts
  // --- TODO Task 3: chiamata Anthropic + tool_use ---
  // Per ora rispondiamo 501 così possiamo testare la validazione in isolamento.
  return new Response(JSON.stringify({ errore: 'Implementazione AI in arrivo' }), {
    status: 501, headers: { 'Content-Type': 'application/json' },
  });
};
```

con:

```ts
  // --- Chiamata Anthropic ---
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    await traccia('errore', 'anthropic_key_missing');
    return new Response(JSON.stringify({ errore: 'Servizio non configurato' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const reqBody = {
    model: getModel(),
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
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: polizzaA } },
        { type: 'text', text: 'Polizza B (file allegato di seguito):' },
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: polizzaB } },
        { type: 'text', text: "Confronta le due polizze e chiama il tool con l'analisi." },
      ],
    }],
  };

  let r: Response;
  try {
    r = await chiamaAnthropicConRetry({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e: any) {
    await traccia('errore', `fetch_failed: ${e?.message ?? e}`);
    return new Response(JSON.stringify({ errore: 'Rete o timeout verso il servizio AI' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message ?? `anthropic_${r.status}`;
    await traccia('errore', `anthropic_${r.status}: ${String(msg).slice(0, 200)}`);
    return new Response(JSON.stringify({ errore: 'Errore servizio AI', dettaglio: msg }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Anthropic con tool_choice forzato ritorna content come array di blocchi:
  // cerchiamo il primo blocco di tipo 'tool_use' con il nostro tool name.
  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  const toolUse = blocks.find((b) => b?.type === 'tool_use' && b?.name === 'report_confronto_polizze');
  if (!toolUse?.input) {
    await traccia('errore', 'no_tool_use');
    return new Response(JSON.stringify({ errore: "Risposta AI senza tool_use (raro: tool_choice forzato)" }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  await traccia('ok');
  return new Response(JSON.stringify(toolUse.input), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 4: Verifica build**

```bash
cd /c/Users/Stefano/sherlock-site
npm run build
```

Atteso: `[build] Complete!` senza errori.

- [ ] **Step 5: Smoke test end-to-end (richiede dev server + codice Pro valido + 2 PDF reali)**

Serve un codice Pro reale. Recuperalo da Upstash (`pro:codici`) o usa uno tuo personale. Servono 2 PDF di polizze reali, di dimensione < 20MB ciascuno, in `C:\Users\Stefano\Downloads\polizza_a.pdf` e `polizza_b.pdf` (sostituisci coi tuoi path).

Dev server attivo:
```bash
cd /c/Users/Stefano/sherlock-site
npm run dev
```

Test:
```bash
# base64 dei PDF (Git Bash su Windows)
A=$(base64 -w0 "/c/Users/Stefano/Downloads/polizza_a.pdf")
B=$(base64 -w0 "/c/Users/Stefano/Downloads/polizza_b.pdf")
CODICE='IL_TUO_CODICE_PRO'

curl -sS -X POST http://localhost:4321/api/compara \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg a "$A" --arg b "$B" --arg c "$CODICE" '{polizzaA:$a, polizzaB:$b, codice:$c}')" \
  | jq -r '.verdetto.raccomandazione, .verdetto.caveat, (.tabella_sintesi | length)'
```

Atteso (esempio): tre righe — la raccomandazione (`a`/`b`/`dipende`), il caveat (stringa con "non sostituisce"), e il numero di righe della tabella sintesi (> 0).

Se non hai `jq`, prendi solo l'output raw e controlla a occhio che ci sia un JSON ben formato con `verdetto`, `tabella_sintesi`, ecc.

Ferma il dev server.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/compara.ts
git commit -m "$(cat <<'EOF'
compara: integrazione Anthropic via tool_use con schema forzato

Schema SCHEMA_CONFRONTO definisce report_confronto_polizze: tabella
sintesi, differenze chiave, esclusioni/coperture esclusive, verdetto
con raccomandazione 'a'/'b'/'dipende' e caveat sempre richiesto.
Retry singolo +5s su 5xx Anthropic, niente retry su 4xx. Output del
tool_use ritornato 1:1 al client (no parsing fragile).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Dashboard `/admin` — nuova card "Richieste compara" + breakdown a 3

**Files:**
- Modify: `C:\Users\Stefano\sherlock-site\src\pages\admin\index.astro`

**Interfaces:**
- Consumes: nuovi campi `comparaTotali`, `comparaOggi`, `erroriComparaTotali`, `bloccatiComparaTotali` di `StatsAPI` (Task 1).
- Produces: dashboard renderizza una card in più, breakdown errori/bloccati include `cp:`.

- [ ] **Step 1: Aggiornare il calcolo `pre-split`**

In `C:\Users\Stefano\sherlock-site\src\pages\admin\index.astro`, sostituire:

```ts
const erroriPreSplit = Math.max(
  0,
  stats.erroriTotali - stats.erroriAnalizzaTotali - stats.erroriLetteraTotali,
);
const bloccatiPreSplit = Math.max(
  0,
  stats.bloccatiTotali - stats.bloccatiAnalizzaTotali - stats.bloccatiLetteraTotali,
);
```

con:

```ts
const erroriPreSplit = Math.max(
  0,
  stats.erroriTotali - stats.erroriAnalizzaTotali - stats.erroriLetteraTotali - stats.erroriComparaTotali,
);
const bloccatiPreSplit = Math.max(
  0,
  stats.bloccatiTotali - stats.bloccatiAnalizzaTotali - stats.bloccatiLetteraTotali - stats.bloccatiComparaTotali,
);
```

- [ ] **Step 2: Aggiungere la card "Richieste compara" e portare la griglia a 6 colonne**

Sostituire questo blocco:

```astro
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
```

con:

```astro
      <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
```

Subito dopo la card "Richieste lettera" (cerca `Richieste lettera` nel file), prima della card "Bloccate (tot.)", inserire:

```astro
        <div class="rounded-xl border border-navy-700 bg-navy-900 p-4">
          <div class="text-xs text-navy-400 uppercase tracking-widest">Richieste compara</div>
          <div class="text-3xl font-extrabold text-white mt-1">{stats.comparaTotali}</div>
          <div class="text-[10px] text-navy-500 mt-1">
            err: <span class="text-red-300">{stats.erroriComparaTotali}</span> · bloc: <span class="text-amber-300">{stats.bloccatiComparaTotali}</span>
          </div>
        </div>
```

- [ ] **Step 3: Aggiungere `cp:` ai breakdown delle card aggregate**

Sostituire il sottotitolo della card "Bloccate (tot.)":

```astro
          <div class="text-[10px] text-navy-500 mt-1">
            an: {stats.bloccatiAnalizzaTotali} · le: {stats.bloccatiLetteraTotali}{bloccatiPreSplit > 0 && (<> · pre: {bloccatiPreSplit}</>)}
          </div>
```

con:

```astro
          <div class="text-[10px] text-navy-500 mt-1">
            an: {stats.bloccatiAnalizzaTotali} · le: {stats.bloccatiLetteraTotali} · cp: {stats.bloccatiComparaTotali}{bloccatiPreSplit > 0 && (<> · pre: {bloccatiPreSplit}</>)}
          </div>
```

Analogo per "Errori AI (tot.)":

```astro
          <div class="text-[10px] text-navy-500 mt-1">
            an: {stats.erroriAnalizzaTotali} · le: {stats.erroriLetteraTotali}{erroriPreSplit > 0 && (<> · pre: {erroriPreSplit}</>)}
          </div>
```

diventa:

```astro
          <div class="text-[10px] text-navy-500 mt-1">
            an: {stats.erroriAnalizzaTotali} · le: {stats.erroriLetteraTotali} · cp: {stats.erroriComparaTotali}{erroriPreSplit > 0 && (<> · pre: {erroriPreSplit}</>)}
          </div>
```

- [ ] **Step 4: Verifica build**

```bash
cd /c/Users/Stefano/sherlock-site
npm run build
```

Atteso: `[build] Complete!`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "$(cat <<'EOF'
admin: card 'Richieste compara' + breakdown a 3 per errori/bloccati

Griglia 'Utilizzo API' da 5 a 6 colonne. Nuova card mostra comparaTotali
con sottotitolo err/bloc. Card aggregate Errori AI e Bloccate ora hanno
breakdown an/le/cp; pre-split corretto sottraendo anche comparaTotali.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: WebView — entry point in home + skeleton `screen-compara`

**Files:**
- Modify: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\assets\www\index.html`

**Interfaces:**
- Consumes: pattern dei `screen-*` esistenti (es. `screen-home`, `screen-analisi`), funzione di navigazione tra screen già presente nella SPA.
- Produces: nuovo `<div id="screen-compara" class="screen">`; bottone in home che invoca la navigazione a `compara`.

- [ ] **Step 1: Identificare il pattern di navigazione esistente**

Apri `index.html` e cerca con grep come si naviga fra screen (per esempio chiamando: `goTo`, `showScreen`, `switchScreen`, `setActiveScreen`, oppure direttamente toggling della classe `active`):

```bash
cd "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/assets/www"
grep -nE "screen-home|screen-analisi|goTo|showScreen|classList\.(add|remove).*active" index.html | head -30
```

Annota il nome esatto della funzione di navigazione (o il pattern, es. `document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById('screen-X').classList.add('active');`). **I prossimi step usano `goTo('compara')` come placeholder: sostituiscilo col pattern reale del progetto.**

- [ ] **Step 2: Aggiungere il bottone in `screen-home`**

Cerca dentro `screen-home` un container coi bottoni "Analizza" / "Lettera". Subito dopo l'ultimo bottone esistente, aggiungere:

```html
<button class="btn-home" onclick="goTo('compara')" data-i18n="home_compara_label">
  ⚖️ Confronta 2 polizze
</button>
```

Riusa la classe CSS dei bottoni home esistenti (`btn-home` è placeholder: usa quella vera, es. `home-cta` o quello che usano gli altri bottoni). Mantieni stile coerente.

Nel dictionary delle traduzioni (cerca `splash_sub:` per trovare il blocco i18n italiano), aggiungere:

```js
home_compara_label: '⚖️ Confronta 2 polizze',
```

E ripetere nelle altre lingue presenti (en, es, fr, my, zh) con traduzione appropriata:
- en: `'⚖️ Compare 2 policies'`
- es: `'⚖️ Comparar 2 pólizas'`
- fr: `'⚖️ Comparer 2 polices'`
- my: `'⚖️ မူဝါဒ ၂ ခု နှိုင်းယှဉ်ပါ'`
- zh: `'⚖️ 比较两份保单'`

- [ ] **Step 3: Aggiungere skeleton del nuovo screen**

Dopo l'ultimo `</div>` di chiusura di uno screen esistente (cerca pattern `<div id="screen-lettera"` e individua la sua chiusura), aggiungere:

```html
<div id="screen-compara" class="screen">
  <div class="compara-header">
    <button class="btn-back" onclick="goTo('home')">←</button>
    <h2 data-i18n="compara_title">Compara polizze</h2>
  </div>

  <p class="compara-intro" data-i18n="compara_intro">
    Carica due polizze in PDF: Sherlock le mette a confronto evidenziando
    coperture, esclusioni e franchigie.
  </p>

  <div class="compara-slots">
    <div class="compara-slot" id="slot-a" data-stato="vuoto">
      <div class="slot-label">Polizza A</div>
      <input type="file" id="file-a" accept="application/pdf" hidden />
      <button class="slot-btn-upload" onclick="document.getElementById('file-a').click()" data-i18n="compara_carica_pdf">
        + Carica PDF
      </button>
      <div class="slot-info" hidden>
        <span class="slot-filename"></span>
        <span class="slot-size"></span>
        <button class="slot-btn-remove" data-i18n="compara_rimuovi">Rimuovi</button>
      </div>
    </div>

    <div class="compara-slot" id="slot-b" data-stato="vuoto">
      <div class="slot-label">Polizza B</div>
      <input type="file" id="file-b" accept="application/pdf" hidden />
      <button class="slot-btn-upload" onclick="document.getElementById('file-b').click()" data-i18n="compara_carica_pdf">
        + Carica PDF
      </button>
      <div class="slot-info" hidden>
        <span class="slot-filename"></span>
        <span class="slot-size"></span>
        <button class="slot-btn-remove" data-i18n="compara_rimuovi">Rimuovi</button>
      </div>
    </div>
  </div>

  <button id="compara-submit" class="btn-primary" disabled data-i18n="compara_confronta">
    Confronta polizze
  </button>

  <div id="compara-loading" hidden>
    <div class="loader-anim"></div>
    <p data-i18n="compara_loading">Sherlock sta confrontando le polizze...</p>
    <button id="compara-abort" class="btn-link" data-i18n="compara_annulla">Annulla</button>
  </div>

  <div id="compara-result" hidden></div>
  <div id="compara-error" hidden class="error-box"></div>
</div>
```

Aggiungere le chiavi i18n corrispondenti in TUTTE le lingue (placeholder italiani):

```js
compara_title: 'Compara polizze',
compara_intro: 'Carica due polizze in PDF: Sherlock le mette a confronto evidenziando coperture, esclusioni e franchigie.',
compara_carica_pdf: '+ Carica PDF',
compara_rimuovi: 'Rimuovi',
compara_confronta: 'Confronta polizze',
compara_loading: 'Sherlock sta confrontando le polizze...',
compara_annulla: 'Annulla',
```

- [ ] **Step 4: Aggiungere CSS minimo per il nuovo screen**

Cerca dove stanno gli stili degli altri screen (es. `#screen-analisi {`) e dopo aggiungere:

```css
#screen-compara { padding: 16px; }
#screen-compara .compara-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
#screen-compara .compara-intro { color: #b9c0d6; font-size: 14px; margin-bottom: 16px; }
#screen-compara .compara-slots { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
#screen-compara .compara-slot {
  border: 2px dashed #2a3759; border-radius: 12px; padding: 16px;
  background: #0e1428; min-height: 140px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
}
#screen-compara .compara-slot[data-stato="pronto"] { border-style: solid; border-color: #d4a544; }
#screen-compara .slot-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #b9c0d6; }
#screen-compara .slot-btn-upload {
  background: transparent; border: 1px solid #d4a544; color: #d4a544;
  padding: 8px 14px; border-radius: 6px; cursor: pointer;
}
#screen-compara .slot-info { display: flex; flex-direction: column; gap: 4px; text-align: center; }
#screen-compara .slot-filename { color: #fff; font-size: 13px; word-break: break-all; }
#screen-compara .slot-size { color: #7a86a8; font-size: 11px; }
#screen-compara .slot-btn-remove { background: transparent; color: #ff6b6b; border: none; font-size: 11px; cursor: pointer; }
#screen-compara #compara-submit {
  width: 100%; padding: 14px; font-size: 16px; font-weight: bold;
  background: #d4a544; color: #070b18; border: none; border-radius: 8px;
  cursor: pointer; transition: opacity .2s;
}
#screen-compara #compara-submit:disabled { opacity: .4; cursor: not-allowed; }
#screen-compara #compara-loading { text-align: center; padding: 30px 0; }
#screen-compara .error-box {
  background: rgba(255,107,107,.15); border: 1px solid rgba(255,107,107,.4);
  color: #ffaeae; padding: 12px; border-radius: 8px; margin-top: 16px;
}
```

- [ ] **Step 5: Verifica con browser locale**

Apri il file direttamente nel browser:
```bash
start "" "C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\assets\www\index.html"
```

Verifica: dal `screen-home` vedi il bottone "⚖️ Confronta 2 polizze". Cliccandolo si naviga a `screen-compara` con i 2 slot vuoti. Il bottone "Confronta polizze" è disabilitato. Tap su "← back" torna a home.

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project"
git init 2>/dev/null || true  # nel caso non sia un repo git
git add app/src/main/assets/www/index.html
git commit -m "compara webview: entry point home + skeleton screen-compara"
```

**Nota:** la directory Android è in Downloads e potrebbe non essere un repo git. Se `git init` lo crea da zero, va bene; se è già repo, niente di fatto. I commit qui sono best-effort per tracking locale, NON pushabili a un remote del sito.

---

### Task 6: WebView — upload PDF + state machine (vuoto/parziale/pronto)

**Files:**
- Modify: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\assets\www\index.html`

**Interfaces:**
- Consumes: skeleton DOM di Task 5 (`#file-a`, `#file-b`, `#slot-a`, `#slot-b`, `#compara-submit`).
- Produces: oggetto JS `comparaState = { a: { name, size, b64 } | null, b: { ... } | null }`; funzioni `slotAggiorna()`, `slotPulisci(lettera)`.

- [ ] **Step 1: Aggiungere lo state + handler upload in un nuovo `<script>`**

Trova lo `<script>` principale della SPA (cerca la dichiarazione di funzioni come `goTo` o le chiamate API). Subito dopo, aggiungere un nuovo blocco di script:

```html
<script>
(function() {
  const MAX_PDF_BYTES = 20 * 1024 * 1024;

  const comparaState = { a: null, b: null };

  function leggiFileBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        // Strip "data:application/pdf;base64," prefix
        const idx = r.result.indexOf(',');
        resolve(r.result.slice(idx + 1));
      };
      r.onerror = () => reject(new Error('file_read_failed'));
      r.readAsDataURL(file);
    });
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1024/1024).toFixed(2) + ' MB';
  }

  async function handleUpload(lettera, file) {
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      if (window.Android && Android.showToast) Android.showToast('PDF troppo grande (max 20 MB)');
      else alert('PDF troppo grande (max 20 MB)');
      return;
    }
    try {
      const b64 = await leggiFileBase64(file);
      comparaState[lettera] = { name: file.name, size: file.size, b64 };
      slotAggiorna(lettera);
      submitAggiorna();
      if (window.Android && Android.track) Android.track('compara_pdf_uploaded', JSON.stringify({slot: lettera.toUpperCase()}));
    } catch (e) {
      if (window.Android && Android.showToast) Android.showToast('Errore lettura PDF');
    }
  }

  function slotAggiorna(lettera) {
    const slot = document.getElementById('slot-' + lettera);
    const data = comparaState[lettera];
    const btnUpload = slot.querySelector('.slot-btn-upload');
    const info = slot.querySelector('.slot-info');
    if (data) {
      slot.dataset.stato = 'pronto';
      btnUpload.hidden = true;
      info.hidden = false;
      info.querySelector('.slot-filename').textContent = data.name;
      info.querySelector('.slot-size').textContent = fmtSize(data.size);
    } else {
      slot.dataset.stato = 'vuoto';
      btnUpload.hidden = false;
      info.hidden = true;
    }
  }

  function slotPulisci(lettera) {
    comparaState[lettera] = null;
    slotAggiorna(lettera);
    submitAggiorna();
    document.getElementById('file-' + lettera).value = '';
  }

  function submitAggiorna() {
    const btn = document.getElementById('compara-submit');
    btn.disabled = !(comparaState.a && comparaState.b);
  }

  // Wiring: input change + bottoni rimuovi
  document.getElementById('file-a').addEventListener('change', (e) => handleUpload('a', e.target.files && e.target.files[0]));
  document.getElementById('file-b').addEventListener('change', (e) => handleUpload('b', e.target.files && e.target.files[0]));
  document.querySelector('#slot-a .slot-btn-remove').addEventListener('click', () => slotPulisci('a'));
  document.querySelector('#slot-b .slot-btn-remove').addEventListener('click', () => slotPulisci('b'));

  // Tracking entry
  window.comparaTrackEntry = function() {
    if (window.Android && Android.track) Android.track('compara_start', '{}');
  };

  // Espongo lo state ad altri script
  window._comparaState = comparaState;
})();
</script>
```

- [ ] **Step 2: Triggerare `compara_start` quando si entra nello screen**

Trova la funzione di navigazione (es. `goTo`) e dentro, dove rileva che la destinazione è `'compara'`, aggiungere una chiamata a `comparaTrackEntry()`. Esempio di pattern:

```js
function goTo(screen) {
  // ...esistente...
  if (screen === 'compara' && window.comparaTrackEntry) window.comparaTrackEntry();
}
```

Se non c'è un punto centralizzato, aggancia un listener al bottone "⚖️ Confronta 2 polizze" in Task 5.

- [ ] **Step 3: Verifica con browser locale**

Riapri `index.html`. Vai su `screen-compara`. Per testare l'upload in browser desktop (senza l'app), il bottone "+ Carica PDF" deve aprire il file picker. Seleziona 2 PDF qualsiasi < 20MB. Verifica:
- I 2 slot mostrano nome file e size
- Il bottone "Confronta polizze" non è più disabilitato
- Tap su "Rimuovi" di uno slot ripristina stato "vuoto" e ridisabilita "Confronta"
- Tentativo di caricare un file > 20 MB mostra alert "PDF troppo grande"

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project"
git add app/src/main/assets/www/index.html
git commit -m "compara webview: upload PDF + state machine slot"
```

---

### Task 7: WebView — submit + paywall + loading state

**Files:**
- Modify: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\assets\www\index.html`

**Interfaces:**
- Consumes: `comparaState` (Task 6), endpoint `/api/compara` (Task 3), pattern paywall esistente per `screen-lettera` (codice in localStorage, modal abbonamento).
- Produces: funzione `comparaSubmit()`; chiama l'API tramite il bridge `Android.callAPI`; gestisce paywall (mostra modal Pro identico a quello di `screen-lettera`); imposta loading state con abort.

- [ ] **Step 1: Identificare l'URL base API e il pattern Pro check usato altrove**

Cerca nel file dove vengono fatte le chiamate per `analizza` e `lettera`:

```bash
cd "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/assets/www"
grep -nE "api/analizza|api/lettera|callAPI|paywall|abbonamento" index.html | head -20
```

Annota:
- L'URL base (probabilmente `https://sherlock-polizze-site-five.vercel.app/api/...` o variabile globale)
- Il nome della funzione che mostra il modal paywall (es. `mostraPaywall()` o `apriModalPro()`)
- Il metodo di lettura del codice Pro (es. `localStorage.getItem('codicePro')`)

I prossimi step usano `API_BASE`, `mostraPaywall`, `getCodicePro()` come placeholder: sostituiscili coi nomi reali.

- [ ] **Step 2: Aggiungere `comparaSubmit` + abort handling**

Subito sotto allo script di Task 6 (dentro lo stesso IIFE o in uno nuovo):

```html
<script>
(function() {
  let comparaController = null;

  async function comparaSubmit() {
    const state = window._comparaState;
    if (!state || !state.a || !state.b) return;

    const codice = getCodicePro();  // ← sostituisci con il pattern reale
    if (!codice) {
      mostraPaywall();              // ← sostituisci con il pattern reale
      if (window.Android && Android.track) Android.track('compara_paywall_hit', '{}');
      return;
    }

    // Stato loading
    document.getElementById('compara-submit').hidden = true;
    document.getElementById('compara-result').hidden = true;
    document.getElementById('compara-error').hidden = true;
    document.getElementById('compara-loading').hidden = false;

    if (window.Android && Android.track) {
      Android.track('compara_submit', JSON.stringify({
        size_a_kb: Math.round(state.a.size / 1024),
        size_b_kb: Math.round(state.b.size / 1024),
      }));
    }

    const t0 = Date.now();
    comparaController = new AbortController();

    try {
      const r = await fetch(API_BASE + '/api/compara', {  // ← sostituisci API_BASE
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polizzaA: state.a.b64,
          polizzaB: state.b.b64,
          codice,
          lang: (window.currentLang || 'it'),
        }),
        signal: comparaController.signal,
      });
      const data = await r.json();
      if (r.status === 402 && data && data.paywall) {
        mostraPaywall();
        comparaReset();
        if (window.Android && Android.track) Android.track('compara_paywall_hit', '{}');
        return;
      }
      if (!r.ok) {
        comparaMostraErrore(data?.errore || ('Errore HTTP ' + r.status));
        if (window.Android && Android.track) Android.track('compara_error', JSON.stringify({error: data?.errore || ('HTTP_' + r.status)}));
        return;
      }
      // Successo → handing over al renderer (Task 8)
      window._comparaUltimoRisultato = data;
      comparaRender(data);
      if (window.Android && Android.track) {
        Android.track('compara_success', JSON.stringify({
          ms: Date.now() - t0,
          vantaggio_verdetto: data.verdetto?.raccomandazione || 'unknown',
        }));
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        comparaReset();
        return;
      }
      comparaMostraErrore('Errore di rete: ' + (e.message || e));
      if (window.Android && Android.track) Android.track('compara_error', JSON.stringify({error: String(e.message || e).slice(0, 200)}));
    } finally {
      document.getElementById('compara-loading').hidden = true;
    }
  }

  function comparaReset() {
    document.getElementById('compara-submit').hidden = false;
    document.getElementById('compara-loading').hidden = true;
    document.getElementById('compara-result').hidden = true;
    document.getElementById('compara-error').hidden = true;
  }

  function comparaMostraErrore(msg) {
    const el = document.getElementById('compara-error');
    el.textContent = msg;
    el.hidden = false;
    document.getElementById('compara-submit').hidden = false;
  }

  // Stub: implementato in Task 8
  if (typeof window.comparaRender !== 'function') {
    window.comparaRender = function() { /* riempito in Task 8 */ };
  }

  document.getElementById('compara-submit').addEventListener('click', comparaSubmit);
  document.getElementById('compara-abort').addEventListener('click', () => {
    if (comparaController) comparaController.abort();
  });
})();
</script>
```

**Sostituzioni richieste prima di salvare:**
- `API_BASE` → la variabile/literal usata da `analizza`/`lettera` (es. `''` se relative, oppure `https://sherlock-polizze-site-five.vercel.app`)
- `getCodicePro()` → la chiamata reale (es. `localStorage.getItem('sherlock_codice_pro')`)
- `mostraPaywall()` → la funzione reale (es. `apriModalPro()`)

- [ ] **Step 3: Test smoke nel browser desktop**

Riapri `index.html`. Vai su `screen-compara`, carica 2 PDF, clicca "Confronta polizze". Senza codice Pro deve apparire il modal paywall (lo stesso visto per `screen-lettera`). Con codice Pro valido la chiamata parte verso il backend.

Per testarlo serve il backend live: per ora puoi anche limitarti a verificare in console che la chiamata `fetch` parta correttamente verso l'URL atteso (DevTools → Network tab).

- [ ] **Step 4: Commit**

```bash
git add app/src/main/assets/www/index.html
git commit -m "compara webview: submit + paywall + loading state con abort"
```

---

### Task 8: WebView — render risultato (verdetto + tabella + sezioni espandibili) + condividi + Nuovo confronto

**Files:**
- Modify: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\assets\www\index.html`

**Interfaces:**
- Consumes: `window._comparaUltimoRisultato` (Task 7), `Android.shareText(text, subject)` dal bridge nativo.
- Produces: funzione `comparaRender(data)` che riempie `#compara-result` con HTML; `comparaShare()`; `comparaNuovoConfronto()` che ripulisce lo state e torna allo stato "vuoto".

- [ ] **Step 1: Implementare il renderer in uno script dedicato**

Subito sotto allo script di Task 7, aggiungere:

```html
<script>
(function() {
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
    })[c]);
  }

  function vantaggioBadge(v) {
    if (v === 'a') return '<span class="badge badge-a">A vince</span>';
    if (v === 'b') return '<span class="badge badge-b">B vince</span>';
    if (v === 'pari') return '<span class="badge badge-pari">=</span>';
    return '<span class="badge badge-nc">—</span>';
  }

  function gravitaBadge(g) {
    const cls = g === 'alta' ? 'grav-alta' : g === 'media' ? 'grav-media' : 'grav-bassa';
    return `<span class="badge ${cls}">${esc(g)}</span>`;
  }

  function impattoBadge(i) {
    const cls = i === 'alto' ? 'imp-alto' : i === 'medio' ? 'imp-medio' : 'imp-basso';
    return `<span class="badge ${cls}">${esc(i)}</span>`;
  }

  function sezioneEspandibile(idSuffix, titolo, count, contenutoHtml) {
    return `
      <details class="cmp-section">
        <summary>${esc(titolo)} <span class="cmp-section-count">(${count})</span></summary>
        <div class="cmp-section-body">${contenutoHtml || '<p class="cmp-empty">Nessun elemento.</p>'}</div>
      </details>
    `;
  }

  window.comparaRender = function(data) {
    const polA = data.polizze?.[0] || { compagnia: 'A', tipo_polizza: '?' };
    const polB = data.polizze?.[1] || { compagnia: 'B', tipo_polizza: '?' };
    const verdetto = data.verdetto || {};
    const sintesi = Array.isArray(data.tabella_sintesi) ? data.tabella_sintesi : [];
    const diff = Array.isArray(data.differenze_chiave) ? data.differenze_chiave : [];
    const exA = Array.isArray(data.esclusioni_solo_a) ? data.esclusioni_solo_a : [];
    const exB = Array.isArray(data.esclusioni_solo_b) ? data.esclusioni_solo_b : [];
    const copA = Array.isArray(data.coperture_solo_a) ? data.coperture_solo_a : [];
    const copB = Array.isArray(data.coperture_solo_b) ? data.coperture_solo_b : [];

    const racc = verdetto.raccomandazione;
    const raccLabel = racc === 'a'
      ? `Sherlock raccomanda <strong>Polizza A — ${esc(polA.compagnia)}</strong>`
      : racc === 'b'
        ? `Sherlock raccomanda <strong>Polizza B — ${esc(polB.compagnia)}</strong>`
        : 'Sherlock: <strong>dipende dal profilo</strong>';

    const avvisoHtml = data.avviso_compatibilita
      ? `<div class="cmp-warn">⚠️ ${esc(data.avviso_compatibilita)}</div>`
      : '';

    const sintesiRighe = sintesi.map((r) => `
      <tr>
        <td>${esc(r.aspetto)}</td>
        <td>${esc(r.valore_a)}</td>
        <td>${esc(r.valore_b)}</td>
        <td>${vantaggioBadge(r.vantaggio)}</td>
      </tr>
    `).join('');

    const diffHtml = diff.map((d) => `
      <div class="cmp-diff-item">
        <div class="cmp-diff-head">
          ${esc(d.titolo)} ${impattoBadge(d.impatto)} ${vantaggioBadge(d.vantaggio)}
        </div>
        <p>${esc(d.descrizione)}</p>
      </div>
    `).join('');

    const exListHtml = (list) => list.map((e) => `
      <div class="cmp-ex-item">
        <div class="cmp-ex-head">${esc(e.titolo)} ${gravitaBadge(e.gravita)}</div>
        <p>${esc(e.descrizione)}</p>
      </div>
    `).join('');

    const copListHtml = (list) => list.map((c) => `
      <div class="cmp-cop-item">
        <strong>${esc(c.titolo)}</strong>
        <p>${esc(c.descrizione)}</p>
      </div>
    `).join('');

    document.getElementById('compara-result').innerHTML = `
      ${avvisoHtml}
      <div class="cmp-verdict">
        <div class="cmp-verdict-head">${raccLabel}</div>
        <p class="cmp-verdict-motiv">${esc(verdetto.motivazione || '')}</p>
        <div class="cmp-verdict-when">
          <div><strong>Scegli A se:</strong> ${esc(verdetto.quando_scegliere_a || '—')}</div>
          <div><strong>Scegli B se:</strong> ${esc(verdetto.quando_scegliere_b || '—')}</div>
        </div>
        <div class="cmp-caveat">${esc(verdetto.caveat || '')}</div>
      </div>

      <div class="cmp-table-wrap">
        <table class="cmp-table">
          <thead>
            <tr>
              <th>Aspetto</th>
              <th>Polizza A<br><small>${esc(polA.compagnia)}</small></th>
              <th>Polizza B<br><small>${esc(polB.compagnia)}</small></th>
              <th>Vantaggio</th>
            </tr>
          </thead>
          <tbody>${sintesiRighe || '<tr><td colspan="4" class="cmp-empty">Nessuna sintesi disponibile.</td></tr>'}</tbody>
        </table>
      </div>

      ${sezioneEspandibile('diff', 'Differenze chiave', diff.length, diffHtml)}
      ${sezioneEspandibile('exa', 'Esclusioni solo in A', exA.length, exListHtml(exA))}
      ${sezioneEspandibile('exb', 'Esclusioni solo in B', exB.length, exListHtml(exB))}
      ${sezioneEspandibile('copa', 'Coperture solo in A', copA.length, copListHtml(copA))}
      ${sezioneEspandibile('copb', 'Coperture solo in B', copB.length, copListHtml(copB))}

      <div class="cmp-actions">
        <button class="btn-secondary" id="compara-condividi">📤 Condividi</button>
        <button class="btn-secondary" id="compara-nuovo">↩ Nuovo confronto</button>
      </div>
    `;
    document.getElementById('compara-result').hidden = false;

    document.getElementById('compara-condividi').addEventListener('click', comparaShare);
    document.getElementById('compara-nuovo').addEventListener('click', comparaNuovoConfronto);
  };

  function risultatoMarkdown(data) {
    const polA = data.polizze?.[0] || {};
    const polB = data.polizze?.[1] || {};
    const v = data.verdetto || {};
    const sintesi = (data.tabella_sintesi || []).map((r) => `- ${r.aspetto}: A=${r.valore_a} | B=${r.valore_b} (${r.vantaggio})`).join('\n');
    return [
      `Sherlock — Confronto polizze`,
      `A: ${polA.compagnia || ''} (${polA.tipo_polizza || ''})`,
      `B: ${polB.compagnia || ''} (${polB.tipo_polizza || ''})`,
      ``,
      `Verdetto: ${v.raccomandazione}`,
      `${v.motivazione || ''}`,
      ``,
      `Sintesi:`,
      sintesi,
      ``,
      `${v.caveat || ''}`,
      ``,
      `Analizzato con Sherlock — Il Detective Assicurativo`,
    ].join('\n');
  }

  function comparaShare() {
    const data = window._comparaUltimoRisultato;
    if (!data) return;
    const text = risultatoMarkdown(data);
    if (window.Android && Android.shareText) {
      Android.shareText(text, 'Sherlock — Confronto polizze');
    } else if (navigator.share) {
      navigator.share({ title: 'Sherlock — Confronto polizze', text });
    } else {
      navigator.clipboard?.writeText(text);
      alert('Copiato negli appunti.');
    }
    if (window.Android && Android.track) Android.track('compara_share', '{}');
  }

  function comparaNuovoConfronto() {
    window._comparaState.a = null;
    window._comparaState.b = null;
    document.getElementById('file-a').value = '';
    document.getElementById('file-b').value = '';
    // Resetta i 2 slot via lo stesso pattern di Task 6
    ['a','b'].forEach((l) => {
      const slot = document.getElementById('slot-' + l);
      slot.dataset.stato = 'vuoto';
      slot.querySelector('.slot-btn-upload').hidden = false;
      slot.querySelector('.slot-info').hidden = true;
    });
    document.getElementById('compara-submit').disabled = true;
    document.getElementById('compara-submit').hidden = false;
    document.getElementById('compara-result').hidden = true;
    document.getElementById('compara-result').innerHTML = '';
    window._comparaUltimoRisultato = null;
  }
})();
</script>
```

- [ ] **Step 2: Aggiungere CSS per la sezione risultati**

Sotto al CSS di Task 5, aggiungere:

```css
#compara-result .cmp-warn {
  background: rgba(255,193,7,.15); border: 1px solid rgba(255,193,7,.4);
  color: #ffe082; padding: 12px; border-radius: 8px; margin-bottom: 16px;
}
#compara-result .cmp-verdict {
  background: linear-gradient(135deg, #0e1428, #1a2342);
  border: 1px solid #d4a544; border-radius: 12px; padding: 16px; margin-bottom: 16px;
}
#compara-result .cmp-verdict-head { font-size: 16px; color: #fff; margin-bottom: 8px; }
#compara-result .cmp-verdict-motiv { color: #d6dcef; font-size: 14px; line-height: 1.5; margin-bottom: 12px; }
#compara-result .cmp-verdict-when { display: grid; gap: 6px; font-size: 13px; color: #b9c0d6; margin-bottom: 12px; }
#compara-result .cmp-caveat {
  background: rgba(255,255,255,.05); border-left: 3px solid #7a86a8;
  padding: 8px 12px; font-size: 11px; color: #b9c0d6; font-style: italic;
}
#compara-result .cmp-table-wrap { overflow-x: auto; margin-bottom: 16px; }
#compara-result .cmp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
#compara-result .cmp-table th, #compara-result .cmp-table td {
  padding: 8px 10px; border-bottom: 1px solid #2a3759; text-align: left; vertical-align: top;
}
#compara-result .cmp-table th { background: #0e1428; color: #b9c0d6; font-weight: 600; }
#compara-result .cmp-empty { color: #7a86a8; font-style: italic; }
#compara-result .cmp-section { margin-bottom: 8px; border: 1px solid #2a3759; border-radius: 8px; overflow: hidden; }
#compara-result .cmp-section > summary { padding: 12px; background: #0e1428; cursor: pointer; color: #d6dcef; }
#compara-result .cmp-section-count { color: #7a86a8; font-size: 12px; }
#compara-result .cmp-section-body { padding: 12px; background: #070b18; }
#compara-result .cmp-diff-item, #compara-result .cmp-ex-item, #compara-result .cmp-cop-item {
  margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #2a3759;
}
#compara-result .cmp-diff-item:last-child, #compara-result .cmp-ex-item:last-child, #compara-result .cmp-cop-item:last-child {
  border-bottom: none; margin-bottom: 0; padding-bottom: 0;
}
#compara-result .cmp-diff-head, #compara-result .cmp-ex-head {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-weight: 600;
}
#compara-result .badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px;
  font-weight: bold; text-transform: uppercase;
}
#compara-result .badge-a { background: rgba(76,175,80,.2); color: #81c784; }
#compara-result .badge-b { background: rgba(33,150,243,.2); color: #64b5f6; }
#compara-result .badge-pari { background: rgba(158,158,158,.2); color: #bdbdbd; }
#compara-result .badge-nc { background: rgba(158,158,158,.1); color: #757575; }
#compara-result .grav-alta, #compara-result .imp-alto { background: rgba(244,67,54,.2); color: #ef9a9a; }
#compara-result .grav-media, #compara-result .imp-medio { background: rgba(255,152,0,.2); color: #ffcc80; }
#compara-result .grav-bassa, #compara-result .imp-basso { background: rgba(158,158,158,.2); color: #bdbdbd; }
#compara-result .cmp-actions { display: flex; gap: 8px; margin-top: 16px; }
#compara-result .cmp-actions .btn-secondary {
  flex: 1; padding: 12px; background: transparent; border: 1px solid #d4a544;
  color: #d4a544; border-radius: 8px; cursor: pointer;
}
```

- [ ] **Step 3: Smoke test con risposta API simulata**

Aggiungi temporaneamente nel DevTools console del browser (dopo aver navigato a `screen-compara`):

```js
window.comparaRender({
  polizze: [
    { etichetta:'A', compagnia:'Unipol', tipo_polizza:'Casa' },
    { etichetta:'B', compagnia:'Generali', tipo_polizza:'Casa' },
  ],
  avviso_compatibilita: null,
  tabella_sintesi: [
    { aspetto:'Massimale RC', valore_a:'€500.000', valore_b:'€300.000', vantaggio:'a' },
    { aspetto:'Furto', valore_a:'Sì', valore_b:'No', vantaggio:'a' },
    { aspetto:'Franchigia', valore_a:'€250', valore_b:'€100', vantaggio:'b' },
  ],
  differenze_chiave: [
    { titolo:'Massimale più alto', descrizione:'A protegge eventi più gravi.', impatto:'alto', vantaggio:'a' },
  ],
  esclusioni_solo_a: [],
  esclusioni_solo_b: [{ titolo:'Eventi atmosferici', descrizione:'B esclude...', gravita:'alta' }],
  coperture_solo_a: [{ titolo:'Furto', descrizione:'A include...' }],
  coperture_solo_b: [],
  verdetto: {
    raccomandazione:'a',
    motivazione:'A offre più copertura per importo simile.',
    caveat:'Valutazione algoritmica, non sostituisce consulenza professionale.',
    quando_scegliere_a:'Vuoi protezione completa contro furto.',
    quando_scegliere_b:'Hai vincolo di budget mensile stretto.',
  },
});
document.getElementById('compara-result').hidden = false;
```

Atteso: verdetto in evidenza, tabella renderizzata, sezioni espandibili con badge colorati. Tap su "↩ Nuovo confronto" pulisce e torna allo stato vuoto.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/assets/www/index.html
git commit -m "compara webview: renderer verdetto + tabella + sezioni espandibili"
```

---

### Task 9: Android — risorse pre-splash (drawable + colors.xml)

**Files:**
- Create: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\res\drawable-nodpi\pre_splash.png`
- Create: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\res\values\colors.xml`

**Interfaces:**
- Consumes: file `C:\Users\Stefano\Downloads\Gemini_Generated_Image_.png` (l'immagine fornita dall'utente).
- Produces: drawable `R.drawable.pre_splash` accessibile da `MainActivity` (Task 10).

- [ ] **Step 1: Verificare che l'immagine sorgente esista**

```bash
ls -lh "/c/Users/Stefano/Downloads/Gemini_Generated_Image_.png" 2>&1
```

Atteso: file esiste, dimensione > 100 KB.

Se NON esiste, cerca alternative:
```bash
ls "/c/Users/Stefano/Downloads/" | grep -iE 'gemini|sherlock_launch|pre_splash|splash'
```

E chiedi all'utente conferma del file giusto da copiare.

- [ ] **Step 2: Creare la cartella drawable-nodpi se non esiste**

```bash
mkdir -p "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/res/drawable-nodpi"
```

- [ ] **Step 3: Copiare l'immagine come `pre_splash.png`**

```bash
cp "/c/Users/Stefano/Downloads/Gemini_Generated_Image_.png" \
   "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/res/drawable-nodpi/pre_splash.png"
ls -lh "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/res/drawable-nodpi/pre_splash.png"
```

Atteso: file copiato, stessa dimensione dell'originale.

- [ ] **Step 4: Creare `colors.xml`**

Crea `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\res\values\colors.xml` con:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="pre_splash_bg">#070b18</color>
</resources>
```

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project"
git add app/src/main/res/drawable-nodpi/pre_splash.png app/src/main/res/values/colors.xml
git commit -m "android: risorse pre-splash (drawable + colors)"
```

---

### Task 10: Android — overlay pre-splash in `MainActivity.java`

**Files:**
- Modify: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\java\it\sherlock\polizze\MainActivity.java`

**Interfaces:**
- Consumes: `R.drawable.pre_splash` (Task 9), `R.color.pre_splash_bg` (Task 9), API esistente Android `View.animate()`, `FrameLayout` già usato in `MainActivity.onCreate`.
- Produces: pre-splash overlay 4s con tap-to-skip, fade-out 350ms, idempotente vs timer/tap; cold start ogni volta (no SharedPreferences, no warm-start trigger).

- [ ] **Step 1: Aggiungere import `ImageView`**

In `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\src\main\java\it\sherlock\polizze\MainActivity.java`, sotto l'import esistente di `android.widget.FrameLayout`, aggiungere:

```java
import android.widget.ImageView;
```

- [ ] **Step 2: Inserire il blocco overlay subito prima di `webView.loadUrl(...)`**

Sostituire la singola riga:

```java
        webView.loadUrl("file:///android_asset/www/index.html");
```

con:

```java
        // --- Pre-splash overlay (v4.2): immagine 4s, tap-to-skip, fade 350ms ---
        // Sta sopra alla WebView nel FrameLayout esistente. La WebView carica in
        // parallelo dietro l'overlay, così quando il fade finisce lo splash HTML
        // è già visibile (no flash bianco).
        final ImageView preSplash = new ImageView(this);
        preSplash.setImageResource(R.drawable.pre_splash);
        preSplash.setScaleType(ImageView.ScaleType.CENTER_CROP);
        preSplash.setBackgroundColor(BG);
        preSplash.setClickable(true);  // intercetta tap, non passa alla WebView sotto
        root.addView(preSplash, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        webView.loadUrl("file:///android_asset/www/index.html");

        final Runnable removeOverlay = new Runnable() {
            @Override public void run() {
                if (preSplash.getParent() == null) return; // idempotenza: già rimosso
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

- [ ] **Step 3: Verifica compilazione**

Apri Android Studio sul progetto (`sherlock_project_patched/sherlock_project`) e premi **Build → Make Project**. Atteso: BUILD SUCCESSFUL, niente errori di compilazione.

In alternativa via CLI (se hai gradlew configurato):
```bash
cd "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project"
./gradlew assembleDebug
```

Atteso: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/it/sherlock/polizze/MainActivity.java
git commit -m "android: pre-splash overlay 4s con tap-to-skip e fade 350ms"
```

---

### Task 11: Android — bump versione `build.gradle`

**Files:**
- Modify: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\build.gradle`

**Interfaces:**
- Consumes: niente.
- Produces: versionCode 52, versionName '4.2' nel manifest dell'APK/AAB.

- [ ] **Step 1: Bump dei due valori**

In `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\build.gradle`, sostituire:

```gradle
        versionCode 51
        versionName '4.1'
```

con:

```gradle
        versionCode 52
        versionName '4.2'
```

- [ ] **Step 2: Verifica build AAB release (richiede keystore)**

```bash
cd "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project"
./gradlew bundleRelease
```

Atteso: `BUILD SUCCESSFUL` e file generato in `app/build/outputs/bundle/release/app-release.aab`.

Se il keystore non è configurato (env vars `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, ecc.), assicurati che il file `keystore/sherlock_release.keystore` esista e che le credenziali default in `build.gradle` siano applicabili.

- [ ] **Step 3: Commit**

```bash
git add app/build.gradle
git commit -m "android: bump versione a 4.2 (versionCode 52)"
```

---

### Task 12: Deploy backend & verifica `/admin` end-to-end

**Files:**
- Tutti i commit del Blocco A (Task 1-4) già su `main` locale.

**Interfaces:**
- Consumes: API `/api/compara` (Task 3), dashboard `/admin` (Task 4).
- Produces: deploy production su Vercel con la nuova feature live.

- [ ] **Step 1: Push del branch main**

```bash
cd /c/Users/Stefano/sherlock-site
git push origin main
```

Atteso: `<hash_prima>..<hash_dopo>  main -> main`.

- [ ] **Step 2: Attesa deploy Vercel + verifica**

Vercel auto-deployerà su push. Aspetta 1-2 minuti, poi verifica:

```bash
curl -sS -X POST https://sherlock-polizze-site-five.vercel.app/api/compara \
  -H 'Content-Type: application/json' -d '{}' | head -c 200
echo
```

Atteso: `{"errore":"Campi polizzaA, polizzaB e codice obbligatori"}`. Se invece restituisce 404 il deploy non è ancora finito — riprova.

- [ ] **Step 3: Verifica dashboard nuova card**

Vai su `https://sherlock-polizze-site-five.vercel.app/admin` (con login admin). Atteso: la sezione "Utilizzo API" ha **6 card**, l'ultima nuova ("Richieste compara") mostra `0` con sottotitolo `err: 0 · bloc: 0`. Le card "Bloccate (tot.)" e "Errori AI (tot.)" hanno breakdown `an: X · le: Y · cp: 0 · pre: K`.

Se l'output corrisponde, il backend è live.

---

### Task 13: Build AAB v4.2 + install su device + smoke test completo

**Files:**
- Output: `app/build/outputs/bundle/release/app-release.aab` (da upload manuale su Play Console).

**Interfaces:**
- Consumes: tutti i commit del Blocco B (WebView UI) e Blocco C (pre-splash + bump).
- Produces: AAB firmato da uploadare su Play Console come "Sherlock v4.2".

- [ ] **Step 1: Build APK debug per smoke test su device**

```bash
cd "/c/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project"
./gradlew assembleDebug
ls -lh app/build/outputs/apk/debug/app-debug.apk
```

Atteso: APK creato in `app/build/outputs/apk/debug/`.

- [ ] **Step 2: Install su device fisico (USB debugging attivo)**

```bash
adb devices  # verifica che il device sia visibile
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Atteso: `Success`.

- [ ] **Step 3: Smoke test end-to-end manuale**

Sul device:

1. **Pre-splash cold start**: Force-stop dell'app, riaprila → vedi l'immagine Sherlock per ~4 secondi → fade → splash HTML animato → home.
2. **Pre-splash tap-to-skip**: Force-stop, riapri, tap sull'immagine entro 1 secondo → fade immediato → splash HTML.
3. **Pre-splash warm start NON appare**: dopo che l'app è aperta, premi home, poi riapri dal recents → niente pre-splash, va direttamente alla home.
4. **Compara — entry point**: dalla home, tap sul bottone "⚖️ Confronta 2 polizze" → screen-compara con 2 slot vuoti.
5. **Compara — paywall (senza codice Pro)**: rimuovi temporaneamente il codice Pro dal localStorage (via DevTools remote inspector) o usa un account fresh. Carica 2 PDF, tap "Confronta" → modal paywall identico a quello della lettera.
6. **Compara — flusso completo (con codice Pro valido)**: carica 2 PDF di polizze reali (es. casa Unipol vs casa Generali se ce li hai, altrimenti 2 polizze qualsiasi del settore), tap "Confronta" → loader ~30-40s → renderer mostra verdetto + tabella + sezioni espandibili. Espandi una sezione: contenuto leggibile.
7. **Compara — condividi**: tap "📤 Condividi" → si apre il system chooser Android con il testo del confronto formattato. Annulla.
8. **Compara — nuovo confronto**: tap "↩ Nuovo confronto" → torna a stato vuoto con bottone disabilitato.
9. **Compara — back button**: dallo screen-compara premi back → torna a home.
10. **Dashboard check**: dopo 1 confronto riuscito su prod, `/admin` mostra `Richieste compara: 1` (atteso ~5s di latenza per il counter Upstash).
11. **Analytics check**: in Firebase Analytics dashboard, vedi gli eventi `compara_start`, `compara_pdf_uploaded`, `compara_submit`, `compara_success` con timestamp recente.

Se tutti i 11 passano: smoke test verde.

- [ ] **Step 4: Build AAB release**

```bash
./gradlew bundleRelease
ls -lh app/build/outputs/bundle/release/app-release.aab
```

Atteso: file `.aab` creato.

- [ ] **Step 5: Rinomina file con convenzione di progetto**

Convenzione vista in `C:\Users\Stefano\Downloads\Sherlock app final\` (es. `Sherlock-v4.1-vc51.aab`):

```bash
cp app/build/outputs/bundle/release/app-release.aab \
   "/c/Users/Stefano/Downloads/Sherlock app final/Sherlock-v4.2-vc52.aab"
ls -lh "/c/Users/Stefano/Downloads/Sherlock app final/Sherlock-v4.2-vc52.aab"
```

Atteso: AAB rinominato copiato in Downloads.

- [ ] **Step 6: Upload manuale su Play Console (responsabilità utente)**

Apri https://play.google.com/console → app Sherlock → Release → Production → Crea nuova release → carica `Sherlock-v4.2-vc52.aab` → Release notes:

```
v4.2 — Compara polizze + nuova schermata di apertura

NOVITÀ
- ⚖️ Confronta 2 polizze (Pro): carica due PDF, Sherlock le mette a
  confronto su coperture, esclusioni, franchigie e massimali, con un
  verdetto chiaro e dettagli espandibili.
- Nuova schermata di apertura cinematografica (tap per saltare).

MIGLIORAMENTI
- Dashboard admin: statistiche separate per tipo richiesta.
```

Promuovi a Internal Testing → poi Closed Testing → poi Production secondo il tuo processo. (Il piano si ferma qui, il rollout è scelta tua.)

---

## Self-review

Eseguito inline:

**1. Spec coverage:**
- Sez 1 Architettura → Task 1-4 (backend+dashboard) + Task 5-8 (WebView) + Task 9-11 (Android). ✓
- Sez 2 Schema dati → Task 3 `SCHEMA_CONFRONTO`. ✓
- Sez 3 Flusso utente → Task 5-8 implementano tutti gli stati. ✓
- Sez 4 Prompt AI → Task 3 sistema prompt + tool_use. ✓
- Sez 5 Pre-splash → Task 9-11. ✓
- Sez 6 Errori → Task 2-3 mappa tutti i casi della tabella; logging→ Task 1 + 3; analytics → Task 6-7-8; testing → Task 13. ✓
- Anti-YAGNI → niente cache, niente storico, niente `/compara.astro`, niente test framework. ✓

**2. Placeholder scan:**
- "PLACEHOLDER" usato esplicitamente in Task 5 e 7 dove l'engineer deve sostituire `goTo`/`API_BASE`/`mostraPaywall`/`getCodicePro` con i nomi reali del progetto: questo è atteso (la SPA esistente ha pattern propri che non possiamo conoscere senza leggere il file). I task richiedono comunque una grep iniziale per scoprire i nomi → non sono placeholder ciechi.
- Nessun "TBD"/"TODO"/"implement later" non risolto.

**3. Type consistency:**
- `comparaTotali`/`erroriComparaTotali`/`bloccatiComparaTotali` nomi consistenti in Task 1 e Task 4. ✓
- `report_confronto_polizze` come tool name consistente in Task 3 (system prompt + tool definition + lookup `blocks.find`). ✓
- `_comparaState` / `_comparaUltimoRisultato` coerenti fra Task 6/7/8. ✓
- `R.drawable.pre_splash` consistente fra Task 9 (creazione) e Task 10 (uso). ✓
- `versionCode 52` consistente fra spec, plan Task 11, e nome file AAB Task 13. ✓

Nessun gap. Procedo con execution handoff.
