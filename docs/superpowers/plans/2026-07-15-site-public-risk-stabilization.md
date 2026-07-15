# Sherlock Site Public Risk Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bonificare la superficie pubblica di Sherlock da rischi legali, prove sociali non verificabili e offerta legacy, preservando retrocompatibilità e stabilità.

**Architecture:** Centralizzare la visibilità pubblica dell'offerta in una configurazione pura, rendere esplicito `noindex` nel layout e separare indicizzazione da compatibilità tecnica. Estendere i test statici a tutte le superfici pubbliche, quindi correggere contenuti, privacy e dominio per blocchi indipendenti.

**Tech Stack:** Astro 6, TypeScript 6.0.3, Vitest 3.2.6, Playwright, Tailwind CSS 4, Vercel.

## Global Constraints

- Branch operativo: `codex/site-conversion-redesign`; non lavorare su `main` o `master`.
- Dominio pubblico unico: `https://www.sherlockpolizze.it`.
- Non modificare `android/`, non creare AAB/APK e non intervenire su Play Console.
- `public/app/index.html` può cambiare solo come web app pubblica; non sincronizzare la copia Android.
- Le route legacy non sono commercializzate ma gli endpoint, record ed entitlement esistenti restano compatibili.
- Non pubblicizzare 12,90 euro o 24,90 euro prima dell'implementazione dei nuovi prodotti.
- Nessun contenuto automatico equivale ad approvazione legale professionale.
- Ogni modifica applicativa segue test rosso, implementazione minima, test verde e commit dedicato.

---

### Task 1: Configurazione dell'offerta pubblica legacy

**Files:**
- Create: `src/config/public-offer.ts`
- Create: `tests/lib/public-offer.test.ts`

**Interfaces:**
- Produces: `PUBLIC_OFFER`, `isLegacyPublicRoute(pathname: string): boolean`, `isPubliclyMarketedProduct(productId: string): boolean`.
- Consumes: nessuna dipendenza applicativa.

- [ ] **Step 1: Scrivere il test rosso della configurazione**

```ts
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_OFFER,
  isLegacyPublicRoute,
  isPubliclyMarketedProduct,
} from '../../src/config/public-offer';

describe('offerta pubblica durante la transizione', () => {
  it('espone soltanto triage ed esempio dimostrativo', () => {
    expect(PUBLIC_OFFER.primaryCta).toEqual({ label: 'Fai il triage gratuito', href: '/app/' });
    expect(PUBLIC_OFFER.secondaryCta).toEqual({ label: 'Guarda una simulazione di analisi', href: '/esempio-report' });
  });

  it.each(['/abbonati', '/abbonamento/mensile', '/reclamo-singolo'])('%s è una route legacy', (path) => {
    expect(isLegacyPublicRoute(path)).toBe(true);
  });

  it.each(['mensile', 'semestrale', 'annuale', 'singolo', 'founder'])('%s non è commercializzato', (id) => {
    expect(isPubliclyMarketedProduct(id)).toBe(false);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare il fallimento**

Run: `npm test -- --run tests/lib/public-offer.test.ts`  
Expected: FAIL perché `src/config/public-offer.ts` non esiste.

- [ ] **Step 3: Implementare la configurazione pura**

```ts
export const PUBLIC_OFFER = Object.freeze({
  legacyProductsVisible: false,
  primaryCta: Object.freeze({ label: 'Fai il triage gratuito', href: '/app/' }),
  secondaryCta: Object.freeze({ label: 'Guarda una simulazione di analisi', href: '/esempio-report' }),
  legacyRoutes: Object.freeze(['/abbonati', '/abbonamento', '/reclamo-singolo']),
  legacyProductIds: Object.freeze(['mensile', 'semestrale', 'annuale', 'singolo', 'founder']),
});

export function isLegacyPublicRoute(pathname: string): boolean {
  const normalized = `/${pathname}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  return PUBLIC_OFFER.legacyRoutes.some((route) => normalized === route || normalized.startsWith(`${route}/`));
}

export function isPubliclyMarketedProduct(productId: string): boolean {
  return PUBLIC_OFFER.legacyProductsVisible
    ? !PUBLIC_OFFER.legacyProductIds.includes(productId)
    : false;
}
```

- [ ] **Step 4: Eseguire test mirato e suite configurazione**

Run: `npm test -- --run tests/lib/public-offer.test.ts`  
Expected: 3 gruppi verdi, nessun prodotto legacy pubblico.

- [ ] **Step 5: Commit**

```powershell
git add src/config/public-offer.ts tests/lib/public-offer.test.ts
git commit -m "feat: centralize transitional public offer"
```

---

### Task 2: Copertura legale completa della superficie pubblica

**Files:**
- Modify: `tests/content/legal-regressions.test.ts`
- Modify: `public/app/index.html`
- Modify: `src/pages/esempio-report.astro`
- Modify: `src/pages/esempio-lettera.astro`
- Modify: `src/content/guide/ricorso-aas-arbitro-assicurativo-come-vincere.md`
- Modify: altri file pubblici riportati dal test rosso, escluso `android/`.

**Interfaces:**
- Consumes: walker pubblico esistente in `legal-regressions.test.ts`.
- Produces: zero formulazioni vietate in `src/pages`, `src/content`, `src/layouts`, `src/components` e `public`.

- [ ] **Step 1: Aggiungere i test rossi mancanti**

```ts
it('art. 1892 non è un termine generale decorrente dal sinistro', () => {
  const hits = findMatches(/1892[^.]{0,180}(tre|3)\s*mesi[^.]{0,120}(dal|dalla)\s*sinistro|(tre|3)\s*mesi[^.]{0,180}1892/i);
  expect(hits, `Uso errato art. 1892: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
});

it('nessuna qualificazione automatica delle clausole', () => {
  const hits = findMatches(/clausola[^.]{0,80}(automaticamente\s+)?(vessatoria|nulla|inefficace)|doppia\s+firma\s+(sempre|obbligatoria)/i);
  expect(hits, `Qualificazione automatica: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
});

it('ogni lettera pronta è qualificata come bozza da verificare', () => {
  const hits = findMatches(/lettera\s+pronta\s+da\s+inviare|pronto\s+da\s+inviare\s+via\s+PEC/i);
  expect(hits, `Bozza presentata come definitiva: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
});
```

- [ ] **Step 2: Eseguire il test rosso e salvare l'inventario dei match**

Run: `npm test -- --run tests/content/legal-regressions.test.ts`  
Expected: FAIL almeno su `public/app/index.html` per art. 1892.

- [ ] **Step 3: Correggere art. 1892 e 1913 con copy prudente**

Usare questa formulazione dove serve spiegare l'art. 1892:

```text
L'articolo 1892 c.c. disciplina le dichiarazioni inesatte e le reticenze rese con dolo o colpa grave. Il termine previsto dalla norma riguarda l'esercizio delle facoltà dell'assicuratore dopo la conoscenza dell'inesattezza o della reticenza rilevante e non costituisce un termine generale decorrente dal sinistro per ogni contestazione sulla copertura.
```

Usare questa formulazione per l'art. 1913:

```text
L'articolo 1913 del Codice civile prevede in via generale la comunicazione del sinistro entro tre giorni da quando si è verificato o l'assicurato ne ha avuto conoscenza, salvo differenti disposizioni contrattuali o normative. Occorre verificare la specifica polizza e il caso concreto.
```

- [ ] **Step 4: Correggere clausole e percorsi di tutela**

Sostituire conclusioni automatiche con:

```text
La clausola limita o delimita la copertura. La sua eventuale vessatorietà, nullità o inefficacia non può essere determinata automaticamente e richiede la valutazione della formulazione, della struttura contrattuale e della disciplina applicabile.
```

Mantenere separati “reclamo alla compagnia”, “esposto o segnalazione a IVASS”, “ricorso all'Arbitro Assicurativo”, “mediazione” e “azione giudiziale”.

- [ ] **Step 5: Eseguire test mirato e suite completa**

Run: `npm test -- --run tests/content/legal-regressions.test.ts`  
Expected: tutti i test legali verdi.

Run: `npm test`  
Expected: nessuna regressione nei test esistenti.

- [ ] **Step 6: Commit**

```powershell
git add tests/content/legal-regressions.test.ts public/app/index.html src/pages src/content
git commit -m "fix: remove unsafe public legal claims"
```

---

### Task 3: Rimozione di prove sociali e dimostrazioni fuorvianti

**Files:**
- Create: `tests/content/public-trust-regressions.test.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/esempio-report.astro`
- Modify: `src/pages/esempio-lettera.astro`
- Modify: `src/pages/storia-sherlock.astro`
- Modify: `public/app/index.html`
- Modify: guide indicate dal test rosso.

**Interfaces:**
- Produces: `findPublicMatches(pattern)` nel solo file test; copy pubblico senza risultati economici, recensioni o casi reali non verificati.

- [ ] **Step 1: Scrivere il test rosso della fiducia pubblica**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const roots = ['src/pages', 'src/content', 'src/components', 'src/layouts', 'public'];
const extensions = new Set(['.astro', '.md', '.mdx', '.html']);

function walk(path: string, out: string[] = []): string[] {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (extensions.has(extname(full))) out.push(full);
  }
  return out;
}

const publicText = roots.flatMap((root) => walk(root)).map((file) => ({ file, text: readFileSync(file, 'utf8') }));

function matches(pattern: RegExp) {
  return publicText.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
}

describe('fiducia pubblica verificabile', () => {
  it.each([
    [/oltre\s+30[.,]?000\s*€/i, 'somma recuperata'],
    [/recensioni\s+verificate/i, 'recensioni verificate'],
    [/\b5[,.]0\b[^\n]{0,60}recension/i, 'valutazione recensioni'],
    [/\besempio\s+reale\b/i, 'esempio reale non documentato'],
    [/\b(più\s+scelto|bestseller|ultimi\s+posti)\b/i, 'scarsità o popolarità'],
  ])('rimuove %s', (pattern) => expect(matches(pattern as RegExp)).toEqual([]));
});
```

- [ ] **Step 2: Eseguire il test rosso**

Run: `npm test -- --run tests/content/public-trust-regressions.test.ts`  
Expected: FAIL su homepage, esempi, PWA e guide.

- [ ] **Step 3: Rimuovere cifre e recensioni non verificabili**

Eliminare interamente i blocchi homepage relativi a “oltre 30.000€” e “5,0 · recensioni verificate”. Non sostituirli con altri numeri. Usare metodologia, fonti, privacy e limiti come segnali di fiducia.

- [ ] **Step 4: Rinominare le dimostrazioni**

Usare “simulazione dimostrativa” nei titoli, descrizioni, link, pulsanti, share title e PWA. La descrizione SEO di `/esempio-report` deve essere:

```text
Simulazione dimostrativa del metodo Sherlock: documenti analizzati, clausole rilevanti, informazioni mancanti, punti da verificare e limiti dell'analisi.
```

- [ ] **Step 5: Verificare i test**

Run: `npm test -- --run tests/content/public-trust-regressions.test.ts tests/content/legal-regressions.test.ts`  
Expected: entrambi i file verdi.

- [ ] **Step 6: Commit**

```powershell
git add tests/content/public-trust-regressions.test.ts src/pages src/content public/app/index.html
git commit -m "fix: replace unverified public proof with transparency"
```

---

### Task 4: Noindex e rimozione dell'offerta legacy dalla navigazione

**Files:**
- Create: `tests/content/legacy-offer-visibility.test.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/abbonati.astro`
- Modify: `src/pages/abbonamento/[piano].astro`
- Modify: `src/pages/reclamo-singolo.astro`
- Modify: `astro.config.mjs`

**Interfaces:**
- Consumes: `PUBLIC_OFFER` e `isLegacyPublicRoute`.
- Produces: prop layout `noindex?: boolean`; sitemap priva di route legacy.

- [ ] **Step 1: Scrivere il test rosso di visibilità**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('offerta legacy non pubblica', () => {
  it('header e footer non collegano prezzi legacy', () => {
    const chrome = `${read('src/components/Header.astro')}\n${read('src/components/Footer.astro')}`;
    expect(chrome).not.toMatch(/href=["'{/]\/?abbonati/);
    expect(chrome).not.toContain('Pass Pro');
  });

  it.each(['src/pages/abbonati.astro', 'src/pages/abbonamento/[piano].astro', 'src/pages/reclamo-singolo.astro'])('%s usa noindex', (file) => {
    expect(read(file)).toMatch(/noindex=\{?true\}?/);
  });

  it('sitemap esclude le route legacy', () => {
    const config = read('astro.config.mjs');
    expect(config).toContain("!page.includes('/abbonati')");
    expect(config).toContain("!page.includes('/abbonamento')");
    expect(config).toContain("!page.includes('/reclamo-singolo')");
  });
});
```

- [ ] **Step 2: Eseguire il test rosso**

Run: `npm test -- --run tests/content/legacy-offer-visibility.test.ts`  
Expected: FAIL su navigazione, prop `noindex` e sitemap.

- [ ] **Step 3: Aggiungere la prop noindex al layout**

Nel frontmatter di `BaseLayout.astro` aggiungere:

```ts
interface Props {
  title: string;
  description: string;
  image?: string;
  canonical?: string;
  noindex?: boolean;
}

const { title, description, image, canonical, noindex = false } = Astro.props;
```

Nel `<head>` aggiungere:

```astro
{noindex && <meta name="robots" content="noindex, nofollow" />}
```

- [ ] **Step 4: Applicare noindex e rimuovere link legacy**

Passare `noindex={true}` dalle tre route legacy. In `Header.astro` sostituire “Offerte” con “Come funziona” verso `/#come-funziona` e “Pass Pro” con la CTA configurata verso `/app/`. In `Footer.astro` eliminare “Abbonamento” e usare “Fai il triage gratuito”.

- [ ] **Step 5: Escludere le route dalla sitemap**

Nel filtro sitemap aggiungere:

```js
!page.includes('/abbonati') &&
!page.includes('/abbonamento') &&
!page.includes('/reclamo-singolo') &&
```

- [ ] **Step 6: Verificare retrocompatibilità**

Run: `npm test -- --run tests/content/legacy-offer-visibility.test.ts tests/lib/public-offer.test.ts tests/lib/paypal-commercial.test.ts tests/api/play-billing-verify.test.ts`  
Expected: visibilità pubblica e flussi tecnici verdi.

- [ ] **Step 7: Commit**

```powershell
git add src/layouts/BaseLayout.astro src/components/Header.astro src/components/Footer.astro src/pages/index.astro src/pages/abbonati.astro src/pages/abbonamento/[piano].astro src/pages/reclamo-singolo.astro astro.config.mjs tests/content/legacy-offer-visibility.test.ts
git commit -m "feat: retire legacy offer from public discovery"
```

---

### Task 5: Coerenza privacy e trasparenza

**Files:**
- Create: `tests/content/privacy-transparency.test.ts`
- Modify: `src/pages/privacy.astro`
- Modify: `src/pages/trasparenza.astro`
- Modify: `src/lib/log.ts` solo se il test dimostra output non redatto.

**Interfaces:**
- Produces: dichiarazioni coerenti su pseudonimizzazione, provider, conservazione e cancellazione manuale.

- [ ] **Step 1: Scrivere il test rosso privacy**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const privacy = readFileSync('src/pages/privacy.astro', 'utf8');
const transparency = readFileSync('src/pages/trasparenza.astro', 'utf8');
const combined = `${privacy}\n${transparency}`;

describe('privacy coerente col comportamento', () => {
  it('non chiama anonimi eventi con identificatori persistenti', () => {
    expect(combined).not.toMatch(/eventi\s+anonimi/i);
    expect(combined).toContain('pseudonimizz');
  });

  it('non garantisce distruzione presso tutti i fornitori', () => {
    expect(combined).not.toMatch(/non viene inviato a nessun altro fornitore/i);
    expect(combined).not.toMatch(/distrutt[oi]\s+a\s+fine\s+richiesta\s*\(entro\s+30\s+secondi\)/i);
  });

  it('dichiara che cancellazione ed esportazione server richiedono supporto', () => {
    expect(combined).toContain('scaplab@sherlockpolizze.it');
    expect(combined).toMatch(/richiesta\s+di\s+cancellazione/i);
  });
});
```

- [ ] **Step 2: Eseguire il test rosso**

Run: `npm test -- --run tests/content/privacy-transparency.test.ts`  
Expected: FAIL su “eventi anonimi” e garanzie assolute di distruzione.

- [ ] **Step 3: Correggere identificatori e conservazione**

Usare “eventi pseudonimizzati” quando possono essere collegati a Firebase ID, client ID, device ID o IP hash. Distinguere:

```text
Sherlock non conserva il file in un archivio applicativo permanente. Il contenuto viene però trasmesso ai fornitori tecnici necessari all'elaborazione; tempi e log tecnici dei fornitori seguono le rispettive configurazioni e condizioni contrattuali.
```

Non dichiarare TLS 1.3, region Europa, DPA firmato o retention esatta se il repository non fornisce una configurazione verificabile; usare descrizioni prudenti e rinvio alle policy del fornitore.

- [ ] **Step 4: Allineare profilazione e remarketing**

Se il codice abilita Google Ads e remarketing previo consenso, eliminare la frase assoluta “non utilizziamo i tuoi dati per profilazione pubblicitaria” e sostituirla con:

```text
Non usiamo il contenuto dei documenti per pubblicità. Sul sito, previo consenso, Google Analytics e Google Ads possono trattare identificatori online per misurazione e remarketing secondo le preferenze espresse nel banner.
```

- [ ] **Step 5: Verificare test**

Run: `npm test -- --run tests/content/privacy-transparency.test.ts tests/lib/analytics-context.test.ts tests/lib/ga4-stream.test.ts`  
Expected: test contenuto e consenso verdi.

- [ ] **Step 6: Commit**

```powershell
git add src/pages/privacy.astro src/pages/trasparenza.astro src/lib/log.ts tests/content/privacy-transparency.test.ts
git commit -m "fix: align privacy copy with observed processing"
```

---

### Task 6: Dominio canonico e superfici SEO

**Files:**
- Create: `tests/content/public-domain-seo.test.ts`
- Modify: `astro.config.mjs`
- Modify: `public/robots.txt`
- Modify: file pubblici indicati dal test rosso.

**Interfaces:**
- Produces: canonical e destinazioni pubbliche sul dominio ufficiale; controlli preview ammessi.

- [ ] **Step 1: Scrivere il test rosso del dominio**

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const roots = ['src', 'public'];
const allowedTechnicalFiles = new Set(['src/layouts/BaseLayout.astro']);
const extensions = new Set(['.astro', '.md', '.html', '.xml', '.txt', '.json', '.js', '.ts']);

function files(path: string, out: string[] = []): string[] {
  for (const name of readdirSync(path)) {
    const full = join(path, name).replace(/\\/g, '/');
    const stat = statSync(full);
    if (stat.isDirectory()) files(full, out);
    else if (extensions.has(extname(full))) out.push(full);
  }
  return out;
}

describe('dominio pubblico canonico', () => {
  it('non espone destinazioni vercel.app', () => {
    const hits = roots.flatMap((root) => files(root)).filter((file) => {
      if (allowedTechnicalFiles.has(file)) return false;
      return /https?:\/\/[^\s"']+\.vercel\.app/i.test(readFileSync(file, 'utf8'));
    });
    expect(hits).toEqual([]);
  });

  it('configura il sito canonico ufficiale', () => {
    expect(readFileSync('astro.config.mjs', 'utf8')).toContain("site: 'https://www.sherlockpolizze.it'");
  });
});
```

- [ ] **Step 2: Eseguire il test rosso**

Run: `npm test -- --run tests/content/public-domain-seo.test.ts`  
Expected: eventuali URL pubblici provvisori elencati; i soli commenti tecnici del layout sono ammessi.

- [ ] **Step 3: Correggere destinazioni pubbliche**

Sostituire callback, canonical, Open Graph e URL email pubblici provvisori con `https://www.sherlockpolizze.it`. Non alterare commenti e condizioni che escludono preview `*.vercel.app` dagli analytics.

- [ ] **Step 4: Verificare sitemap e robots buildati**

Run: `npm run build`  
Expected: build riuscita.

Run: `Select-String -Path dist/client/sitemap-*.xml -Pattern 'vercel.app|/abbonati|/abbonamento/|/reclamo-singolo'`  
Expected: zero match.

- [ ] **Step 5: Commit**

```powershell
git add astro.config.mjs public/robots.txt src public tests/content/public-domain-seo.test.ts
git commit -m "fix: enforce canonical public domain and sitemap"
```

---

### Task 7: Audit e registri della Fase 1

**Files:**
- Create: `SITE_PUBLIC_AUDIT.md`
- Create: `PUBLIC_LEGAL_CONTENT_AUDIT.md`
- Create: `SEO_AUDIT.md`
- Create: `MANUAL_ACTIONS_REQUIRED.md`
- Modify: `PRIVACY_SECURITY_AUDIT.md`
- Modify: `MONETIZATION_CHANGES.md`
- Modify: `CODEX_IMPLEMENTATION_STATUS.md`
- Modify: `PENDING_TASKS.md`
- Modify: `TEST_RESULTS.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Produces: evidenza tracciabile di problemi, correzioni, residui e azioni manuali.

- [ ] **Step 1: Creare la matrice dell'audit pubblico**

Usare questa intestazione in `SITE_PUBLIC_AUDIT.md`:

```markdown
| Area | Problema iniziale | Gravità | Impatto commerciale | Correzione | File | Stato |
|---|---|---:|---|---|---|---|
```

Inserire una riga per art. 1892 PWA, art. 1913, clausole, IVASS/AAS, prove sociali, simulazioni, offerta legacy, privacy, dominio, sitemap e guide sospese. Stati consentiti: `corretto`, `sospeso`, `residuo`.

- [ ] **Step 2: Documentare l'audit legale pubblico**

In `PUBLIC_LEGAL_CONTENT_AUDIT.md` separare:

```markdown
## Corretto e verificato automaticamente
## Corretto ma da validare professionalmente
## Temporaneamente noindex
## Fonti ufficiali consultate
## Limiti della revisione
```

Non dichiarare una fonte verificata se non è stata effettivamente consultata.

- [ ] **Step 3: Documentare SEO e privacy**

`SEO_AUDIT.md` deve elencare route indicizzate, route `noindex`, esclusioni sitemap, canonical e residui. `PRIVACY_SECURITY_AUDIT.md` deve distinguere dichiarazioni corrette, controlli tecnici già presenti e feature applicative rinviate.

- [ ] **Step 4: Creare la checklist manuale unica**

`MANUAL_ACTIONS_REQUIRED.md` deve contenere soltanto azioni esterne indispensabili. Per la Fase 1 usare campi:

```markdown
| Priorità | Servizio | Percorso esatto | Valore/azione | Motivo | Rischio | Verifica |
|---|---|---|---|---|---|---|
```

Se non esistono azioni esterne prima del deploy, scrivere esplicitamente “Nessuna azione esterna necessaria prima del checkpoint di deploy”.

- [ ] **Step 5: Aggiornare registri esistenti con dati reali**

Riportare commit, test effettivamente eseguiti, pagine sospese e rischi residui. Non marcare come completati restyling, triage, nuovi prezzi, upload multiplo, checkout o retention.

- [ ] **Step 6: Commit**

```powershell
git add SITE_PUBLIC_AUDIT.md PUBLIC_LEGAL_CONTENT_AUDIT.md SEO_AUDIT.md MANUAL_ACTIONS_REQUIRED.md PRIVACY_SECURITY_AUDIT.md MONETIZATION_CHANGES.md CODEX_IMPLEMENTATION_STATUS.md PENDING_TASKS.md TEST_RESULTS.md DECISIONS.md
git commit -m "docs: complete public risk stabilization audit"
```

---

### Task 8: Verifica completa e checkpoint deploy

**Files:**
- Modify: `DEPLOYMENT_GUIDE.md`
- Modify: `ROLLBACK_GUIDE.md`
- Modify: `POST_DEPLOY_CHECKLIST.md`
- Modify: `TEST_RESULTS.md`

**Interfaces:**
- Produces: commit verificato e pronto al deploy, senza eseguire la pubblicazione.

- [ ] **Step 1: Verificare che Android sia immutato**

Run: `git diff 535dad7 -- android`  
Expected: output vuoto.

- [ ] **Step 2: Eseguire suite e controllo statico freschi**

Run: `npm test`  
Expected: tutti i test verdi.

Run: `npx astro check`  
Expected: 0 errori; hint non bloccanti documentati.

- [ ] **Step 3: Eseguire build ed E2E**

Run: `npm run build`  
Expected: build Vercel riuscita, sitemap generata.

Run: `npm run test:e2e`  
Expected: test PWA verdi sui quattro viewport configurati.

- [ ] **Step 4: Verificare output pubblico**

Run: `Select-String -Path dist/client/sitemap-*.xml -Pattern 'vercel.app|/abbonati|/abbonamento/|/reclamo-singolo'`  
Expected: zero match.

Run: `git diff --check`  
Expected: exit 0.

Run: `git status --short`  
Expected: soltanto i documenti di verifica modificati nello step successivo.

- [ ] **Step 5: Aggiornare guide di deploy e rollback**

Documentare esattamente il commit candidato, il deployment stabile precedente `dpl_6HgY1nrwNwG1Sy8wdHQKHvXzPwW2`, smoke test su `/`, `/app/`, `/privacy`, `/trasparenza`, `/esempio-report`, verifica `noindex` sulle route legacy e rollback tramite deployment stabile o `git revert` selettivo.

- [ ] **Step 6: Registrare risultati finali**

Aggiornare `TEST_RESULTS.md` soltanto con exit code, conteggi e warning osservati nell'esecuzione fresca.

- [ ] **Step 7: Commit del checkpoint**

```powershell
git add DEPLOYMENT_GUIDE.md ROLLBACK_GUIDE.md POST_DEPLOY_CHECKLIST.md TEST_RESULTS.md
git commit -m "docs: prepare public stabilization deployment checkpoint"
```

- [ ] **Step 8: Fermarsi prima del deploy**

Consegnare commit, test, rischi residui, azioni manuali e istruzioni di rollback. Non eseguire deploy di produzione senza il checkpoint umano richiesto dalla specifica.
