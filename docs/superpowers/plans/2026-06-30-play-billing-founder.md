# Play Billing — Pass Pro a vita (Founder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrare Google Play Billing v7 in app Sherlock v4.5 per il solo prodotto `founder_lifetime` (19,90 €), eliminando la frizione "ho pagato ma non si attiva".

**Architecture:** 3 lati indipendenti: (1) backend Vercel TypeScript con endpoint `/api/play-billing/verify` che valida purchaseToken via Play Developer API e emette codice virtuale `PLAY-*` salvato in Upstash; (2) app Android Java con `BillingManager.java` che orchestra `BillingClient`, `MainActivity.java` esteso con bridge JsInterface; (3) WebView SPA con paywall ridisegnato che invoca `Android.startPurchase()`.

**Tech Stack:** TypeScript + Astro + Upstash Redis (backend); Java + Android BillingClient 7.1.1 + WebView JsInterface (app); HTML/JS vanilla (WebView UI); Firebase Analytics nativo + GA4 server-side (tracking); Google Play Developer API v3 (verify); vitest (test runner backend, da aggiungere).

## Global Constraints

- **Product ID Play Console**: `founder_lifetime` — case-sensitive, immutabile dopo creazione, hardcoded identico nei 3 lati
- **Package name**: `it.sherlock.polizze`
- **Prezzo**: 19,90 EUR (lifetime, in-app non-consumable)
- **Email**: obbligatoria al checkout — regex `^[^@\s]+@[^@\s]+\.[^@\s]+$` (stessa lato client JS e lato backend)
- **Acknowledge**: lo fa il BACKEND dopo verify success, mai l'app (safety net: Play rimborsa entro 3gg se non ack)
- **Idempotenza**: `/api/play-billing/verify` con stesso purchaseToken deve restituire sempre lo stesso codice
- **Codice virtuale**: prefisso `PLAY-` + 8 hex random (es. `PLAY-A3F8B12C`)
- **Backend base URL**: `https://sherlock-polizze-site-five.vercel.app` (NON l'URL `b46pfkwts-sstefano-s-projects` che è congelato)
- **Version bump app**: `versionCode 54 → 55`, `versionName 4.4 → 4.5`
- **`APP_BUILD` in index.html**: NON tocco (convenzione: cambia solo per reset free trial)
- **Repo backend**: `C:\Users\Stefano\sherlock-site\` (branch `main`)
- **Cartella app**: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\` (NON è un repo git separato — sources nudi)
- **Stile commit backend**: `area: descrizione lowercase`, Co-Authored-By Claude
- **Email tester license**: `stefano.scapigliati@gmail.com`

---

## File Structure

### Backend (`sherlock-site/`)

| File | Tipo | Responsabilità |
|------|------|----------------|
| `package.json` | Modify | Aggiungi `vitest` devDep + script `test` |
| `vitest.config.ts` | Create | Config minima vitest (jsdom non serve) |
| `src/lib/storage.ts` | Modify | Estendi `RecordPro` (`fonte`, `purchaseToken`, `playOrderId`); aggiungi `cercaPerPurchaseToken()`, `salvaPurchaseTokenIndex()` |
| `tests/lib/storage.test.ts` | Create | Test per nuovi campi + lookup token |
| `src/lib/play-billing.ts` | Create | Wrapper Play Developer API (`verifyInappPurchase`, `acknowledgePurchase`) |
| `tests/lib/play-billing.test.ts` | Create | Test con `fetch` mockato per response Play API |
| `src/pages/api/play-billing/verify.ts` | Create | Endpoint POST che orchestra verify + acknowledge + save + idempotenza |
| `tests/api/play-billing-verify.test.ts` | Create | Integration test (mock fetch + mock storage) |

### App Android (`sherlock_project/app/`)

| File | Tipo | Responsabilità |
|------|------|----------------|
| `app/build.gradle` | Modify | Aggiungi `billing:7.1.1` dep + bump `versionCode 54→55`, `versionName 4.4→4.5` |
| `app/src/main/java/it/sherlock/polizze/BillingManager.java` | Create | Wrapper isolato BillingClient (connect, launch, query, callback) |
| `app/src/main/java/it/sherlock/polizze/MainActivity.java` | Modify | Campo `billing`, lifecycle hooks, bridge methods `startPurchase`/`isPlayBillingAvailable`, callback `onPurchaseResult` |
| `app/src/main/assets/www/index.html` | Modify | Paywall ridisegnato + email obbligatoria + funzioni globali `window.onProActivated` ecc. + `startPlayPurchase()` |

---

## Task 1: Setup vitest backend

**Files:**
- Modify: `sherlock-site/package.json`
- Create: `sherlock-site/vitest.config.ts`
- Create: `sherlock-site/tests/.gitkeep`

**Interfaces:**
- Produces: comando `npm test` funzionante che esegue `*.test.ts` sotto `tests/`

- [ ] **Step 1: Aggiungi vitest a devDependencies**

Edit `sherlock-site/package.json`, sezione `devDependencies`:
```json
"devDependencies": {
  "pwa-asset-generator": "^7.0.0",
  "vitest": "^3.2.4"
}
```
E nella sezione `scripts`:
```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "astro": "astro",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: Crea config vitest**

`sherlock-site/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 5000,
  },
});
```

- [ ] **Step 3: Crea cartella tests/ vuota**

```bash
mkdir -p "C:/Users/Stefano/sherlock-site/tests/lib"
mkdir -p "C:/Users/Stefano/sherlock-site/tests/api"
touch "C:/Users/Stefano/sherlock-site/tests/.gitkeep"
```

- [ ] **Step 4: Installa**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm install
```
Expected: `vitest` installato in `node_modules`, nessun errore.

- [ ] **Step 5: Verifica `npm test` non crasha**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm test
```
Expected output: `No test files found, exiting with code 0` (i test arrivano nel Task 2).

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Stefano/sherlock-site"
git add package.json package-lock.json vitest.config.ts tests/.gitkeep
git commit -m "test: setup vitest per backend

Aggiunge vitest come dev dep + script npm test per supportare i test
unitari e di integrazione dell'endpoint play-billing in arrivo.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Estensione `storage.ts` per fonte Play

**Files:**
- Modify: `sherlock-site/src/lib/storage.ts`
- Create: `sherlock-site/tests/lib/storage.test.ts`

**Interfaces:**
- Consumes: tipo esistente `RecordPro`, funzioni esistenti `kvConfigurato`, `getKv`, `salvaCodicePro` (verificare nomi reali leggendo storage.ts)
- Produces:
  - Esteso `type RecordPro`: campi opzionali `fonte?: 'paypal' | 'play'`, `purchaseToken?: string`, `playOrderId?: string`
  - `export async function cercaPerPurchaseToken(token: string): Promise<RecordPro | null>`
  - `export async function salvaPurchaseTokenIndex(token: string, codice: string): Promise<void>`

- [ ] **Step 1: Leggi `src/lib/storage.ts` per capire pattern esistenti**

```bash
cat "C:/Users/Stefano/sherlock-site/src/lib/storage.ts"
```
Identifica: come si chiama la funzione che salva un record? Come si accede a Upstash? Quali sono i nomi delle chiavi Redis? Adatta i nomi nei passi seguenti.

- [ ] **Step 2: Scrivi test fallente per `cercaPerPurchaseToken`**

`sherlock-site/tests/lib/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @upstash/redis prima dell'import del modulo
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    hget: vi.fn(),
    hset: vi.fn(),
  })),
}));

describe('storage Play Billing', () => {
  beforeEach(() => { vi.resetModules(); });

  it('cercaPerPurchaseToken ritorna null se token non in indice', async () => {
    const { cercaPerPurchaseToken } = await import('../../src/lib/storage');
    const result = await cercaPerPurchaseToken('token-inesistente');
    expect(result).toBeNull();
  });

  it('RecordPro accetta campi fonte/purchaseToken/playOrderId opzionali', async () => {
    const mod = await import('../../src/lib/storage');
    // type-only check: deve compilare
    const r: import('../../src/lib/storage').RecordPro = {
      codice: 'PLAY-ABCDEF12',
      email: 'x@y.it',
      piano: 'founder',
      dataAcquisto: '2026-06-30T12:00:00Z',
      dataScadenza: null,
      fonte: 'play',
      purchaseToken: 'opaque-token',
      playOrderId: 'GPA.1234',
    };
    expect(r.fonte).toBe('play');
  });
});
```

- [ ] **Step 3: Esegui test — deve fallire**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm test
```
Expected: FAIL — `cercaPerPurchaseToken is not exported` o TS error sui campi `fonte`/`purchaseToken`/`playOrderId`.

- [ ] **Step 4: Estendi `RecordPro` e aggiungi funzioni**

In `sherlock-site/src/lib/storage.ts`, trova `export type RecordPro` (probabile riga ~140-160) e aggiungi i 3 campi opzionali:
```ts
export type RecordPro = {
  // ...campi esistenti...
  fonte?: 'paypal' | 'play';
  purchaseToken?: string;
  playOrderId?: string;
};
```

In fondo al file (prima di eventuali export aggregati):
```ts
const PLAY_TOKEN_INDEX_PREFIX = 'play_token:';

export async function cercaPerPurchaseToken(token: string): Promise<RecordPro | null> {
  if (!token) return null;
  if (!kvConfigurato()) return null;
  const kv = getKv();
  const codice = await kv.get<string>(`${PLAY_TOKEN_INDEX_PREFIX}${token}`);
  if (!codice) return null;
  // Riusa la funzione di lookup per codice esistente. Sostituisci con il nome reale.
  // Esempi probabili: cercaPerCodice(codice) | leggiRecord(codice).
  return await cercaPerCodice(codice);
}

export async function salvaPurchaseTokenIndex(token: string, codice: string): Promise<void> {
  if (!token || !codice) return;
  if (!kvConfigurato()) return;
  const kv = getKv();
  await kv.set(`${PLAY_TOKEN_INDEX_PREFIX}${token}`, codice);
}
```

**Importante**: il nome di `kvConfigurato`, `getKv`, `cercaPerCodice` potrebbe differire dal codice reale. Leggi prima il file e usa i nomi giusti.

- [ ] **Step 5: Esegui test — devono passare**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm test
```
Expected: 2 test PASS.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Stefano/sherlock-site"
git add src/lib/storage.ts tests/lib/storage.test.ts
git commit -m "storage: estendi RecordPro per fonte 'play' + lookup per purchaseToken

Aggiunge campi opzionali (fonte, purchaseToken, playOrderId) per
distinguere codici emessi via Play Billing da quelli PayPal. Aggiunge
indice secondario play_token:<token> -> codice per idempotenza
dell'endpoint /api/play-billing/verify.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Wrapper Play Developer API (`play-billing.ts`)

**Files:**
- Create: `sherlock-site/src/lib/play-billing.ts`
- Create: `sherlock-site/tests/lib/play-billing.test.ts`

**Interfaces:**
- Consumes: `accessToken(scope: string)` esportato da `src/lib/play.ts` (vedi righe 1-110 di quel file)
- Produces:
  ```ts
  export type PlayPurchase = {
    purchaseState: 0 | 1 | 2;       // 0 PURCHASED, 1 CANCELED, 2 PENDING
    consumptionState: 0 | 1;
    acknowledgementState: 0 | 1;
    purchaseTimeMillis: string;     // stringa Long da Play API
    orderId?: string;
    productId: string;
    purchaseToken: string;
    regionCode?: string;
  };
  export async function verifyInappPurchase(productId: string, purchaseToken: string): Promise<PlayPurchase | { errore: string; status?: number }>;
  export async function acknowledgePurchase(productId: string, purchaseToken: string): Promise<{ ok: true } | { ok: false; errore: string }>;
  ```

- [ ] **Step 1: Verifica che `accessToken` sia esportato da play.ts**

```bash
grep -n "export.*accessToken\|^async function accessToken\|^function accessToken" "C:/Users/Stefano/sherlock-site/src/lib/play.ts"
```
Se NON è esportato, aggiungi `export` davanti alla `function accessToken` in `play.ts` (modifica triviale, una parola).

- [ ] **Step 2: Scrivi test fallente per `verifyInappPurchase`**

`sherlock-site/tests/lib/play-billing.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/play', () => ({
  accessToken: vi.fn().mockResolvedValue('fake-bearer-token'),
}));

describe('play-billing wrapper', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('verifyInappPurchase ritorna il purchase parsato su 200', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        purchaseState: 0,
        consumptionState: 0,
        acknowledgementState: 0,
        purchaseTimeMillis: '1720000000000',
        orderId: 'GPA.1234-5678',
        productId: 'founder_lifetime',
        purchaseToken: 'opaque-token',
        regionCode: 'IT',
      }),
    });
    const { verifyInappPurchase } = await import('../../src/lib/play-billing');
    const r = await verifyInappPurchase('founder_lifetime', 'opaque-token');
    expect('errore' in r).toBe(false);
    if (!('errore' in r)) {
      expect(r.purchaseState).toBe(0);
      expect(r.orderId).toBe('GPA.1234-5678');
    }
  });

  it('verifyInappPurchase ritorna errore con status su 410 INVALID_TOKEN', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({ error: { message: 'Purchase token is no longer valid' } }),
    });
    const { verifyInappPurchase } = await import('../../src/lib/play-billing');
    const r = await verifyInappPurchase('founder_lifetime', 'expired-token');
    expect('errore' in r).toBe(true);
    if ('errore' in r) expect(r.status).toBe(410);
  });

  it('acknowledgePurchase ritorna ok:true su 204', async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: true, status: 204 });
    const { acknowledgePurchase } = await import('../../src/lib/play-billing');
    const r = await acknowledgePurchase('founder_lifetime', 'opaque-token');
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Esegui test — fail (modulo non esiste)**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm test
```
Expected: FAIL — `Cannot find module '../../src/lib/play-billing'`.

- [ ] **Step 4: Implementa `play-billing.ts`**

`sherlock-site/src/lib/play-billing.ts`:
```ts
import { accessToken } from './play';

const PKG = process.env.PLAY_PACKAGE_NAME ?? 'it.sherlock.polizze';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

export type PlayPurchase = {
  purchaseState: 0 | 1 | 2;
  consumptionState: 0 | 1;
  acknowledgementState: 0 | 1;
  purchaseTimeMillis: string;
  orderId?: string;
  productId: string;
  purchaseToken: string;
  regionCode?: string;
};

type ApiError = { errore: string; status?: number };

export async function verifyInappPurchase(
  productId: string,
  purchaseToken: string,
): Promise<PlayPurchase | ApiError> {
  try {
    const token = await accessToken(SCOPE);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}) as any);
      return { errore: body?.error?.message ?? `HTTP ${r.status}`, status: r.status };
    }
    const data = (await r.json()) as any;
    return {
      purchaseState: data.purchaseState ?? 0,
      consumptionState: data.consumptionState ?? 0,
      acknowledgementState: data.acknowledgementState ?? 0,
      purchaseTimeMillis: String(data.purchaseTimeMillis ?? ''),
      orderId: data.orderId,
      productId,
      purchaseToken,
      regionCode: data.regionCode,
    };
  } catch (e: any) {
    return { errore: e?.message ?? String(e) };
  }
}

export async function acknowledgePurchase(
  productId: string,
  purchaseToken: string,
): Promise<{ ok: true } | { ok: false; errore: string }> {
  try {
    const token = await accessToken(SCOPE);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!r.ok && r.status !== 204) {
      const body = await r.json().catch(() => ({}) as any);
      return { ok: false, errore: body?.error?.message ?? `HTTP ${r.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, errore: e?.message ?? String(e) };
  }
}
```

- [ ] **Step 5: Esegui test — devono passare**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm test
```
Expected: 5 test PASS (2 storage + 3 play-billing).

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Stefano/sherlock-site"
git add src/lib/play-billing.ts tests/lib/play-billing.test.ts
# Eventualmente anche src/lib/play.ts se hai aggiunto export ad accessToken
git add src/lib/play.ts 2>/dev/null || true
git commit -m "play-billing: wrapper Play Developer API (verify + acknowledge)

Aggiunge wrapper su androidpublisher.googleapis.com per verificare e
acknowledge dei purchase token di in-app product (founder_lifetime).
Riusa accessToken() esistente in lib/play.ts aggiungendo scope
androidpublisher.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Endpoint `/api/play-billing/verify`

**Files:**
- Create: `sherlock-site/src/pages/api/play-billing/verify.ts`
- Create: `sherlock-site/tests/api/play-billing-verify.test.ts`

**Interfaces:**
- Consumes: `verifyInappPurchase`, `acknowledgePurchase` da `src/lib/play-billing.ts`; `cercaPerPurchaseToken`, `salvaPurchaseTokenIndex`, e funzioni esistenti di insert codice (vedi storage.ts) da `src/lib/storage.ts`; helper `ga4TrackServer` da `src/lib/log.ts` o equivalente (verifica)
- Produces: endpoint POST che accetta `{ purchaseToken, productId, email }`, risposte 200 `{ codice, piano, dataScadenza }` o 400/409/502 con `error` slug

- [ ] **Step 1: Verifica nome reale della funzione che inserisce un codice in storage.ts**

```bash
grep -nE "^export async function (salva|insert|crea|aggiungi).*Pro|^export async function .*Codice" "C:/Users/Stefano/sherlock-site/src/lib/storage.ts"
```
Annota il nome corretto (es. `salvaCodicePro(record: RecordPro)`). Useralo nello Step 3.

- [ ] **Step 2: Verifica che `ga4TrackServer` esista e dove**

```bash
grep -rn "export.*function ga4TrackServer\|export const ga4TrackServer" "C:/Users/Stefano/sherlock-site/src/lib/"
```
Annota path import corretto (probabile `../../lib/log` o `../../lib/ga4`).

- [ ] **Step 3: Scrivi test fallente per l'endpoint**

`sherlock-site/tests/api/play-billing-verify.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/play-billing', () => ({
  verifyInappPurchase: vi.fn(),
  acknowledgePurchase: vi.fn(),
}));

vi.mock('../../src/lib/storage', () => ({
  cercaPerPurchaseToken: vi.fn(),
  salvaPurchaseTokenIndex: vi.fn(),
  salvaCodicePro: vi.fn(),  // SOSTITUISCI con il nome reale dello Step 1
}));

vi.mock('../../src/lib/log', () => ({
  ga4TrackServer: vi.fn(),
}));

import { POST } from '../../src/pages/api/play-billing/verify';
import * as playBilling from '../../src/lib/play-billing';
import * as storage from '../../src/lib/storage';

function makeReq(body: any): any {
  return { json: async () => body, headers: new Headers() };
}

describe('POST /api/play-billing/verify', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('400 EMAIL_REQUIRED se email assente', async () => {
    const r = await POST({ request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime' }) } as any);
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toBe('EMAIL_REQUIRED');
  });

  it('400 INVALID_PRODUCT se productId non in whitelist', async () => {
    const r = await POST({ request: makeReq({ purchaseToken: 't', productId: 'monthly', email: 'a@b.it' }) } as any);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('INVALID_PRODUCT');
  });

  it('200 ritorna codice esistente se purchaseToken già registrato (idempotenza)', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue({
      codice: 'PLAY-DEADBEEF', piano: 'founder', dataScadenza: null,
    });
    const r = await POST({ request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }) } as any);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.codice).toBe('PLAY-DEADBEEF');
    expect(playBilling.verifyInappPurchase).not.toHaveBeenCalled();
  });

  it('200 verify + acknowledge + emette nuovo codice PLAY-* sul happy path', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue(null);
    (playBilling.verifyInappPurchase as any).mockResolvedValue({
      purchaseState: 0, consumptionState: 0, acknowledgementState: 0,
      purchaseTimeMillis: '1720000000000', orderId: 'GPA.X', productId: 'founder_lifetime', purchaseToken: 't',
    });
    (playBilling.acknowledgePurchase as any).mockResolvedValue({ ok: true });
    (storage.salvaCodicePro as any).mockResolvedValue(undefined);
    (storage.salvaPurchaseTokenIndex as any).mockResolvedValue(undefined);

    const r = await POST({ request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }) } as any);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.codice).toMatch(/^PLAY-[0-9A-F]{8}$/);
    expect(playBilling.acknowledgePurchase).toHaveBeenCalledOnce();
    expect(storage.salvaPurchaseTokenIndex).toHaveBeenCalledWith('t', j.codice);
  });

  it('502 PLAY_API_ERROR se verify ritorna 5xx', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue(null);
    (playBilling.verifyInappPurchase as any).mockResolvedValue({ errore: 'internal', status: 503 });
    const r = await POST({ request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }) } as any);
    expect(r.status).toBe(502);
    expect((await r.json()).error).toBe('PLAY_API_ERROR');
  });

  it('400 INVALID_TOKEN se verify ritorna 410', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue(null);
    (playBilling.verifyInappPurchase as any).mockResolvedValue({ errore: 'expired', status: 410 });
    const r = await POST({ request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }) } as any);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('INVALID_TOKEN');
  });
});
```

- [ ] **Step 4: Esegui test — fail (endpoint non esiste)**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm test
```
Expected: FAIL — `Cannot find module '../../src/pages/api/play-billing/verify'`.

- [ ] **Step 5: Implementa endpoint**

`sherlock-site/src/pages/api/play-billing/verify.ts`:
```ts
import type { APIRoute } from 'astro';
import { verifyInappPurchase, acknowledgePurchase } from '../../../lib/play-billing';
import {
  cercaPerPurchaseToken,
  salvaPurchaseTokenIndex,
  salvaCodicePro,                  // SOSTITUISCI col nome reale Step 1
  type RecordPro,
} from '../../../lib/storage';
import { ga4TrackServer } from '../../../lib/log';  // verifica path Step 2

export const prerender = false;

const PRODOTTI_VALIDI = new Set(['founder_lifetime']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generaCodicePlay(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `PLAY-${hex}`;
}

export const POST: APIRoute = async ({ request }) => {
  let payload: { purchaseToken?: string; productId?: string; email?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'INVALID_BODY' }, 400);
  }

  const purchaseToken = (payload.purchaseToken ?? '').trim();
  const productId = (payload.productId ?? '').trim();
  const email = (payload.email ?? '').trim().toLowerCase();

  if (!purchaseToken) return json({ error: 'TOKEN_REQUIRED' }, 400);
  if (!PRODOTTI_VALIDI.has(productId)) return json({ error: 'INVALID_PRODUCT' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'EMAIL_REQUIRED' }, 400);

  // Idempotenza
  const esistente = await cercaPerPurchaseToken(purchaseToken);
  if (esistente) {
    return json({
      codice: esistente.codice,
      piano: esistente.piano,
      dataScadenza: esistente.dataScadenza,
    });
  }

  // Verify con Play Developer API
  const verify = await verifyInappPurchase(productId, purchaseToken);
  if ('errore' in verify) {
    const status = verify.status ?? 0;
    if (status === 410 || status === 404) return json({ error: 'INVALID_TOKEN' }, 400);
    return json({ error: 'PLAY_API_ERROR', detail: verify.errore }, 502);
  }
  if (verify.purchaseState !== 0) {
    return json({ error: 'TOKEN_NOT_PURCHASED', state: verify.purchaseState }, 400);
  }

  // Acknowledge (se non già fatto)
  if (verify.acknowledgementState === 0) {
    const ack = await acknowledgePurchase(productId, purchaseToken);
    if (!ack.ok) {
      return json({ error: 'ACK_FAILED', detail: ack.errore }, 502);
    }
  }

  // Emetti codice virtuale + salva record
  const codice = generaCodicePlay();
  const dataAcquisto = new Date(parseInt(verify.purchaseTimeMillis, 10) || Date.now()).toISOString();
  const record: RecordPro = {
    codice,
    email,
    piano: 'founder',
    dataAcquisto,
    dataScadenza: null,        // lifetime
    fonte: 'play',
    purchaseToken,
    playOrderId: verify.orderId,
  };
  await salvaCodicePro(record);
  await salvaPurchaseTokenIndex(purchaseToken, codice);

  void ga4TrackServer('play_billing_verified', purchaseToken.slice(0, 8), {
    product: productId,
    value: 19.90,
    currency: 'EUR',
  });

  return json({ codice, piano: 'founder', dataScadenza: null });
};
```

- [ ] **Step 6: Esegui test — devono passare**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm test
```
Expected: 11 test PASS (cumulativo).

- [ ] **Step 7: Verifica build Astro non rotta**

```bash
cd "C:/Users/Stefano/sherlock-site" && npm run build
```
Expected: build success, nessun TS error sul nuovo endpoint.

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/Stefano/sherlock-site"
git add src/pages/api/play-billing/verify.ts tests/api/play-billing-verify.test.ts
git commit -m "api: endpoint /api/play-billing/verify

POST che verifica purchaseToken via Play Developer API, fa
acknowledge, emette codice virtuale PLAY-XXXXXXXX e lo salva in
Upstash con fonte 'play'. Idempotente sullo stesso purchaseToken.
Email obbligatoria per rescue cross-device. Tracking GA4 server-side
del verified event.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Deploy backend a produzione

**Files:** nessuna modifica.

**Interfaces:**
- Produces: endpoint `https://sherlock-polizze-site-five.vercel.app/api/play-billing/verify` live (ma inutilizzato finché l'app v4.5 non esce)

- [ ] **Step 1: Push commit precedenti**

```bash
cd "C:/Users/Stefano/sherlock-site" && git push origin main
```
Expected: Vercel triggera build automatica.

- [ ] **Step 2: Attendi build verde**

Apri https://vercel.com/sstefano-s-projects/sherlock-polizze-site/deployments e attendi che l'ultimo commit sia "Ready" (~1-2 min).

- [ ] **Step 3: Smoke test endpoint con curl (mock token)**

```bash
curl -X POST https://sherlock-polizze-site-five.vercel.app/api/play-billing/verify \
  -H "Content-Type: application/json" \
  -d '{"purchaseToken":"fake-token-test","productId":"founder_lifetime","email":"test@example.com"}'
```
Expected: `{"error":"INVALID_TOKEN"}` con status 400 (token davvero non valido in Play, ma la pipeline funziona end-to-end).

- [ ] **Step 4: Verifica errori espliciti**

```bash
# senza email
curl -X POST https://sherlock-polizze-site-five.vercel.app/api/play-billing/verify \
  -H "Content-Type: application/json" \
  -d '{"purchaseToken":"x","productId":"founder_lifetime"}'
# Atteso: {"error":"EMAIL_REQUIRED"} status 400

# product sbagliato
curl -X POST https://sherlock-polizze-site-five.vercel.app/api/play-billing/verify \
  -H "Content-Type: application/json" \
  -d '{"purchaseToken":"x","productId":"monthly","email":"a@b.it"}'
# Atteso: {"error":"INVALID_PRODUCT"} status 400
```

- [ ] **Step 5: NESSUN commit necessario — il push del Task 4 ha già fatto deploy.**

---

## Task 6: App build.gradle — dipendenza Billing + version bump

**Files:**
- Modify: `C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/build.gradle`

**Interfaces:**
- Produces: dipendenza `com.android.billingclient:billing:7.1.1` disponibile per import; versione app `4.5/vc55`

- [ ] **Step 1: Backup pre-build**

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final" && \
  STAMP=$(date +%Y%m%d_%H%M%S) && \
  cp -r sherlock_project_patched/sherlock_project "sherlock_project_pre_v4.5_${STAMP}" && \
  zip -r "sherlock_project_pre_v4.5_${STAMP}.zip" "sherlock_project_pre_v4.5_${STAMP}" >/dev/null && \
  rm -rf "sherlock_project_pre_v4.5_${STAMP}" && \
  echo "Backup: sherlock_project_pre_v4.5_${STAMP}.zip"
```

- [ ] **Step 2: Bump versionCode e versionName**

Edit `app/build.gradle`, sezione `defaultConfig`:
```gradle
versionCode 55
versionName '4.5'
```
(da `versionCode 54 / versionName '4.4'`)

- [ ] **Step 3: Aggiungi dipendenza Billing**

In `app/build.gradle`, sezione `dependencies` (esistente, sotto firebase-bom):
```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:33.5.1')
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.android.billingclient:billing:7.1.1'
}
```

- [ ] **Step 4: Sync gradle (verifica risoluzione dep)**

Da terminale (richiede JAVA_HOME settato):
```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project" && \
  ./gradlew app:dependencies --configuration releaseRuntimeClasspath 2>&1 | grep -i billing
```
Expected: linee tipo `+--- com.android.billingclient:billing:7.1.1`.

- [ ] **Step 5: Niente git commit (cartella non è repo).** Annotare in `Sherlock app final/CHANGELOG.txt` se esiste, altrimenti skip.

---

## Task 7: BillingManager.java (NEW)

**Files:**
- Create: `C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/java/it/sherlock/polizze/BillingManager.java`

**Interfaces:**
- Consumes: `com.android.billingclient.api.*` (dep Task 6)
- Produces: classe pubblica `BillingManager` con metodi e enum `PurchaseResult` come definiti nello spec sezione "BillingManager.java"

- [ ] **Step 1: Crea il file**

`app/src/main/java/it/sherlock/polizze/BillingManager.java`:
```java
package it.sherlock.polizze;

import android.app.Activity;
import android.content.Context;
import android.util.Log;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.Collections;
import java.util.List;

public class BillingManager implements PurchasesUpdatedListener {

    private static final String TAG = "BillingManager";

    public enum ResultKind { SUCCESS, USER_CANCELED, ERROR, PENDING }

    public static class PurchaseResult {
        public final ResultKind kind;
        public final String productId;
        public final String purchaseToken;     // null se non SUCCESS/PENDING
        public final String orderId;           // null se non SUCCESS
        public final String reasonSlug;        // popolato se ERROR/CANCELED
        public final boolean fromRestore;      // true se da queryExistingPurchases

        public PurchaseResult(ResultKind kind, String productId, String purchaseToken,
                              String orderId, String reasonSlug, boolean fromRestore) {
            this.kind = kind;
            this.productId = productId;
            this.purchaseToken = purchaseToken;
            this.orderId = orderId;
            this.reasonSlug = reasonSlug;
            this.fromRestore = fromRestore;
        }
    }

    public interface ResultListener {
        void onResult(PurchaseResult r);
    }

    private final Context appContext;
    private final ResultListener listener;
    private BillingClient billingClient;
    private boolean connected = false;

    public BillingManager(Context context, ResultListener listener) {
        this.appContext = context.getApplicationContext();
        this.listener = listener;
        this.billingClient = BillingClient.newBuilder(appContext)
                .setListener(this)
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    public void connect() {
        if (connected) return;
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult br) {
                connected = (br.getResponseCode() == BillingClient.BillingResponseCode.OK);
                Log.i(TAG, "Setup finished: " + br.getResponseCode() + " " + br.getDebugMessage());
            }
            @Override
            public void onBillingServiceDisconnected() {
                connected = false;
                Log.w(TAG, "Disconnected; will retry on next call");
            }
        });
    }

    public void disconnect() {
        if (billingClient != null && billingClient.isReady()) {
            billingClient.endConnection();
        }
        connected = false;
    }

    public boolean isReady() {
        return connected && billingClient != null && billingClient.isReady();
    }

    public void launchPurchase(final Activity host, final String productId) {
        if (!isReady()) {
            listener.onResult(new PurchaseResult(ResultKind.ERROR, productId, null, null, "not_ready", false));
            return;
        }
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();
        billingClient.queryProductDetailsAsync(params, (result, list) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || list.isEmpty()) {
                listener.onResult(new PurchaseResult(ResultKind.ERROR, productId, null, null,
                        "product_not_found", false));
                return;
            }
            ProductDetails details = list.get(0);
            BillingFlowParams.ProductDetailsParams pdp = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .build();
            BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(pdp))
                    .build();
            BillingResult launch = billingClient.launchBillingFlow(host, flow);
            if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                listener.onResult(new PurchaseResult(ResultKind.ERROR, productId, null, null,
                        "launch_failed_" + launch.getResponseCode(), false));
            }
        });
    }

    public void queryExistingPurchases() {
        if (!isReady()) return;
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        billingClient.queryPurchasesAsync(params, (br, purchases) -> {
            if (br.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    deliverPurchase(p, true);
                }
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult br, List<Purchase> purchases) {
        int code = br.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            listener.onResult(new PurchaseResult(ResultKind.USER_CANCELED, null, null, null, "user_canceled", false));
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null) {
            listener.onResult(new PurchaseResult(ResultKind.ERROR, null, null, null, "code_" + code, false));
            return;
        }
        for (Purchase p : purchases) {
            deliverPurchase(p, false);
        }
    }

    private void deliverPurchase(Purchase p, boolean fromRestore) {
        int state = p.getPurchaseState();
        String pid = p.getProducts().isEmpty() ? null : p.getProducts().get(0);
        if (state == Purchase.PurchaseState.PENDING) {
            listener.onResult(new PurchaseResult(ResultKind.PENDING, pid, p.getPurchaseToken(), p.getOrderId(), null, fromRestore));
            return;
        }
        if (state == Purchase.PurchaseState.PURCHASED) {
            listener.onResult(new PurchaseResult(ResultKind.SUCCESS, pid, p.getPurchaseToken(), p.getOrderId(), null, fromRestore));
        }
    }

    // Chiamato dal backend dopo verify success per chiudere il ciclo lato Play.
    // (In questo design lo fa il backend via Developer API, ma esponiamo un fallback
    //  client-side se mai servisse — non usato di default.)
    public void acknowledgeLocally(String purchaseToken, Runnable onDone) {
        if (!isReady() || purchaseToken == null) { if (onDone != null) onDone.run(); return; }
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchaseToken).build();
        billingClient.acknowledgePurchase(params, br -> { if (onDone != null) onDone.run(); });
    }
}
```

- [ ] **Step 2: Verifica compile (sync gradle non basta — build effettivo)**

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project" && \
  ./gradlew :app:compileReleaseJavaWithJavac 2>&1 | tail -30
```
Expected: BUILD SUCCESSFUL, nessun errore di import/symbol.

Se errore tipo `cannot find symbol PendingPurchasesParams`: verificare che `billing:7.1.1` sia stato risolto (Task 6 Step 4).

- [ ] **Step 3: Niente git commit (cartella non è repo).**

---

## Task 8: MainActivity.java — bridge + lifecycle

**Files:**
- Modify: `C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/java/it/sherlock/polizze/MainActivity.java`

**Interfaces:**
- Consumes: `BillingManager`, `BillingManager.PurchaseResult`, `BillingManager.ResultKind` da Task 7
- Produces: bridge methods `startPurchase(String productId)`, `startPurchase(String productId, String email)`, `isPlayBillingAvailable()`, `getBackendUrl()` accessibili da JS WebView come `Android.*`

- [ ] **Step 1: Aggiungi import in cima al file**

In `MainActivity.java` dopo le import esistenti (riga ~37):
```java
import org.json.JSONException;
```
Le import di BillingManager non servono — è nello stesso package.

- [ ] **Step 2: Aggiungi costante BACKEND_URL e campo billing**

Subito dopo `private static final int FILE_CHOOSER_REQUEST = 1;` (riga ~44):
```java
private static final String BACKEND_URL = "https://sherlock-polizze-site-five.vercel.app";

private BillingManager billing;
private String pendingPurchaseEmail = null;
```

- [ ] **Step 3: Inizializza billing in onCreate (in fondo, dopo loadUrl)**

In `onCreate`, prima della parentesi finale `}` del metodo (riga ~131-132, dopo `webView.loadUrl(...)`):
```java
billing = new BillingManager(this, this::onPurchaseResult);
billing.connect();
```

- [ ] **Step 4: Aggiungi onResume e onDestroy**

Subito dopo `onBackPressed()` (riga ~153):
```java
@Override
protected void onResume() {
    super.onResume();
    if (billing != null) billing.queryExistingPurchases();
}

@Override
protected void onDestroy() {
    if (billing != null) billing.disconnect();
    super.onDestroy();
}
```

- [ ] **Step 5: Aggiungi 3 metodi bridge nella inner class SherlockBridge**

Dentro la inner class `SherlockBridge` (dopo `public void track(...)`), riga ~245 ca.:
```java
@JavascriptInterface
public boolean isPlayBillingAvailable() {
    return billing != null && billing.isReady();
}

@JavascriptInterface
public void startPurchase(final String productId) {
    startPurchase(productId, null);
}

@JavascriptInterface
public void startPurchase(final String productId, final String email) {
    pendingPurchaseEmail = email;
    runOnUiThread(() -> billing.launchPurchase(MainActivity.this, productId));
}

@JavascriptInterface
public String getBackendUrl() {
    return BACKEND_URL;
}
```

- [ ] **Step 6: Aggiungi callback onPurchaseResult e helper di verify**

Subito dopo la chiusura della classe `SherlockBridge` (cerca `} // fine SherlockBridge` — se non c'è il comment, dopo il `}` che chiude la inner class, riga ~246):

```java
/* ------------------------------------------------------------------ */
/*  Play Billing callback                                             */
/* ------------------------------------------------------------------ */
private void onPurchaseResult(final BillingManager.PurchaseResult r) {
    runOnUiThread(() -> {
        switch (r.kind) {
            case USER_CANCELED:
                evalJs("window.onPurchaseCancelled && window.onPurchaseCancelled();");
                track("play_billing_cancelled", null);
                break;
            case PENDING:
                evalJs("window.onPurchasePending && window.onPurchasePending();");
                track("play_billing_pending", null);
                break;
            case ERROR:
                evalJs("window.onPurchaseError && window.onPurchaseError('" + esc(r.reasonSlug) + "');");
                track("play_billing_error", "{\"reason\":\"" + esc(r.reasonSlug) + "\"}");
                break;
            case SUCCESS:
                track("play_billing_purchased", "{\"restore\":" + (r.fromRestore ? "1" : "0") + "}");
                verifyPurchaseOnServer(r);
                break;
        }
    });
}

private void verifyPurchaseOnServer(final BillingManager.PurchaseResult r) {
    new Thread(() -> {
        String body;
        try {
            JSONObject j = new JSONObject();
            j.put("purchaseToken", r.purchaseToken);
            j.put("productId", r.productId);
            if (pendingPurchaseEmail != null && !pendingPurchaseEmail.isEmpty()) {
                j.put("email", pendingPurchaseEmail);
            }
            body = j.toString();
        } catch (JSONException e) {
            postPurchaseError("body_json_error");
            return;
        }
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(BACKEND_URL + "/api/play-billing/verify").openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setDoOutput(true);
            byte[] bytes = body.getBytes("UTF-8");
            conn.setRequestProperty("Content-Length", String.valueOf(bytes.length));
            OutputStream os = conn.getOutputStream();
            os.write(bytes);
            os.close();
            int code = conn.getResponseCode();
            InputStream is = code < 400 ? conn.getInputStream() : conn.getErrorStream();
            BufferedReader br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();
            JSONObject resp = new JSONObject(sb.toString());
            if (code == 200 && resp.has("codice")) {
                final String codice = resp.getString("codice");
                runOnUiThread(() -> {
                    evalJs("window.onProActivated && window.onProActivated('" + esc(codice) + "');");
                    track("play_billing_verified", null);
                });
            } else {
                postPurchaseError(resp.optString("error", "verify_failed_" + code));
            }
        } catch (Exception e) {
            postPurchaseError("network_" + (e.getMessage() == null ? "unknown" : e.getMessage()));
        }
    }).start();
}

private void postPurchaseError(final String reasonSlug) {
    runOnUiThread(() -> {
        evalJs("window.onPurchaseError && window.onPurchaseError('" + esc(reasonSlug) + "');");
        track("play_billing_verify_error", "{\"reason\":\"" + esc(reasonSlug) + "\"}");
    });
}

private void evalJs(String js) {
    if (webView != null) webView.evaluateJavascript(js, null);
}

private String esc(String s) {
    if (s == null) return "";
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n");
}

private void track(String event, String paramsJson) {
    if (mFirebaseAnalytics == null) return;
    Bundle b = new Bundle();
    if (paramsJson != null) {
        try {
            JSONObject j = new JSONObject(paramsJson);
            Iterator<String> keys = j.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                Object v = j.opt(k);
                if (v instanceof String) b.putString(k, (String) v);
                else if (v != null) b.putString(k, String.valueOf(v));
            }
        } catch (Exception ignore) {}
    }
    mFirebaseAnalytics.logEvent(event, b);
}
```

- [ ] **Step 7: Compila per verificare zero errori**

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project" && \
  ./gradlew :app:compileReleaseJavaWithJavac 2>&1 | tail -50
```
Expected: BUILD SUCCESSFUL.

Errori probabili e fix:
- `cannot find symbol: track` → c'è già `SherlockBridge.track` con altra signature; rinomina il nuovo helper `private void track` in `private void logAnalytics` e aggiorna 5 chiamate
- `JSONException unhandled` → wrap o aggiungi throws (di solito non serve, JSONObject opzionali gestiti)

- [ ] **Step 8: Niente git commit (cartella non è repo).**

---

## Task 9: index.html — paywall ridisegnato + email obbligatoria + handlers

**Files:**
- Modify: `C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/assets/www/index.html`

**Interfaces:**
- Consumes: `Android.startPurchase(productId, email)`, `Android.isPlayBillingAvailable()`, `Android.getBackendUrl()`
- Produces: `#screen-paywall` HTML aggiornato, funzioni globali `window.onProActivated`, `window.onPurchaseCancelled`, `window.onPurchaseError`, `window.onPurchasePending`, `startPlayPurchase()`

- [ ] **Step 1: Localizza l'attuale `#screen-paywall`**

```bash
grep -n 'id="screen-paywall"\|screen-paywall' "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/assets/www/index.html"
```
Annota la riga di apertura e la riga di chiusura della section.

- [ ] **Step 2: Sostituisci il contenuto della section paywall**

Sostituisci l'intera section `<section id="screen-paywall">...</section>` con:
```html
<section id="screen-paywall" class="screen" style="display:none">
  <div class="paywall-card">
    <div class="paywall-badge">🏆 PASS PRO A VITA</div>
    <h2 class="paywall-title">Sblocca tutte le funzioni Pro, per sempre.</h2>
    <p class="paywall-sub">Una tantum. Nessun rinnovo. Numero limitato.</p>

    <label class="paywall-email-label" for="founder-email">La tua email (per recuperare il Pro su altri device)</label>
    <input id="founder-email" type="email" class="paywall-email" placeholder="nome@esempio.it" autocomplete="email" inputmode="email" />

    <button id="btn-founder" class="paywall-cta" disabled onclick="startPlayPurchase()">
      Sblocca a 19,90€
    </button>

    <div class="paywall-divider"><span>oppure</span></div>

    <details class="paywall-fallback">
      <summary>Hai già un codice Pro? Inseriscilo qui</summary>
      <input id="code-input" type="text" class="paywall-code" placeholder="ABC-1234 / PLAY-XXXXXXXX" autocapitalize="characters" />
      <button class="paywall-code-btn" onclick="activateCode()">Attiva codice</button>
    </details>
  </div>
</section>
```

- [ ] **Step 3: Aggiungi CSS (se non già coperto da classi globali)**

Cerca il blocco `<style>` esistente (in cima al file). Aggiungi in fondo (prima di `</style>`):
```css
.paywall-card { background:#0b1224; border:1px solid #1c2742; border-radius:16px; padding:24px; margin:16px; max-width:480px; margin-inline:auto; }
.paywall-badge { display:inline-block; background:rgba(250,204,21,.15); color:#facc15; font-weight:800; font-size:11px; letter-spacing:.18em; padding:4px 10px; border-radius:999px; margin-bottom:12px; }
.paywall-title { font-size:22px; font-weight:800; color:#fff; line-height:1.2; margin:0 0 8px; }
.paywall-sub { color:#94a3b8; font-size:14px; margin:0 0 18px; }
.paywall-email-label { display:block; color:#cbd5e1; font-size:13px; font-weight:600; margin-bottom:6px; }
.paywall-email { width:100%; box-sizing:border-box; background:#070b18; border:1px solid #1c2742; color:#fff; padding:12px 14px; border-radius:10px; font-size:15px; margin-bottom:14px; }
.paywall-cta { width:100%; background:#facc15; color:#0b1224; font-weight:800; font-size:16px; padding:14px; border-radius:12px; border:none; cursor:pointer; transition:.2s; }
.paywall-cta:disabled { opacity:.45; cursor:not-allowed; }
.paywall-cta:not(:disabled):hover { background:#fde047; }
.paywall-divider { text-align:center; margin:18px 0; position:relative; color:#475569; font-size:12px; }
.paywall-divider::before,.paywall-divider::after { content:""; position:absolute; top:50%; width:35%; height:1px; background:#1c2742; }
.paywall-divider::before { left:0; } .paywall-divider::after { right:0; }
.paywall-fallback summary { color:#cbd5e1; font-size:13px; cursor:pointer; padding:8px 0; }
.paywall-code { width:100%; box-sizing:border-box; background:#070b18; border:1px solid #1c2742; color:#fff; padding:10px 12px; border-radius:8px; font-size:14px; margin-top:10px; }
.paywall-code-btn { margin-top:8px; background:transparent; color:#facc15; border:1px solid #facc15; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; }
```

- [ ] **Step 4: Aggiungi gli handler JS globali e startPlayPurchase**

Trova il blocco `<script>` principale (probabile riga ~150+). All'inizio del blocco, dopo eventuali costanti come `BE_BASE`, aggiungi:
```js
// ====== Play Billing handlers (chiamati dal bridge Android) ======
window.onProActivated = function(codice) {
  try { if (typeof S !== 'undefined') { S.proCode = codice; S.isPro = true; } } catch(e) {}
  try { localStorage.setItem('proCode', codice); } catch(e) {}
  try { track('play_billing_pro_activated', { codice_prefix: String(codice).slice(0,5) }); } catch(e) {}
  if (typeof toast === 'function') toast('✅ Pass Pro attivato!', 'success');
  if (typeof goHome === 'function') goHome();
};
window.onPurchaseCancelled = function() {
  try { track('play_billing_user_dismissed'); } catch(e) {}
};
window.onPurchaseError = function(reasonSlug) {
  try { track('play_billing_error_ui', { reason: reasonSlug }); } catch(e) {}
  if (typeof toast === 'function') toast("Pagamento non riuscito. Riprova o contatta supporto.", 'error');
};
window.onPurchasePending = function() {
  if (typeof toast === 'function') toast("Pagamento in attesa di approvazione.", 'info');
};

var _lastPurchaseClick = 0;
function startPlayPurchase() {
  var now = Date.now();
  if (now - _lastPurchaseClick < 500) return;   // debounce doppio tap
  _lastPurchaseClick = now;

  if (typeof Android === 'undefined' || !Android.isPlayBillingAvailable || !Android.isPlayBillingAvailable()) {
    if (typeof toast === 'function') toast("Pagamento non disponibile. Aggiorna l'app o riprova più tardi.", 'error');
    try { track('play_billing_unavailable'); } catch(e) {}
    return;
  }
  var email = ((document.getElementById('founder-email') || {}).value || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    if (typeof toast === 'function') toast("Inserisci la tua email per continuare.", 'warn');
    try { track('play_billing_email_required'); } catch(e) {}
    var el = document.getElementById('founder-email'); if (el) el.focus();
    return;
  }
  try { track('play_billing_initiated'); } catch(e) {}
  Android.startPurchase('founder_lifetime', email);
}

// Abilita/disabilita CTA in base alla validità email
document.addEventListener('DOMContentLoaded', function(){
  var emailEl = document.getElementById('founder-email');
  var btn = document.getElementById('btn-founder');
  if (!emailEl || !btn) return;
  emailEl.addEventListener('input', function(){
    var v = (emailEl.value || '').trim().toLowerCase();
    btn.disabled = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  });
});
```

- [ ] **Step 5: Rimuovi link/CTA verso /abbonati nel paywall**

Cerca:
```bash
grep -n "/abbonati\|sherlock-polizze-site-five.vercel.app/abbonati" "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/src/main/assets/www/index.html"
```
Per ogni occorrenza dentro `#screen-paywall` (NON quelle in altre schermate come "Impostazioni"): rimuovi o sostituisci con commento `<!-- rimosso: policy Play vieta link a payment esterni in-app -->`.

- [ ] **Step 6: Niente git commit (cartella non è repo).**

---

## Task 10: Build .aab + Upload Internal Testing

**Files:** nessuna modifica codice.

**Interfaces:**
- Produces: `app/build/outputs/bundle/release/app-release.aab` (~3-4 MB, firmato) caricato su Play Console Internal testing track

- [ ] **Step 1: Build clean release**

```bash
cd "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project" && \
  ./gradlew clean :app:bundleRelease 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL` + path file: `app/build/outputs/bundle/release/app-release.aab`.

- [ ] **Step 2: Rinomina aab con versione (storico build)**

```bash
cp "C:/Users/Stefano/Downloads/Sherlock app final/sherlock_project_patched/sherlock_project/app/build/outputs/bundle/release/app-release.aab" \
   "C:/Users/Stefano/Downloads/Sherlock app final/Sherlock-v4.5-vc55.aab"
ls -lh "C:/Users/Stefano/Downloads/Sherlock app final/Sherlock-v4.5-vc55.aab"
```

- [ ] **Step 3: Upload Play Console — Internal testing**

Manualmente:
1. Apri https://play.google.com/console
2. Seleziona app Sherlock
3. Sidebar > **Testing > Internal testing**
4. **Create new release** > Upload `Sherlock-v4.5-vc55.aab`
5. Release notes:
   ```
   v4.5 — Pass Pro a vita via Google Play
   ```
6. **Review release** > **Start rollout to Internal testing**

- [ ] **Step 4: Verifica tester list contiene tua email**

In Internal testing > **Testers** tab: deve esserci `stefano.scapigliati@gmail.com` (License testing list di Play Console).

- [ ] **Step 5: Ottieni opt-in link**

In Internal testing > Testers tab > **Copy link**. Aprilo sul device Android con account Google tester. Conferma opt-in. Attendi 5-15 min per propagazione, poi installa via Play Store.

---

## Task 11: 3 test manuali reali su device

**Files:** nessuna modifica.

**Interfaces:**
- Produces: validazione end-to-end del flusso; record `RecordPro` con `fonte: 'play'` in `/admin`

- [ ] **Test A — Happy path nuovo acquisto**

1. Su device con account tester, apri l'app (v4.5)
2. Tap su qualsiasi funzione Pro per arrivare al paywall (es. Lettera o Compara)
3. Inserisci email valida (es. `stefano.scapigliati+test@gmail.com`)
4. Tap "Sblocca a 19,90€"
5. Dialog Play appare con prezzo `19,90 €`
6. Conferma con biometria
7. Atteso: entro 5s appare toast "✅ Pass Pro attivato!", torni a home, funzioni Pro sbloccate
8. Verifica `/admin` (Vercel) → tabella Abbonati ha nuovo record `PLAY-XXXXXXXX` con `fonte: 'play'`
9. Verifica GA4 DebugView: sequenza eventi `play_billing_initiated` → `play_billing_dialog_opened` → `play_billing_purchased` → `play_billing_verified` → `play_billing_pro_activated`

- [ ] **Test B — Restore dopo clear data**

1. Sul device del Test A, Impostazioni > App > Sherlock > Cancella dati
2. Riapri Sherlock
3. Atteso: NESSUN dialog Play, ma entro 3s `track event play_billing_restored`, Pro automaticamente attivo (verifica tappando funzione Pro: deve aprirsi senza chiedere paywall)

- [ ] **Test C — Dismiss dialog**

1. Su device di un secondo account tester (NON quello che ha già comprato — o disabilita acquisto in license testing temporaneamente)
2. Apri paywall, email valida, tap Sblocca
3. Quando appare dialog Play, premi back / annulla
4. Atteso: nessun toast (silent), nessun side effect, Pro resta non-attivo, evento `play_billing_cancelled` in GA4

- [ ] **Step 4: Se TUTTI passano → procedi al Task 12. Se uno fallisce → STOP, debug, fix, ri-build (incrementa versionCode 55→56), ri-upload.**

---

## Task 12: Promote Internal → Production

**Files:** nessuna modifica.

**Interfaces:**
- Produces: app v4.5 disponibile a TUTTI gli utenti via Play Store (rollout 100%)

- [ ] **Step 1: In Play Console > Internal testing > Releases**

Trova la release v4.5/vc55 testata.

- [ ] **Step 2: Promote**

Pulsante **Promote release > Production**.

- [ ] **Step 3: Configura rollout**

Selezionare **100% rollout** (scelta utente). Release notes:
```
v4.5 — Sblocco Pass Pro a vita direttamente in app, senza più dover passare dal browser.
```

- [ ] **Step 4: Review release > Start rollout to Production**

Attendi conferma di submission. Play review può prendere da 1h a 24h.

- [ ] **Step 5: Monitor 24h post-pubblicazione**

Check ogni 4-6h:
- `/admin` dashboard: nuovi record `fonte: 'play'`
- GA4: funnel `play_billing_initiated → play_billing_verified`. Ratio atteso ≥ 30%
- Play Console > Vitals: crash rate < 0,5% (no regression vs v4.4)

Se anomalia (crash spike, conversion < 15%, ticket utenti): Play Console > **Halt rollout** (gli utenti non aggiornati restano su v4.4).

---

## Self-Review

**Spec coverage check:**
- ✅ Architettura 3 lati → Task 4 (backend), 7-8 (Android), 9 (WebView)
- ✅ Email obbligatoria → Task 4 (server-side validation) + Task 9 (client validation)
- ✅ Idempotenza → Task 4 (cerca per token + return existing)
- ✅ Acknowledge backend-side → Task 4 (chiama acknowledgePurchase dopo verify success)
- ✅ Restore → Task 7 (queryExistingPurchases) + Task 8 (onResume)
- ✅ Bridge methods → Task 8 (3 metodi @JavascriptInterface)
- ✅ Tracking eventi → Task 8 (Android), Task 9 (JS), Task 4 (server-side GA4)
- ✅ Version bump 54→55 → Task 6
- ✅ Internal testing prima di production → Task 10-11
- ✅ Promote production 100% → Task 12
- ✅ Test plan dello spec (10 casi) → Task 11 copre i 3 critici (happy, restore, dismiss); i restanti 7 sono test secondari documentati nello spec, esercitabili manualmente

**Placeholder scan:** Nessun "TBD" o "TODO". Tutti i code block contengono codice completo.

**Type consistency:** `BillingManager.PurchaseResult` definito in Task 7, consumato in Task 8. `cercaPerPurchaseToken`/`salvaPurchaseTokenIndex` definiti in Task 2, consumati in Task 4. `startPurchase(productId, email)` definito in Task 8, consumato in Task 9.

**Ambiguity note:** Task 2 e Task 4 contengono note "SOSTITUISCI col nome reale" per `salvaCodicePro` e per il path import di `ga4TrackServer` — sono ambigui di proposito perché i nomi esatti non sono noti dall'esplorazione e devono essere verificati leggendo `storage.ts`/`log.ts`. L'engineer in esecuzione li corregge in 2 minuti col grep indicato.
