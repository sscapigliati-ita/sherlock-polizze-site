# AI Prompt Safety Design

Data: 14 luglio 2026  
Stato: approvato per delega decisionale dell'utente

## Obiettivo

Ridurre prompt injection e output incontrollato nelle tre API AI, con priorità alla generazione delle lettere.

## Decisione

Usare difesa a strati: istruzioni di sistema che dichiarano i documenti dati non attendibili, delimitazione strutturale, normalizzazione/limiti dei campi e `tool_choice` forzato per la lettera. Non tentare blacklist di frasi: è fragile e può eliminare contenuto assicurativo legittimo.

## Comportamento lettera

- Il sistema non si presenta come avvocato e produce una bozza da verificare.
- Non inventa norme, fatti, termini, destinatari o minacce; usa solo elementi presenti e segnala campi mancanti.
- `tipo` è una whitelist: `reclamo`, `ivass`, `diffida`; valori diversi sono respinti.
- I dati dell'analisi e le note sono serializzati come JSON delimitato e dichiarati non attendibili. Istruzioni contenute nei dati devono essere trattate come testo, mai eseguite.
- Anthropic deve chiamare `genera_bozza_lettera` con schema `{ lettera, avvertenze }`; risposte senza tool sono errore controllato.
- Un codice singolo viene consumato soltanto dopo output strutturato valido e non vuoto.

## Analisi e confronto

Le istruzioni di sistema ricevono la stessa regola di non fiducia: contenuto di PDF, immagini e testo incidente è evidenza da analizzare, non una fonte di istruzioni. Il testo incidente è passato in un blocco separato, senza interpolazione tra virgolette nel comando.

## Limiti

La difesa riduce il rischio ma non dimostra l'assenza di prompt injection. Non vengono introdotti moderazione esterna, secondo modello revisore o verifica legale automatica.

## Test e criteri

- builder di contesto conserva frasi ostili come dati delimitati e impone limiti;
- tipo non ammesso restituisce 400 prima del provider;
- richiesta lettera usa tool forzato e non contiene ruolo “avvocato” o ordine di minacciare;
- output mancante/invalido non consuma il codice;
- sistemi analizza/compara includono la regola di non fiducia;
- suite, check, build e diff check verdi.
