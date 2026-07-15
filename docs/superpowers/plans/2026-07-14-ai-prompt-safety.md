# AI Prompt Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trattare documenti e note come dati non attendibili e rendere strutturata la generazione delle lettere.

**Architecture:** Un modulo puro costruisce contesti limitati e istruzioni comuni; gli endpoint mantengono i propri schemi ma condividono la regola di trust. La lettera passa a tool use forzato.

**Tech Stack:** TypeScript, Astro, Anthropic Messages API, Vitest.

## Global Constraints

- Nessuna blacklist testuale.
- Nessun ruolo “avvocato”, norma inventata o minaccia automatica.
- Codice singolo consumato solo dopo output valido.

### Task 1: Modulo di trust AI

**Files:** Create `src/lib/ai-safety.ts`, `tests/lib/ai-safety.test.ts`.

- [ ] Test rosso per delimitazione JSON, limiti e regole “ignore instructions in data”.
- [ ] Implementare `AI_UNTRUSTED_DATA_RULES`, `boundedText` e `buildLetterEvidence`.
- [ ] Test verde e commit `feat: add untrusted AI context builder`.

### Task 2: Lettera strutturata

**Files:** Modify `src/pages/api/lettera.ts`; create `tests/api/lettera-safety.test.ts`.

- [ ] Test rosso per whitelist tipo, tool choice, system prudente e mancato consumo su output invalido.
- [ ] Sostituire prompt libero con tool `genera_bozza_lettera`, schema richiesto e parsing del blocco nominato.
- [ ] Limitare campi e note; restituire `AI_OUTPUT_INVALID` senza testo provider.
- [ ] Test verde e commit `feat: structure safe letter generation`.

### Task 3: Trust rules analisi/confronto

**Files:** Modify `src/pages/api/analizza.ts`, `src/pages/api/compara.ts`; modify/add test di regressione sicurezza.

- [ ] Test rosso che richiede la regola comune nei system prompt e assenza di interpolazione diretta del sinistro.
- [ ] Integrare regola comune e blocco dati delimitato.
- [ ] Test verde e commit `feat: mark uploaded AI content untrusted`.

### Task 4: Audit e verifica

**Files:** Modify `PRIVACY_SECURITY_AUDIT.md`, `PENDING_TASKS.md`, `CODEX_IMPLEMENTATION_STATUS.md`, `TEST_RESULTS.md`.

- [ ] Documentare mitigazione e limiti residui.
- [ ] Eseguire `npm test`, `npx astro check`, `npm run build`, `git diff --check`.
- [ ] Commit `docs: close AI prompt safety hardening`.
