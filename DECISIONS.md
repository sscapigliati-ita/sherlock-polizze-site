# Decisions

## 2026-07-14 — Conservazione prima delle modifiche

Decisione: creare patch esterna, branch di recupero e commit dedicato prima del lavoro Codex.

Motivo: rendere reversibile e attribuibile ogni correzione successiva senza perdere il WIP Claude.

## 2026-07-14 — Esecuzione locale sul branch dedicato

Decisione: lavorare nel checkout locale esistente sul branch `codex/complete-sherlock-commercial-hardening`, come richiesto dall'utente, senza subagent e senza operare su `main`.

Motivo: il WIP è già stato separato e protetto; un ulteriore worktree aumenterebbe la complessità del recupero senza beneficio proporzionato.

## 2026-07-14 — Programma suddiviso in fasi

Decisione: completare prima recupero, baseline e conformità prioritaria; progettare nel dettaglio monetizzazione, upload, AI e pagamenti soltanto dopo l'audit delle implementazioni esistenti.

Motivo: evitare duplicazioni e grandi modifiche non verificabili.

## 2026-07-14 — Failure di baseline non mascherate

Decisione: registrare i tre test giuridici falliti e l'incompatibilità di `astro check`, mantenendo distinta la build riuscita.

Motivo: i failure sono evidenza utile. Le regressioni di contenuto rientrano nella Fase 1; la dipendenza incompatibile richiede una correzione puntuale e separata.

## 2026-07-14 — Founder preservato ma non commercializzato

Decisione: rimuovere Founder lifetime e scarsità dall'interfaccia pubblica, mantenendo schema e licenze backend esistenti.

Motivo: evitare di rompere account di test e, contemporaneamente, non vendere un uso AI perpetuo o presentare disponibilità residue non supportate.

## 2026-07-14 — Nessun aggiornamento dipendenze non verificato

Decisione: non forzare un aggiornamento/downgrade TypeScript durante la Fase 1.

Motivo: build e test sono verdi, mentre il checker dichiara un peer range incompatibile. La correzione richiede scelta puntuale della coppia di versioni e va trattata come task separato con lockfile e verifica completa.
