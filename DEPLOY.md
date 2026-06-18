# Deploy del sito su Vercel — guida click-by-click

> Il sito è già pronto in `C:\Users\Stefano\sherlock-site\`. Compilato, testato, committato in git. Manca solo metterlo online. Tempo stimato: **15-20 minuti** seguendo questa guida.

## Cosa succederà in totale

1. Crei (o usi) un account **GitHub** → carichi il sito lì
2. Crei (o usi) un account **Vercel** → colleghi GitHub → click su Deploy
3. Vercel ti dà un URL temporaneo tipo `sherlock-polizze.vercel.app` → il sito è online
4. (Opzionale ma raccomandato) Compri un dominio tipo `sherlock-polizze.it` (10€/anno) → lo colleghi a Vercel

---

## Step 1 — Crea repository su GitHub (5 minuti)

### 1.1 Vai su GitHub

Apri il browser su: **https://github.com**

Se hai già un account: fai login.
Se no: click "Sign up" in alto a destra, segui il flusso (chiede email, password, username).

### 1.2 Crea un nuovo repository

Una volta loggato, in alto a destra c'è un **+** → click → **New repository**.

Compila così:

| Campo | Valore |
|---|---|
| Repository name | `sherlock-polizze-site` |
| Description (opzionale) | `Sito web di Sherlock — analisi AI delle polizze` |
| Public/Private | **Private** (consigliato: nessuno vede il codice) |
| Initialize with README | **NO** (deselezionato, abbiamo già tutto) |
| .gitignore | **None** (abbiamo già il nostro) |
| License | **None** |

Click **"Create repository"**.

### 1.3 Carica il sito su GitHub

GitHub ti mostra una pagina con istruzioni. **NON seguire le loro** — segui queste:

Apri il **terminale** (cerca "PowerShell" nel menu Start, apri):

```powershell
cd C:\Users\Stefano\sherlock-site
git remote add origin https://github.com/TUO-USERNAME/sherlock-polizze-site.git
git push -u origin main
```

> ⚠️ Sostituisci `TUO-USERNAME` con il tuo username GitHub vero (es. `stscapigliati`).

Al primo push, GitHub potrebbe aprire una finestra per **autenticarti via browser**. Approva. Se invece chiede password: NON funziona più via password — devi usare un Personal Access Token. In quel caso:

- Vai su https://github.com/settings/tokens/new
- Note: `sherlock site deploy`
- Expiration: `No expiration`
- Scopes: spunta **"repo"** (intera sezione)
- Click "Generate token" in fondo
- Copia il token (inizia con `ghp_...`)
- Quando il terminale chiede password, **incolla il token** (non vedrai caratteri, è normale)

Ricarica la pagina GitHub del repository: dovresti vedere tutti i file caricati.

---

## Step 2 — Deploy su Vercel (5 minuti)

### 2.1 Account Vercel

Apri: **https://vercel.com/signup**

Click **"Continue with GitHub"** → autorizza Vercel a leggere i tuoi repository. È il modo più semplice.

### 2.2 Importa il progetto

Dopo il login arrivi sulla dashboard. Click **"Add New..."** → **"Project"**.

Vercel ti mostra l'elenco dei tuoi repository GitHub. Trova **`sherlock-polizze-site`** → click **"Import"**.

### 2.3 Configurazione del deploy

Vercel dovrebbe **riconoscere automaticamente** che è un progetto Astro. Vedrai:

- **Framework Preset:** `Astro` (auto-rilevato)
- **Build Command:** `npm run build` (auto)
- **Output Directory:** `dist` (auto)
- **Root Directory:** `./` (auto)

**Non toccare nulla.** Click **"Deploy"** in fondo.

### 2.4 Attendi

Vercel impiega 1-2 minuti per:
- Clonare il repo
- Installare dipendenze (`npm install`)
- Buildare (`npm run build`)
- Pubblicare

Quando finisce vedi una bella schermata con confetti e un pulsante **"Continue to Dashboard"**.

### 2.5 Il sito è online

URL tipo: **`https://sherlock-polizze-site.vercel.app`**

Apri quel link. Dovresti vedere il sito IDENTICO a quello che hai visto nel test locale. Articoli SEO funzionanti.

---

## Step 3 — Sostituisci il vecchio sito Manus

A questo punto hai **due siti vivi**: il vecchio Manus + il nuovo Vercel. Decidiamo come gestire la transizione.

### Opzione A — Dominio personalizzato (raccomandato)

Acquisti **`sherlock-polizze.it`** (~10€/anno) e lo punti al nuovo Vercel. URL pulito e brandizzato.

**Dove comprare il dominio:**

- **Cloudflare Registrar** (consigliato, costo "at cost" ≈ 9€/anno per `.it`): https://dash.cloudflare.com/?to=/:account/registrar/register
- **Namecheap** (~12€/anno): https://www.namecheap.com
- **Aruba** (~7€/anno il primo anno, poi 20€): https://www.aruba.it

Procedura indicativa:
1. Compra il dominio (15 minuti, attivazione in 1-24h)
2. Su Vercel: progetto → **Settings** → **Domains** → aggiungi `sherlock-polizze.it`
3. Vercel ti dà i record DNS da configurare (di solito un `A` + `CNAME` `www`)
4. Vai sul pannello del registrar e inserisci quei record
5. Aspetti propagazione DNS (15min – 24h)
6. Sito accessibile da `https://sherlock-polizze.it`

### Opzione B — Restare sul subdomain Vercel (gratis, ok)

Tieni `sherlock-polizze-site.vercel.app` come URL principale.

Vantaggi: zero costo, zero attesa DNS.
Svantaggi: URL meno brandizzato, dipendenza più stretta da Vercel.

### Opzione C — Tenere Manus + sito Vercel come "guide" (sconsigliato)

Sconsiglio: avresti due siti che competono per le stesse keyword. Confonde Google.

---

## Step 4 — Aggiorna i link nel Play Console

Una volta che hai il nuovo URL definitivo (Vercel o dominio custom), devi aggiornarlo nel listing Play Store. Altrimenti chi clicca da Play Store arriva al vecchio Manus.

Apri Play Console: https://play.google.com/console/u/0/developers/8257021962405195668/app/4972397490457235048/app-dashboard

`Crescita → Presenza nello Store → Configurazione principale → Dettagli contatto → Sito web`

Sostituisci `https://sherlockapi-rwygcyfs.manus.space` con il nuovo URL.

Aggiorna anche **Privacy policy URL** se la nuova è in `/privacy` del nuovo sito.

---

## Step 5 — Aggiorna i link in bio Instagram / TikTok / link share

Cerca ovunque hai messo il vecchio URL Manus e sostituiscilo. Almeno:

- Bio Instagram
- Bio TikTok
- Eventuali post fissati con link
- Eventuali email firmate

---

## Step 6 — (Opzionale) Redirect del vecchio sito Manus

Se vuoi che chi arriva al vecchio sito Manus venga reindirizzato al nuovo, puoi farlo via prompt all'AI di Manus:

> "Per ogni URL del sito, aggiungi un redirect 301 verso lo stesso path su https://sherlock-polizze.it. Esempio: /abbonati → https://sherlock-polizze.it/abbonati."

Manus probabilmente non supporta redirect lato server (è una SPA). In tal caso, alternativa: pubblicare un blocco JavaScript che redirige dopo il load. Meno SEO-friendly ma funziona.

---

## Step 7 — Backend AI (env vars su Vercel)

Il sito ora ospita anche le API che l'app Android chiama per analisi e generazione lettere (`/api/analizza`, `/api/lettera`). Senza le variabili d'ambiente impostate su Vercel, le chiamate restituiscono `500 Backend non configurato`.

### Variabili da impostare

Vai su **Vercel → progetto sherlock-polizze-site → Settings → Environment Variables** e aggiungi:

| Nome | Valore | Obbligatoria |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-…` (la tua chiave Anthropic) | ✅ sì |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` (default) o `claude-opus-4-8` per qualità massima | no |
| `PRO_CODES` | Lista codici Pro validi separati da virgola | no (se vuoto: dev mode) |

Per ognuna seleziona environment: **Production, Preview, Development**.

### Codici Pro iniziali

Hai 10 codici validi pronti all'uso. Mettili nella env var `PRO_CODES` esattamente così (una sola stringa, virgole, senza spazi):

```
SHK-EAH2-KY3D,SHK-ICOY-GU0E,SHK-U881-QQKF,SHK-IHLF-20SC,SHK-TDA4-60MF,SHK-BZF2-IUGE,SHK-J0QD-FBWB,SHK-1SQG-H9IC,SHK-YZPH-S25G,SHK-92C3-G2OA
```

Per generarne altri:

```powershell
cd C:\Users\Stefano\sherlock-site
node scripts/genera-codici.mjs 20
```

**Importante**: se `PRO_CODES` è vuoto, il backend accetta qualsiasi codice con checksum valido (modalità dev/test, insicuro per produzione). Lascialo vuoto solo per test locali.

### Dopo aver salvato le env vars

Vercel **non ridepoya automaticamente** dopo aver aggiunto env vars. Vai su **Deployments → ultimo deploy → ⋯ → Redeploy** per applicarle.

### Verifica che funzioni

Apri questo URL nel browser (sostituisci con il tuo dominio):

```
https://sherlock-polizze-site-b46pfkwts-sstefano-s-projects.vercel.app/api/analizza
```

- Se risponde con un errore JSON tipo `{"error":"Body JSON non valido"}` → ✅ backend attivo, env var ok
- Se risponde `{"error":"Backend non configurato (ANTHROPIC_API_KEY mancante)"}` → manca env var
- Se 404 → ricontrolla che il deploy sia avvenuto dopo aver installato `@astrojs/vercel` e modificato `astro.config.mjs`

---

## Step 8 — Flusso PayPal (sostituisce manus.space)

Il sito ora gestisce direttamente il pagamento degli abbonamenti via PayPal REST API. Il vecchio backend `manus.space` non serve più una volta che questo è attivo.

### Pagine

| URL | Cosa fa |
|---|---|
| `/abbonati` | Pricing page (era già lì) — ora linka ai piani interni |
| `/abbonamento/mensile` | Form email + pulsante "Paga con PayPal 2,99€" |
| `/abbonamento/semestrale` | idem 7,99€ |
| `/abbonamento/annuale` | idem 14,99€ |
| `/abbonamento/conferma` | Pagina post-pagamento: cattura ordine, mostra codice Pro |

### Endpoint API

| Metodo | URL | Cosa fa |
|---|---|---|
| `POST` | `/api/paypal/create-order` | Body `{piano, email}` → crea ordine PayPal, ritorna `{orderId, approveUrl}` |
| `POST` | `/api/paypal/capture-order` | Body `{orderId}` → cattura pagamento, genera codice SHK-XXXX-XXXX, salva in KV, invia mail |

### Env vars necessarie su Vercel

| Nome | Da dove | Obbligatoria |
|---|---|---|
| `PAYPAL_CLIENT_ID` | developer.paypal.com → My Apps & Credentials → Live | ✅ sì |
| `PAYPAL_SECRET` | stessa pagina (mostra il Secret) | ✅ sì |
| `PAYPAL_MODE` | `live` (default) o `sandbox` per test | no |
| `RESEND_API_KEY` | resend.com → API Keys (gratis 100 mail/giorno) | ✅ sì (per inviare codice) |
| `MAIL_FROM` | es. `Sherlock <noreply@sherlock-polizze.it>` (dominio da verificare su Resend) | no |
| `MAIL_REPLY_TO` | `stefano.scapigliati@gmail.com` (default) | no |

### Vercel KV (storage codici emessi)

Senza KV, i codici emessi tramite pagamento PayPal vengono salvati solo **in memoria** della singola invocazione serverless → al successivo deploy/cold-start sono persi (l'utente avrà un codice valido per checksum ma il backend potrebbe rifiutarlo per la lettera Pro). 

**Per produzione configura Vercel KV**:

1. Vai su Vercel → progetto → **Storage** → **Create Database**
2. Scegli **KV** (Redis)
3. Nome: `sherlock-codici-pro`
4. Region: `Frankfurt fra1` (più vicino all'Italia)
5. Plan: **Hobby** (gratis, 256MB)
6. Click **Continue** → **Connect to Project** → seleziona `sherlock-polizze-site`
7. Vercel inietta automaticamente `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`

Dopo il setup, **redeploya** (Settings → Deployments → Redeploy) per applicare.

### Test end-to-end (modalità sandbox)

1. Su PayPal Developer Dashboard: crea un'app **Sandbox** (separata dalla Live)
2. Su Vercel imposta `PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID` e `PAYPAL_SECRET` con le credenziali sandbox
3. Su Resend usa il mittente di test `onboarding@resend.dev`
4. Vai su `https://<tuo-vercel>/abbonamento/mensile`
5. Compila email, paga con un account PayPal sandbox (creato in developer.paypal.com → Sandbox → Accounts)
6. Dovresti tornare su `/abbonamento/conferma` con il codice mostrato + email ricevuta

Quando confermi che tutto funziona, passa `PAYPAL_MODE=live` con le credenziali live.

### Aggiornare il listing Play Console e bio social

Quando il flow PayPal nuovo funziona, sostituisci ovunque `https://sherlockapi-rwygcyfs.manus.space` con `https://<tuo-vercel>` (vedi Step 4 e 5).

Poi puoi **spegnere il vecchio backend manus.space**.

---

## Come fare aggiornamenti futuri al sito

Ogni volta che vuoi cambiare qualcosa (es. pubblicare un nuovo articolo):

```powershell
cd C:\Users\Stefano\sherlock-site
# Fai le modifiche (vedi sotto)
git add .
git commit -m "Aggiunto articolo X"
git push
```

**Vercel deploya automaticamente** in 30-60 secondi. Niente upload manuale.

### Pubblicare un nuovo articolo

1. Crea un file `.md` in `src/content/guide/` (es. `polizza-casa.md`)
2. Frontmatter:
   ```yaml
   ---
   title: "Titolo lungo SEO"
   slug: polizza-casa
   description: "Meta description 155 chars"
   author: Stefano Scapigliati
   date: 2026-07-01
   keywords: keyword1, keyword2
   ---
   ```
3. Scrivi l'articolo in Markdown
4. `git push` → online in 1 minuto

### Modificare la home / abbonati / pricing

Modifichi i file `.astro` in `src/pages/`. Idem: `git push` deploya.

---

## Cosa fare se qualcosa non funziona

| Problema | Soluzione |
|----------|-----------|
| `git push` fallisce con "permission denied" | Vedi sezione token GitHub sopra |
| Vercel build fallisce | Vai su Vercel → progetto → Deployments → click sul deploy fallito → leggi log |
| Il sito si vede in test locale ma non su Vercel | Controlla che `astro.config.mjs` abbia `site: 'https://...'` corretto |
| Le immagini non si vedono | Verifica che siano in `public/` e referenziate come `/og-cover.png` (senza `public/`) |
| Cambi non si vedono dopo push | Aspetta 30-60s, poi forza refresh browser con Ctrl+F5 |

---

## Pulizia del vecchio progetto Manus

**NON cancellare il sito Manus subito.** Tienilo attivo per 30 giorni in parallelo, finché:
- Google ha re-indicizzato il nuovo sito
- Hai aggiornato tutti i link esterni
- Hai verificato che il nuovo sito non abbia bug

Dopo 30 giorni puoi mettere il vecchio sito offline o lasciar scadere i crediti Manus.

---

## Riepilogo: il sito che hai ora

| Elemento | Stato |
|---|---|
| Home con hero + features | ✅ |
| Pagina /abbonati con 3 piani + FAQ | ✅ |
| Pagina /privacy GDPR | ✅ |
| Pagina /guide (index articoli) | ✅ |
| 5 articoli SEO completi (2.500 parole ognuno) | ✅ |
| Meta tag SEO completi (OG, Twitter, canonical) | ✅ |
| JSON-LD: WebSite, Article, FAQPage, Product | ✅ |
| robots.txt | ✅ |
| sitemap.xml auto-generato | ✅ |
| assetlinks.json per deep link Android | ✅ |
| Smart App Banner Chrome Android | ✅ |
| OG image, feature graphic, icon | ✅ |
| Build statica = velocità massima | ✅ |
| Tailwind + design coerente | ✅ |

**Quello che NON c'è ancora ma puoi aggiungere dopo:**
- Form di iscrizione newsletter (richiede integrazione con Brevo/Mailchimp)
- Modulo PDF da scaricare nelle landing degli articoli (ora linkano `#` placeholder)
- Form di contatto
- Analytics (Google Analytics o Plausible)
- Cookie banner (necessario se aggiungi GA)

Quando vuoi una di queste cose riapri Claude Code in questa cartella, le aggiungo.
