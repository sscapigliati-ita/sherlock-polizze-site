# Sherlock Polizze Recovery Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare il lavoro Claude recuperato a una baseline compilabile, testata, documentata e priva delle formulazioni giuridiche prioritarie note.

**Architecture:** Conservare l'applicazione Astro 6 e le integrazioni esistenti, aggiungendo controlli statici Vitest sui contenuti pubblici. Separare audit e documentazione dalle correzioni applicative, con verifiche e commit piccoli sul branch operativo.

**Tech Stack:** Astro 6, TypeScript 7, Vitest 3, Node.js >=22.12, Vercel adapter, PWA Workbox.

## Global Constraints

- Dominio pubblico ufficiale: `https://www.sherlockpolizze.it`.
- Package Android: `it.sherlock.polizze`.
- Nessun push, deploy, pagamento, email reale, modifica DNS o dato reale.
- Nessun aggiornamento indiscriminato delle dipendenze.
- Nessun segreto, `.env`, cache, `dist` o `node_modules` nei commit.
- Il lavoro recuperato resta disponibile in `recovery/claude-wip-20260714-1700` al commit `00566a5`.
- Le correzioni giuridiche sono contenuti prudenti e non consulenza professionale.

---

### Task 1: Baseline tecnica e inventario verificabile

**Files:**
- Create: `CODEX_RECOVERY_AUDIT.md`
- Create: `CODEX_IMPLEMENTATION_STATUS.md`
- Create: `PENDING_TASKS.md`
- Create: `TEST_RESULTS.md`
- Create: `DECISIONS.md`

**Interfaces:**
- Consumes: repository al commit operativo `fa77d9c`, script `test` e `build` da `package.json`.
- Produces: baseline documentata con hash del backup, stack, integrazioni, stato dei test e classificazione iniziale.

- [ ] **Step 1: Verificare runtime e dipendenze senza modificarle**

Run: `node --version; npm --version; npm ls --depth=0`

Expected: Node `>=22.12.0`; dipendenze installate oppure elenco esplicito di moduli mancanti.

- [ ] **Step 2: Eseguire la baseline dei test**

Run: `npm test`

Expected: risultato completo registrato; eventuali failure attribuite al contenuto corrente, non corrette silenziosamente.

- [ ] **Step 3: Eseguire type-check e build**

Run: `npx astro check; npm run build`

Expected: esito e diagnostica registrati separatamente in `TEST_RESULTS.md`.

- [ ] **Step 4: Scrivere i cinque documenti di baseline**

Inserire dati osservati: branch/HEAD/remoti, patch `sherlock-recovery-20260714-claude-wip.patch`, SHA-256 `A5F4A14ECC5FC1EA03250A9D1E36BD8FDCA42279514BBE188DD47693FDE80CBC`, commit di recupero, struttura Astro/Vercel/PWA, integrazioni AI/PayPal/Play/GA4/Resend/Redis, risultati dei comandi e rischi aperti.

- [ ] **Step 5: Verificare i documenti**

Run: `rg -n "TBD|TODO|da compilare" CODEX_RECOVERY_AUDIT.md CODEX_IMPLEMENTATION_STATUS.md PENDING_TASKS.md TEST_RESULTS.md DECISIONS.md`

Expected: nessun placeholder; attività residue concrete sono ammesse soltanto in `PENDING_TASKS.md` con stato, rischio e prossimo passo.

- [ ] **Step 6: Commit della baseline**

Run: `git add CODEX_RECOVERY_AUDIT.md CODEX_IMPLEMENTATION_STATUS.md PENDING_TASKS.md TEST_RESULTS.md DECISIONS.md && git commit -m "docs: record recovery and technical baseline"`

Expected: un commit contenente solo documentazione osservabile.

### Task 2: Ampliare i test giuridici anti-regressione

**Files:**
- Modify: `tests/content/legal-regressions.test.ts`

**Interfaces:**
- Consumes: funzione esistente `findMatches(pattern: RegExp)` e insieme dei contenuti pubblici.
- Produces: test che segnalano le occorrenze note ancora presenti prima della correzione.

- [ ] **Step 1: Aggiungere casi fallenti mirati**

Aggiungere test per:

```ts
it('nessuna CTA o funzione denominata ricorso IVASS', () => {
  expect(findMatches(/ricorso\s+IVASS/i)).toHaveLength(0);
});

it('nessun termine generale di otto giorni per la denuncia', () => {
  expect(findMatches(/(entro|termine[^.]{0,20}di)\s+(gli\s+)?(8|otto)\s+giorni/i)).toHaveLength(0);
});

it('nessuna lettera dichiarata pronta senza verifica', () => {
  expect(findMatches(/(lettera|reclamo)\s+(già\s+)?pront[ao]\s+da\s+inviare/i)).toHaveLength(0);
});
```

- [ ] **Step 2: Eseguire il solo test giuridico e confermare il rosso**

Run: `npx vitest run tests/content/legal-regressions.test.ts`

Expected: FAIL con occorrenze almeno in `public/app/index.html`, `public/store-mockups.html` o `src/pages/esempio-report.astro`.

### Task 3: Correggere contenuti giuridici e promesse assolute

**Files:**
- Modify: `public/app/index.html`
- Modify: `public/store-mockups.html`
- Modify: `src/pages/esempio-report.astro`
- Modify: file ulteriori identificati dal test esclusivamente se contengono la stessa classe di errore.
- Create: `LEGAL_CONTENT_AUDIT.md`

**Interfaces:**
- Consumes: test rossi della Task 2.
- Produces: terminologia distinta tra reclamo alla compagnia, esposto IVASS e ricorso AAS; termine generale prudente ex art. 1913; CTA non assolute.

- [ ] **Step 1: Sostituire “Ricorso IVASS” nella PWA**

Usare “Esposto o segnalazione IVASS” per la vigilanza e “Bozza di esposto IVASS” per il generatore. Non presentare IVASS come decisore della controversia individuale.

- [ ] **Step 2: Correggere le occorrenze del termine di otto giorni**

Usare: “L’articolo 1913 c.c. prevede in via generale la comunicazione entro tre giorni dalla conoscenza del sinistro, salvo differenti disposizioni contrattuali o normative; verifica la polizza specifica.”

- [ ] **Step 3: Correggere CTA e qualificazioni automatiche**

Sostituire “reclamo già scritto/pronto da inviare” con “bozza personalizzabile da verificare prima dell’invio”; evitare che una delimitazione del rischio sia qualificata automaticamente come vessatoria.

- [ ] **Step 4: Documentare la ricerca completa**

In `LEGAL_CONTENT_AUDIT.md` elencare pattern, file corretti, occorrenze contestuali accettate e rischi che richiedono verifica professionale.

- [ ] **Step 5: Portare il test giuridico al verde**

Run: `npx vitest run tests/content/legal-regressions.test.ts`

Expected: PASS per tutti i test del file.

- [ ] **Step 6: Eseguire la suite completa**

Run: `npm test`

Expected: PASS oppure failure non correlate documentate prima di proseguire.

- [ ] **Step 7: Commit conformità giuridica**

Run: `git add tests/content/legal-regressions.test.ts public/app/index.html public/store-mockups.html src/pages/esempio-report.astro LEGAL_CONTENT_AUDIT.md && git commit -m "fix: harden legal claims and IVASS terminology"`

Expected: test e correzioni nello stesso commit verificabile.

### Task 4: Dominio, claim commerciali e scarsità

**Files:**
- Modify: contenuti pubblici restituiti dalle ricerche, soltanto dove il riferimento è pubblico e non tecnico.
- Create: `MONETIZATION_CHANGES.md`

**Interfaces:**
- Consumes: dominio ufficiale e vincolo di zero acquisti reali.
- Produces: inventario dei prodotti/claim esistenti e contenuti senza prove sociali o scarsità non dimostrata.

- [ ] **Step 1: Cercare domini e URL pubblici legacy**

Run: `rg -n -i "https?://[^ )\"']+|vercel\.app" src public astro.config.mjs vercel.json`

Expected: ogni URL non ufficiale classificato come tecnico necessario, provider esterno valido o riferimento pubblico da correggere.

- [ ] **Step 2: Cercare claim e scarsità**

Run: `rg -n -i "più scelto|clienti soddisfatti|posti rimasti|disponibilità residua|scade tra|solo oggi|rimborso garantito|vincerai|successo garantito|lifetime|illimitat" src public`

Expected: lista completa classificata in `MONETIZATION_CHANGES.md`.

- [ ] **Step 3: Correggere soltanto le occorrenze pubbliche non dimostrabili**

Mantenere configurazioni e licenze di test senza presentarle come clienti o vendite. Usare “Consigliato per un diniego o una controversia” al posto di “più scelto”.

- [ ] **Step 4: Aggiungere test statici per scarsità e dominio pubblico**

Estendere `tests/content/legal-regressions.test.ts` con pattern esatti per i claim effettivamente trovati e corretti, evitando regex che colpiscano documentazione tecnica legittima.

- [ ] **Step 5: Verificare e committare**

Run: `npm test; npm run build`

Expected: PASS; poi commit `fix: align public domain and commercial claims`.

### Task 5: Audit privacy, sicurezza, analytics e deploy

**Files:**
- Create: `ANALYTICS_EVENTS.md`
- Create: `PRIVACY_SECURITY_AUDIT.md`
- Create: `DEPLOYMENT_GUIDE.md`
- Create: `ROLLBACK_GUIDE.md`
- Create: `POST_DEPLOY_CHECKLIST.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: implementazioni effettive in `src/lib`, `src/pages/api`, `src/middleware.ts`, `astro.config.mjs`, `vercel.json` e privacy pubblica.
- Produces: matrice verificata tra comportamento del codice, configurazione richiesta e operazioni manuali.

- [ ] **Step 1: Inventariare eventi analytics e dati allegati**

Run: `rg -n "gtag|traccia|purchase|checkout|analysis|upload|lead|GA4" src public/app/index.html`

Expected: matrice evento → origine → proprietà → consenso → dati, con gap espliciti.

- [ ] **Step 2: Inventariare controlli privacy e sicurezza**

Run: `rg -n -i "retention|delete|cancel|csrf|csp|content-security|rate.?limit|mime|upload|timeout|retry|redact|log" src astro.config.mjs vercel.json`

Expected: ogni controllo classificato come implementato, parziale, assente o dipendente dal provider.

- [ ] **Step 3: Allineare `.env.example` senza valori reali**

Conservare i nomi già usati dal codice, aggiungere solo variabili effettivamente richieste e descriverne scopo/test mode. Non inventare chiavi o provider non implementati.

- [ ] **Step 4: Scrivere guide operative verificabili**

`DEPLOYMENT_GUIDE.md` descrive prerequisiti, variabili, build e smoke test senza eseguire deploy. `ROLLBACK_GUIDE.md` usa revert/rollback non distruttivi. `POST_DEPLOY_CHECKLIST.md` separa controlli automatici e manuali.

- [ ] **Step 5: Verificare e committare**

Run: `git diff --check; npm test; npm run build`

Expected: PASS; poi commit `docs: add security analytics and deployment audits`.

### Task 6: Chiusura verificata della Fase 1

**Files:**
- Modify: `CODEX_IMPLEMENTATION_STATUS.md`
- Modify: `PENDING_TASKS.md`
- Modify: `TEST_RESULTS.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: risultati e commit delle Task 1-5.
- Produces: passaggio di consegne autosufficiente e prossimo ciclo definito.

- [ ] **Step 1: Eseguire verifica finale fresca**

Run: `npm test; npx astro check; npm run build; git diff --check; git status --short --branch`

Expected: esiti reali registrati con data e comando.

- [ ] **Step 2: Aggiornare stato e residui**

Registrare file modificati, correzioni mantenute, eventuali modifiche selettivamente annullate, credenziali mancanti, rischi residui e primo obiettivo della Fase 2.

- [ ] **Step 3: Commit di chiusura documentale**

Run: `git add CODEX_IMPLEMENTATION_STATUS.md PENDING_TASKS.md TEST_RESULTS.md DECISIONS.md && git commit -m "docs: close Sherlock recovery phase one"`

Expected: working tree pulito e nessuna affermazione di successo non supportata dall'output fresco.
