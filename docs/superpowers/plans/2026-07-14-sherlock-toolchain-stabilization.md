# Sherlock Toolchain Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ripristinare `astro check` usando una coppia TypeScript/checker dichiaratamente compatibile.

**Architecture:** Modifica puntuale della sola dipendenza TypeScript e del lockfile. Le eventuali diagnostiche applicative emerse saranno corrette separatamente, senza aggiornare Astro o altri package.

**Tech Stack:** Astro 6.4.6, `@astrojs/check` 0.9.9, TypeScript 6.0.3, npm 11.

## Global Constraints

- Non aggiornare altre dipendenze.
- Non usare `--force` o `--legacy-peer-deps`.
- Non modificare codice applicativo prima che `astro check` produca diagnostiche reali.
- Test e build devono restare verdi.

---

### Task 1: Allineare TypeScript al peer range del checker

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: peer range `^5.0.0 || ^6.0.0` di `@astrojs/check@0.9.9`.
- Produces: installazione con `typescript@6.0.3` e albero npm valido.

- [ ] **Step 1: Installare la versione puntuale**

Run: `npm install --save-dev --save-exact typescript@6.0.3`

Expected: solo `package.json`, `package-lock.json` e installazione locale TypeScript cambiano.

- [ ] **Step 2: Verificare albero dipendenze**

Run: `npm ls typescript @astrojs/check`

Expected: exit 0, TypeScript 6.0.3, nessun `invalid` o `ELSPROBLEMS`.

- [ ] **Step 3: Verificare il diff del lockfile**

Run: `git diff -- package.json package-lock.json`

Expected: nessun aggiornamento non correlato.

### Task 2: Eseguire diagnostica e correggere errori reali

**Files:**
- Modify: soltanto file indicati da `astro check`, se necessario.
- Modify: `TEST_RESULTS.md`
- Modify: `CODEX_IMPLEMENTATION_STATUS.md`
- Modify: `PENDING_TASKS.md`

**Interfaces:**
- Consumes: toolchain valida dalla Task 1.
- Produces: diagnostica Astro completa e stato documentato.

- [ ] **Step 1: Eseguire il checker**

Run: `npx astro check`

Expected: il comando non deve più arrestarsi in `fileExists`; eventuali errori contengono file e righe applicative.

- [ ] **Step 2: Correggere una diagnostica alla volta**

Per ogni errore: riprodurre con `npx astro check`, applicare la modifica minima nel file indicato e rieseguire il comando. Non correggere warning estetici non bloccanti in questa tranche.

- [ ] **Step 3: Eseguire verifiche complete**

Run: `npm test; npx astro check; npm run build; git diff --check`

Expected: tutti i comandi exit 0.

- [ ] **Step 4: Aggiornare documentazione**

Registrare versione, diagnostiche trovate/corrette e output finale nei tre documenti di stato.

- [ ] **Step 5: Commit**

Run: `git add package.json package-lock.json TEST_RESULTS.md CODEX_IMPLEMENTATION_STATUS.md PENDING_TASKS.md <eventuali-file-applicativi> && git commit -m "fix: restore Astro type checking"`

Expected: commit isolato, working tree pulito.
