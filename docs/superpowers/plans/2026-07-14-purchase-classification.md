# Purchase Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classificare persistentemente gli acquisti e impedire che record non reali alimentino ricavi, conversioni, contatori Founder o referral.

**Architecture:** Un modulo di dominio puro centralizza stati, normalizzazione legacy e transizioni. Storage, PayPal, Google Play e amministrazione persistono la classificazione; dashboard e side effect commerciali consumano esclusivamente la funzione `isRealPurchase`. Gli entitlement restano indipendenti dallo stato commerciale.

**Tech Stack:** TypeScript 6.0.3, Astro 6, Vitest 3, Upstash Redis/Vercel KV, PayPal REST, Google Play Developer API.

## Global Constraints

- Stati esatti: `reale`, `test`, `rimborsato`, `incompleto`, `amministratore`.
- I record legacy senza stato sono sempre letti come `test` con motivo `legacy_unclassified`.
- Solo `reale` alimenta ricavi, conversioni `purchase`, Founder e referral.
- La classificazione non revoca entitlement esistenti.
- Nessuna euristica basata su email, token o input del browser.
- Nessun webhook rimborsi, deploy, push o migrazione produzione in questa tranche.

---

### Task 1: Dominio della classificazione

**Files:**
- Create: `src/lib/purchase-classification.ts`
- Create: `tests/lib/purchase-classification.test.ts`

**Interfaces:**
- Produces: `CommercialStatus`, `PaymentEnvironment`, `CommercialMetadata`, `normalizeCommercialMetadata(record)`, `isRealPurchase(record)`, `transitionCommercialStatus(current, next, reason, now?)`.

- [ ] **Step 1: Scrivere test fallenti per legacy, acquisto reale e transizioni**

```ts
import { describe, expect, it } from 'vitest';
import { isRealPurchase, normalizeCommercialMetadata, transitionCommercialStatus } from '../../src/lib/purchase-classification';

describe('purchase classification', () => {
  it('classifica un record legacy come test', () => {
    expect(normalizeCommercialMetadata({}).commercialStatus).toBe('test');
    expect(normalizeCommercialMetadata({}).commercialStatusReason).toBe('legacy_unclassified');
  });
  it('considera commerciale soltanto reale', () => {
    expect(isRealPurchase({ commercialStatus: 'reale' })).toBe(true);
    for (const commercialStatus of ['test', 'rimborsato', 'incompleto', 'amministratore'] as const) {
      expect(isRealPurchase({ commercialStatus })).toBe(false);
    }
  });
  it('consente reale -> rimborsato e vieta rimborsato -> reale', () => {
    expect(transitionCommercialStatus('reale', 'rimborsato', 'provider_refund', '2026-07-14T12:00:00.000Z').commercialStatus).toBe('rimborsato');
    expect(() => transitionCommercialStatus('rimborsato', 'reale', 'automatic_retry')).toThrow('Transizione commerciale non consentita');
  });
});
```

- [ ] **Step 2: Eseguire `npm test -- --run tests/lib/purchase-classification.test.ts` e verificare FAIL per modulo assente**
- [ ] **Step 3: Implementare tipi e funzioni pure con matrice `incompleto → reale|test`, `reale → rimborsato`, identità idempotente e nessuna promozione automatica degli stati terminali**
- [ ] **Step 4: Rieseguire il test mirato e verificare PASS**
- [ ] **Step 5: Commit `feat: add purchase classification domain`**

### Task 2: Persistenza e aggregati prudenti

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `tests/lib/storage.test.ts`

**Interfaces:**
- Consumes: `CommercialMetadata`, `normalizeCommercialMetadata`, `isRealPurchase`.
- Produces: campi commerciali opzionali su `RecordPro` e `PayPalProcessingRecord`; `SintesiAbbonati.perStato`; ricavi e conteggi reali filtrati.

- [ ] **Step 1: Aggiungere test fallenti che salvano un legacy, un reale, un amministratore e un rimborsato**

```ts
it('esclude legacy e non reali da ricavi e conteggi commerciali', async () => {
  const mod = await import('../../src/lib/storage');
  await mod.salvaCodicePro(makeRecord('LEGACY'));
  await mod.salvaCodicePro(makeRecord('REAL', { commercialStatus: 'reale' }));
  await mod.salvaCodicePro(makeRecord('ADMIN', { commercialStatus: 'amministratore' }));
  await mod.salvaCodicePro(makeRecord('REFUND', { commercialStatus: 'rimborsato' }));
  const result = await mod.leggiAbbonati();
  expect(result.reali).toBe(1);
  expect(result.ricavoEuroCent).toBe(299);
  expect(result.perStato).toMatchObject({ reale: 1, test: 1, amministratore: 1, rimborsato: 1, incompleto: 0 });
});
```

- [ ] **Step 2: Eseguire il test mirato e verificare FAIL sui nuovi aggregati**
- [ ] **Step 3: Estendere i record, normalizzare soltanto nelle viste di lettura e calcolare `reali`, `attiviReali`, `perStato` e `ricavoEuroCent` esclusivamente dai reali**
- [ ] **Step 4: Aggiungere `commercialStatus: 'incompleto'`, ambiente `unknown` e motivo `processing_started` alla creazione PayPal processing; verificare idempotenza**
- [ ] **Step 5: Rieseguire `tests/lib/storage.test.ts` e verificare PASS**
- [ ] **Step 6: Commit `feat: persist commercial purchase status`**

### Task 3: PayPal senza conversioni di test

**Files:**
- Modify: `src/lib/paypal.ts`
- Modify: `src/pages/api/paypal/capture-order.ts`
- Create: `tests/api/paypal-capture-commercial.test.ts`

**Interfaces:**
- Produces: `paypalEnvironment(): 'production' | 'sandbox'`; `CaptureResult.paymentEnvironment`; checkpoint commerciali coerenti.

- [ ] **Step 1: Scrivere test endpoint fallenti con capture sandbox e produzione, verificando che solo produzione chiami GA4 `purchase`, referral e Founder**
- [ ] **Step 2: Eseguire il test e osservare che sandbox produce ancora side effect commerciali**
- [ ] **Step 3: Derivare l'ambiente esclusivamente dalla base API/configurazione server e propagarlo nel risultato di cattura**
- [ ] **Step 4: Prima dei side effect aggiornare processing e licenza a `test`/`reale`; racchiudere GA4 purchase, referral e incremento Founder in `isRealPurchase(corrente)`**
- [ ] **Step 5: Mantenere email ed entitlement per entrambi gli ambienti e marcare i checkpoint saltati per garantire retry idempotenti**
- [ ] **Step 6: Rieseguire test PayPal mirati e storage, verificando PASS**
- [ ] **Step 7: Commit `feat: exclude PayPal sandbox purchases from metrics`**

### Task 4: Google Play e amministrazione

**Files:**
- Modify: `src/lib/play-billing.ts`
- Modify: `src/pages/api/play-billing/verify.ts`
- Modify: `src/pages/api/admin/migra-utente.ts`
- Modify: `tests/lib/play-billing.test.ts`
- Modify: `tests/api/play-billing-verify.test.ts`
- Create: `tests/api/admin-migra-utente.test.ts`

**Interfaces:**
- Produces: `PlayPurchase.purchaseType?: 0 | 1 | 2`; test Play quando `purchaseType === 0`; amministrazione sempre `amministratore`.

- [ ] **Step 1: Scrivere test fallenti che preservano `purchaseType: 0`, classificano Play test e classificano migrazione admin**
- [ ] **Step 2: Eseguire i tre file test e verificare FAIL sui campi mancanti**
- [ ] **Step 3: Mappare `purchaseType` dalla risposta ufficiale Google; usare `test` solo per valore `0`, altrimenti `reale` per acquisto completato**
- [ ] **Step 4: Limitare contatore Founder ed evento commerciale Play ai record reali, lasciando invariata l'emissione dell'entitlement**
- [ ] **Step 5: Salvare le migrazioni admin con ambiente `unknown`, stato `amministratore`, motivo `admin_migration` e timestamp**
- [ ] **Step 6: Rieseguire i test mirati e verificare PASS**
- [ ] **Step 7: Commit `feat: classify Play and admin entitlements`**

### Task 5: Dashboard, API e documentazione

**Files:**
- Modify: `src/pages/admin/index.astro`
- Modify: `src/pages/api/admin/stats.ts`
- Modify: `src/pages/api/admin/abbonati.ts`
- Modify: `MONETIZATION_CHANGES.md`
- Modify: `ANALYTICS_EVENTS.md`
- Modify: `CODEX_IMPLEMENTATION_STATUS.md`
- Modify: `PENDING_TASKS.md`
- Modify: `TEST_RESULTS.md`

**Interfaces:**
- Consumes: `SintesiAbbonati.reali`, `attiviReali`, `perStato`, record normalizzati.

- [ ] **Step 1: Aggiungere un test di regressione o asserzioni di rendering/API che richiedano totali separati e classificazione per record**
- [ ] **Step 2: Eseguire il test e verificare FAIL**
- [ ] **Step 3: Mostrare ricavi, conversione e score sugli attivi reali; aggiungere riquadro separato per i cinque stati e badge nelle righe**
- [ ] **Step 4: Restituire nelle API admin sia metriche reali sia `perStato`, senza rimuovere i campi legacy in questa tranche**
- [ ] **Step 5: Aggiornare audit e stato, indicando esplicitamente che rimborsi automatici e migrazione produzione restano fuori ambito**
- [ ] **Step 6: Eseguire `npm test`, `npx astro check`, `npm run build` e `git diff --check`; richiedere 0 test falliti, 0 errori Astro e build exit 0**
- [ ] **Step 7: Commit `feat: expose classified commercial metrics`**

## Fonti tecniche

- Google Play Developer API `ProductPurchase`: `purchaseType = 0` identifica un acquisto da account license testing; `purchaseState` distingue purchased, canceled e pending.
- PayPal REST: ambiente sandbox e produzione usano host distinti; la classificazione deriva dall'host/configurazione server.
