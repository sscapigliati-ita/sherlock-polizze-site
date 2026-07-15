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

## 2026-07-14 — TypeScript fissato a 6.0.3

Decisione: sostituire TypeScript 7.0.2 con la versione esatta 6.0.3, mantenendo Astro e tutte le altre dipendenze.

Motivo: è l'ultima versione stabile della serie dichiarata compatibile dal checker installato. L'albero npm è ora valido e `astro check` produce e verifica diagnostiche reali.

## 2026-07-15 — Stabilizzazione pubblica prima del restyling

Decisione: correggere prima rischi legali, privacy, prove sociali e indicizzazione; affrontare il restyling e la nuova monetizzazione in una fase successiva.

Motivo: non amplificare con una nuova interfaccia claim o offerte non ancora verificati.

## 2026-07-15 — Offerta legacy sospesa ma retrocompatibile

Decisione: rimuovere piani e prezzi storici dalla scoperta pubblica, applicare `noindex` ed escluderli dalla sitemap senza eliminare route, endpoint o entitlement.

Motivo: impedire vendite involontarie mantenendo validi flussi e utenti esistenti.

## 2026-07-15 — Modifica Android concorrente preservata

Decisione: non alterare né annullare il commit esterno `3ebc0fc`, comparso sul ramo durante il lavoro e relativo ad Android v4.6.8/vc66 e codici `PLAY-*`.

Motivo: la Fase 1 non autorizza modifiche Android e il commit non è stato prodotto da questa lavorazione; preservarlo evita di sovrascrivere lavoro dell'utente.
