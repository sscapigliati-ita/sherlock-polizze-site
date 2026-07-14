# Codex Recovery Audit

Data audit: 14 luglio 2026, Europe/Rome.

## Stato Git acquisito

- Repository: `C:\Users\Stefano\sherlock-site`
- Branch iniziale: `main`
- HEAD iniziale: `458b47c18494f0c944ee79f68badfa9dbe176403`
- Remote: `origin https://github.com/sscapigliati-ita/sherlock-polizze-site.git`
- Branch Claude già presente: `fix/seo-analytics-conversion-sherlock` a `73cff85`
- Branch di recupero creato: `recovery/claude-wip-20260714-1700`
- Commit di recupero: `00566a5 chore: preserve Claude Code interrupted work`
- Branch operativo: `codex/complete-sherlock-commercial-hardening`

Lo stato iniziale conteneva sette file pubblici modificati e il nuovo file `tests/content/legal-regressions.test.ts`. Non vi erano modifiche staged. Il controllo preliminare dei diff e del nuovo test non ha rilevato valori di credenziali; i riferimenti a nomi di variabili come `ANTHROPIC_API_KEY` sono configurazione, non segreti.

## Backup esterno

- File: `sherlock-recovery-20260714-claude-wip.patch`
- Dimensione: 15.149 byte
- SHA-256: `A5F4A14ECC5FC1EA03250A9D1E36BD8FDCA42279514BBE188DD47693FDE80CBC`
- Posizione esterna al repository: area artefatti locale Codex della sessione.

La patch include diff binario dei file tracciati e il file non tracciato. Il commit `00566a5` costituisce il secondo livello di conservazione.

## Ricostruzione del lavoro Claude non committato

Le modifiche correggono principalmente formulazioni su art. 1913 c.c., IVASS, “precisione legale” e claim normativi assoluti. Il test aggiunto tenta di impedire regressioni su queste classi. La direzione è corretta ma l'implementazione è incompleta: la baseline rileva ancora due occorrenze di “Ricorso IVASS”, quattro promesse temporali e una frase ambigua sull'attività di IVASS.

Classificazione iniziale:

- corretta ma incompleta: correzioni giuridiche nei sette file pubblici;
- utile ma da rifinire: test statico anti-regressione;
- non attribuibile con certezza al WIP corrente: incompatibilità TypeScript 7 / `@astrojs/check`, già presente nella cronologia committata;
- nessuna modifica WIP classificata come pericolosa o da annullare.

## Punto stabile precedente

Il WIP deriva da `458b47c`, coincidente con `origin/main` al momento dell'acquisizione. Non è stato eseguito alcun ripristino. Il confronto resta disponibile tra `458b47c`, `00566a5` e i commit operativi Codex.

