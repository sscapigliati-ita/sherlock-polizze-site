# IVASS and AAS Content Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminare dai contenuti prioritari termini, date, limiti e percentuali non conformi alle fonti ufficiali IVASS/AAS.

**Architecture:** Controlli statici Vitest riproducono ogni classe di errore prima della correzione. I contenuti vengono corretti in tre gruppi: mockup/IVASS, guide reclamo, AAS/storia; ogni gruppo viene verificato prima del successivo.

**Tech Stack:** Astro, Markdown, Vitest, TypeScript 6.0.3.

## Global Constraints

- Fonti: pagine ufficiali IVASS Reclami e AAS; D.M. 215/2024 su Normattiva.
- Nessuna percentuale di successo senza fonte diretta e corretta interpretazione.
- Nessuna consulenza o conclusione automatica sul caso individuale.
- Nessun cambio di slug/URL in questa tranche.

---

### Task 1: Test anti-regressione IVASS/AAS

**Files:**
- Modify: `tests/content/legal-regressions.test.ts`

- [ ] Aggiungere test per: AAS operativo nel 2024; limite 150.000 euro; risposta reclamo generale a 60 giorni; termine IVASS generale di 45 giorni; “decisione IVASS”; percentuali promozionali individuate; “avrei vinto/non c'è dubbio”.
- [ ] Run: `npx vitest run tests/content/legal-regressions.test.ts`
- [ ] Expected: FAIL con i file elencati nella specifica.

### Task 2: Mockup e guida IVASS

**Files:**
- Modify: `public/store-mockups.html`
- Modify: `src/content/guide/esposto-ivass-modello.md`

- [ ] Correggere “reclamo IVASS” in reclamo/segnalazione o esposto coerente con il contesto.
- [ ] Rimuovere art. 1913 a otto giorni, generazione in secondi, termine IVASS di 45 giorni, “decisione IVASS”, 60-70%, stragrande maggioranza e limite AAS 150.000 euro.
- [ ] Run: test giuridico; verificare che i failure di questi due file siano risolti.

### Task 3: Guide reclamo e sinistro

**Files:**
- Modify: `src/content/guide/compagnia-non-risponde-reclamo.md`
- Modify: `src/content/guide/risarcimento-auto-negato.md`
- Modify: `src/content/guide/sinistro-respinto-cosa-fare.md`

- [ ] Uniformare a 45 giorni la risposta al reclamo dell'impresa.
- [ ] Rimuovere “silenzio equivale a rigetto”, percentuali di successo e causalità non dimostrate.
- [ ] Descrivere IVASS come vigilanza e AAS come ricorso subordinato ai requisiti applicabili.
- [ ] Run: test giuridico; verificare che i failure di queste guide siano risolti.

### Task 4: Guida AAS e storia fondatore

**Files:**
- Modify: `src/content/guide/ricorso-aas-arbitro-assicurativo-come-vincere.md`
- Modify: `src/pages/storia-sherlock.astro`

- [ ] Correggere operatività al 15 gennaio 2026, costo 20 euro, procedura online, reclamo preventivo e tempi 180+90.
- [ ] Eliminare limiti/esclusioni non verificati dal copy generale e rinviare al portale ufficiale.
- [ ] Rinominare il titolo editoriale “come vincere” senza cambiare lo slug.
- [ ] Trasformare “avrei vinto” e “vittorie” in lezioni o elementi favorevoli documentati.
- [ ] Run: `npx vitest run tests/content/legal-regressions.test.ts` Expected: PASS.

### Task 5: Audit, verifica e commit

**Files:**
- Modify: `LEGAL_CONTENT_AUDIT.md`
- Modify: `CODEX_IMPLEMENTATION_STATUS.md`
- Modify: `PENDING_TASKS.md`
- Modify: `TEST_RESULTS.md`

- [ ] Registrare fonti, file corretti e residui.
- [ ] Run: `npm test; npx astro check; npm run build; git diff --check`
- [ ] Expected: tutti i comandi exit 0.
- [ ] Commit: `fix: correct IVASS and AAS public guidance`.
