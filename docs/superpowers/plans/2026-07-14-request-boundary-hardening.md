# Request Boundary Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloccare richieste abusive e upload contraffatti e applicare header HTTP difensivi a tutte le risposte.

**Architecture:** Tre moduli isolati gestiscono header, rate limit e firme file. Il middleware applica gli header; gli endpoint invocano guardie condivise prima di servizi esterni.

**Tech Stack:** Astro middleware, TypeScript, Vitest, Upstash Redis/Vercel KV.

## Global Constraints

- Nessun IP o documento in chiaro persistito.
- Nessuna nuova dipendenza runtime.
- Le API bloccano prima di Anthropic/PayPal.
- Fallback memoria ammesso solo senza KV in sviluppo/test.

---

### Task 1: Security headers

**Files:** Create `src/lib/security-headers.ts`, `tests/lib/security-headers.test.ts`; modify `src/middleware.ts`, `vercel.json`.

- [ ] Scrivere test fallenti per i sei header obbligatori e la conservazione di `Content-Type`.
- [ ] Eseguire `npm test -- --run tests/lib/security-headers.test.ts` e osservare FAIL per modulo assente.
- [ ] Implementare `applySecurityHeaders(response: Response): Response` clonando status/body/header e aggiungendo CSP compatibile con Google, PayPal e asset correnti.
- [ ] Applicarla nel middleware anche alle rotte non amministrative e aggiungere gli stessi header statici in `vercel.json`.
- [ ] Verificare test e commit `feat: add global security headers`.

### Task 2: Upload validation

**Files:** Create `src/lib/upload-validation.ts`, `tests/lib/upload-validation.test.ts`; modify `src/pages/api/analizza.ts`, `src/pages/api/compara.ts`.

- [ ] Scrivere test fallenti per PDF `%PDF-`, JPEG `FFD8FF`, PNG e WebP, oltre a base64 invalido, vuoto, troppo grande e mismatch MIME.
- [ ] Osservare FAIL per modulo assente.
- [ ] Implementare `validateBase64Upload({ data, declaredMime, maxBytes }): { ok: true; mime; bytes } | { ok: false; code }` con decodifica limitata e confronto firma.
- [ ] Integrare prima della costruzione delle richieste Anthropic; restituire `400` con codice stabile.
- [ ] Verificare i test mirati e commit `feat: validate uploaded file signatures`.

### Task 3: Rate limiting

**Files:** Create `src/lib/rate-limit.ts`, `tests/lib/rate-limit.test.ts`; modify `src/middleware.ts`.

- [ ] Scrivere test fallenti per soglia, finestra, chiave anonimizzata SHA-256 e risposta `429` con `Retry-After`.
- [ ] Osservare FAIL per modulo assente.
- [ ] Implementare `checkRateLimit({ namespace, identity, limit, windowSeconds })` con KV atomico e fallback memoria; esporre `rateLimitResponse(result)`.
- [ ] Nel middleware proteggere `/api/analizza`, `/api/compara`, `/api/lettera`, create/capture PayPal e verify Play con limiti distinti; derivare identità dagli header proxy e hasharla prima dello storage.
- [ ] Verificare che una richiesta bloccata non entri nell'handler e commit `feat: rate limit sensitive APIs`.

### Task 4: Audit e verifica completa

**Files:** Modify `PRIVACY_SECURITY_AUDIT.md`, `CODEX_IMPLEMENTATION_STATUS.md`, `PENDING_TASKS.md`, `TEST_RESULTS.md`, `.env.example`.

- [ ] Documentare controlli, variabili e limiti residui senza dichiarare WAF/antivirus inesistenti.
- [ ] Eseguire `npm test`, `npx astro check`, `npm run build`, `git diff --check`.
- [ ] Richiedere 0 test falliti, 0 errori Astro e build exit 0.
- [ ] Commit `docs: close request boundary hardening`.
