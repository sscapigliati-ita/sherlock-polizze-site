# Sherlock Polizze Recovery and Phase 1 Design

## Obiettivo

Conservare integralmente il lavoro interrotto di Claude Code e riportare il repository a uno stato verificato, documentato e prudente, senza perdere modifiche valide e senza intervenire su produzione. Questa prima unità copre recupero, audit tecnico, build, correzioni giuridiche prioritarie, dominio ufficiale e rimozione di claim assoluti o scarsità artificiale.

## Stato iniziale verificato

- Repository: `C:\Users\Stefano\sherlock-site`
- Branch iniziale: `main`
- HEAD iniziale: `458b47c18494f0c944ee79f68badfa9dbe176403`
- Remote: `origin` su `https://github.com/sscapigliati-ita/sherlock-polizze-site.git`
- Lavoro Claude non committato: sette file pubblici modificati e un test giuridico nuovo.
- Backup esterno: patch binaria datata con hash SHA-256 registrato nell'audit.
- Branch di recupero: `recovery/claude-wip-20260714-1700`
- Commit di recupero: `00566a5 chore: preserve Claude Code interrupted work`
- Branch operativo: `codex/complete-sherlock-commercial-hardening`

## Strategia

Il lavoro procede per incrementi piccoli e verificabili. Il commit di recupero resta immutabile come punto di confronto. Sul branch operativo vengono prima prodotti gli audit e una baseline dei test; successivamente ogni gruppo omogeneo di correzioni viene accompagnato da test anti-regressione, aggiornamento dei documenti di stato e commit descrittivo.

Il programma completo viene scomposto in unità successive:

1. recupero, audit, build e conformità prioritaria;
2. stabilizzazione e regressioni;
3. monetizzazione e separazione test/reale;
4. upload, report e pipeline AI;
5. pagamenti, analytics, privacy e sicurezza;
6. UX, SEO, strumenti gratuiti e prestazioni.

Ogni unità deve lasciare software funzionante e documentazione sufficiente per riprendere il lavoro senza affidarsi al contesto della conversazione.

## Architettura e confini della Fase 1

La Fase 1 non introduce nuovi provider o credenziali. Analizza e conserva l'architettura Astro esistente, le API serverless, la PWA statica e le integrazioni già presenti. Le modifiche funzionali sono limitate a contenuti pubblici, configurazione del dominio, test statici anti-regressione e correzioni strettamente necessarie per ottenere build e test coerenti.

I controlli giuridici devono coprire l'intero contenuto pubblico, inclusi pagine Astro, guide, componenti, layout e PWA. Le regole testuali devono bloccare almeno: termine errato di otto giorni ex art. 1913 c.c.; “ricorso IVASS”; termine generale IVASS di 120 giorni; “precisione legale”; promesse di risultato garantito; automatismi sulla vessatorietà. I test non sostituiscono la revisione contestuale: risultati statistici, percentuali di successo e formulazioni ambigue devono essere classificati manualmente nell'audit.

## Flusso operativo

1. Registrare inventario Git, stack, script, dipendenze, ambienti e integrazioni.
2. Eseguire test e build esistenti senza aggiornamenti indiscriminati.
3. Classificare gli errori come preesistenti, attribuibili al lavoro Claude o introdotti da Codex.
4. Cercare globalmente claim giuridici, promozionali e domini pubblici non conformi.
5. Scrivere test fallenti per ogni classe di regressione non ancora coperta.
6. Correggere il minimo contenuto necessario, mantenendo tono prudente e neutrale.
7. Verificare test, type-check/build e ispezione mirata dell'output.
8. Aggiornare audit, stato, attività residue, risultati test e decisioni.
9. Committare separatamente baseline/documentazione e correzioni applicative.

## Gestione errori e sicurezza

Nessun segreto viene aggiunto o stampato nei documenti. `.env`, credenziali, cache, build e dipendenze rigenerabili restano esclusi dai commit. Un test o una build falliti non vengono mascherati: il risultato, la causa conosciuta e il prossimo passo vengono registrati. Non si effettuano push, deploy, pagamenti, invii email, modifiche DNS o operazioni su dati reali.

Le correzioni sono selettive. Una modifica Claude incompleta viene mantenuta quando è sicura e coerente; se richiede revisione, viene classificata e corretta con un diff tracciabile. Nessuna modifica viene annullata soltanto perché la sua origine non è certa.

## Verifica e criteri di uscita

La Fase 1 è completata quando:

- patch e branch di recupero sono verificabili;
- i deliverable di audit e passaggio di consegne esistono e riflettono lo stato reale;
- test e build sono stati eseguiti con risultati registrati;
- gli errori giuridici prioritari noti non compaiono nei contenuti pubblici;
- claim assoluti, scarsità artificiale e statistiche commerciali non dimostrate sono rimossi o registrati come blocchi espliciti;
- il dominio pubblico è `https://www.sherlockpolizze.it`, senza sostituire URL tecnici necessari;
- ogni residuo è elencato con rischio, dipendenza e prossimo passo;
- il branch operativo è pulito dopo commit piccoli e descrittivi.

## Decisioni rinviate alle unità successive

Pricing definitivo, schema delle transazioni, upload avanzato, report strutturato, pipeline AI a più passaggi, nuovi provider di pagamento e funzionalità professionali richiedono l'audit del codice esistente. Non vengono progettati in dettaglio prima di aver completato la baseline tecnica e aver identificato ciò che Claude Code ha già implementato.
