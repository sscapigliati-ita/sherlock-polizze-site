# Audit della superficie pubblica

Ultimo aggiornamento: 15 luglio 2026.

| Area | Problema iniziale | Gravità | Impatto commerciale | Correzione | File | Stato |
|---|---|---:|---|---|---|---|
| Art. 1892 PWA | Termine presentato come decorrente dal sinistro | Alta | Esponeva il servizio a contestazioni di affidabilità | Formulazione corretta e test anti-regressione | `public/app/index.html` | corretto |
| Art. 1892 guide | Due formulazioni incomplete o errate | Alta | Riduceva autorevolezza dei contenuti | Distinti conoscenza del fatto, presupposti e facoltà dell'assicuratore | `src/content/guide/` | corretto |
| Art. 1913 | Rischio di termini generali assoluti | Alta | Possibili indicazioni operative errate | Controlli statici e formulazione prudente già presenti | `tests/content/legal-regressions.test.ts` | corretto |
| Clausole | Nullità o vessatorietà presentate come automatiche | Alta | Aspettative legali improprie | Richiesta valutazione di testo, struttura e disciplina applicabile | PWA e guida lettura polizza | corretto |
| IVASS e AAS | Percorsi potenzialmente confusi | Alta | Scelta errata dello strumento di tutela | Distinti reclamo, esposto, arbitrato, mediazione e giudizio nei controlli | pagine e guide pubbliche | corretto |
| Prove sociali | Somma recuperata e recensioni non verificabili dal repository | Alta | Rischio reputazionale e pubblicitario | Blocchi e dati strutturati rimossi | `src/pages/index.astro` | corretto |
| Dimostrazioni | Etichetta “esempio reale” su casi non documentati | Alta | Caso simulato percepibile come testimonianza | Rinominato “simulazione dimostrativa” in 20 superfici | pagine, guide e PWA | corretto |
| Offerta legacy | Piani e prezzi storici ancora scopribili | Alta | Funnel incoerente e rischio di vendita involontaria | Rimossi da navigazione/home, route noindex ed escluse dalla sitemap | header, footer, home, config | sospeso |
| Privacy | Eventi definiti anonimi e garanzie assolute sui fornitori | Alta | Informativa non coerente col trattamento osservabile | Pseudonimizzazione, fornitori e richieste supporto chiariti | privacy e trasparenza | corretto |
| Dominio | Necessità di impedire URL preview pubblici | Media | Diluizione SEO e callback errate | Controllo automatico sul dominio ufficiale | config e test SEO | corretto |
| Sitemap | Route commerciali legacy indicizzabili | Alta | Motori verso offerte ritirate | Esclusioni esplicite verificate nella build | `astro.config.mjs` | corretto |
| Guide residue | Revisione professionale completa non eseguita | Media | Rischio editoriale residuo | Controlli automatici ampliati; validazione professionale rinviata | corpus guide | residuo |

## Confine della fase

Questa fase stabilizza il rischio pubblico. Non implementa nuovi prezzi, checkout, upload multiplo, triage avanzato, retention automatica o restyling completo.
