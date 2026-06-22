# 🎯 Runbook Stefano — cosa fare adesso, in ordine

**Data**: 2026-06-22
**Tempo totale stimato**: ~90 minuti, ma puoi spezzarlo in 3 sessioni da 30 min.

## Cosa ho fatto io (già live o pronto)

✅ Sito riposizionato live: https://sherlock-polizze-site-five.vercel.app/ (nuova H1, /trasparenza, /esempio-report, /esempio-lettera, 3 nuove guide SEO, disclaimer DMA su /abbonati)
✅ Scaffold Firebase Analytics nel sito (si attiva quando incolli le env vars)
✅ App **v3.7 / vc47** buildata con dentro tutte le `track()` calls e il bump APP_BUILD per resettare freeUsed agli utenti che aggiornano
   → File: `C:\Users\Stefano\Downloads\Sherlock-v3.7-vc47.aab` (firma release verificata con jarsigner)
✅ 8 screenshot mockup pronti per export: https://sherlock-polizze-site-five.vercel.app/store-mockups.html
✅ Copy listing in IT + release notes in 6 lingue: `docs/strategy/store-listing-copy.md`

---

## SESSIONE 1 — Play Console (30 min)

### Step 1.1 — Caricare la v3.7

1. Apri https://play.google.com/console → app **Sherlock — Detective Polizze**.
2. Menu sinistra → **Produzione** (Production) → **Crea nuova release**.
3. Carica il file: `C:\Users\Stefano\Downloads\Sherlock-v3.7-vc47.aab`.
4. **Note di rilascio**: copia il testo IT da `docs/strategy/store-listing-copy.md` sezione "Note di rilascio (versione 3.7)". Stesso passo per EN, ES, FR, ZH, MY (testi pronti nello stesso file).
5. Lascia in DRAFT, non pubblicare ancora.

### Step 1.2 — Restringere i paesi (Fase A Play Billing)

1. Sempre in Produzione → **Paesi/regioni** (Countries/regions).
2. Seleziona **solo EU/SEE + UK + Svizzera**: Italia, Francia, Germania, Spagna, Belgio, Olanda, Austria, Polonia, Romania, Portogallo, Grecia, Svezia, Danimarca, Finlandia, Norvegia, Islanda, Irlanda, Lussemburgo, Repubblica Ceca, Slovacchia, Ungheria, Slovenia, Croazia, Bulgaria, Estonia, Lettonia, Lituania, Malta, Cipro, Liechtenstein, **Svizzera**, **Regno Unito**.
3. Deseleziona tutto il resto (Brasile, Myanmar, Etiopia, US, ecc.). Riduce il rischio Play Billing a praticamente zero per i prossimi 6-12 mesi.

### Step 1.3 — Aggiornare la scheda store

1. Menu sinistra → **Crescita** → **Presenza nello store** → **Scheda principale dello store**.
2. **Nome app**: cambia in `Sherlock Polizze: Reclami AI` (29 caratteri, vedi store-listing-copy.md per dettagli).
3. **Descrizione breve** (IT): copia da store-listing-copy.md sezione "Short description — Proposta principale".
4. **Descrizione completa** (IT): copia da store-listing-copy.md sezione "Long description".
5. **Screenshot** (5 immagini, 1080×1920 PNG): vedi Step 1.4 sotto.
6. **Tag/categoria**: Finance, tag suggeriti: polizze, reclami, IVASS, assicurazione, PEC.
7. **Ripeti per le altre 5 lingue** se hai la scheda multilingua (puoi anche solo IT per ora — l'app è già multilingua, la scheda EN puoi farla in seconda battuta).

### Step 1.4 — Esportare i 5 screenshot

1. Apri Chrome (NON Edge — il device mode di Chrome è più stabile per gli export).
2. Apri https://sherlock-polizze-site-five.vercel.app/store-mockups.html
3. Apri DevTools (F12) → click sull'icona "Toggle device toolbar" (Ctrl+Shift+M, è quella tra ESC e l'icona ⋮ in alto a sinistra).
4. Sulla toolbar device che appare, cambia "Responsive" e imposta:
   - Width: `540`
   - Height: `960`
   - DPR (Device Pixel Ratio): `2.0` (cliccando sull'icona DPR / "2x")
5. Scorri fino al **Frame 1 — Hero**. Sulla toolbar device, click sul menu ⋮ (in alto, vicino al DPR) → "Capture screenshot". Salva come `sherlock-screen-1-hero.png`.
6. Scorri al **Frame 6 — Annuncio v3.7: 6 lingue**. Capture → `sherlock-screen-2-multilingua.png`. **Questo è il tuo asset più importante per la v3.7** — il fatto di averlo come Frame 2 (= primo visibile dopo l'hero nello store) è la mossa chiave.
7. Scorri al **Frame 7 — AI parla la tua lingua**. Capture → `sherlock-screen-3-ai-multilang.png`.
8. Scorri al **Frame 3 — Reclamo IVASS generato**. Capture → `sherlock-screen-4-reclamo.png`.
9. Scorri al **Frame 5 — Privacy**. Capture → `sherlock-screen-5-privacy.png`.
10. Verifica che ogni PNG sia 1080×1920 (proprietà del file su Windows).
11. Carica i 5 PNG in Play Console → Scheda store → Screenshot (drag & drop nell'ordine sopra).

### Step 1.5 — Salvare e pubblicare

1. Anteprima → controlla che tutto sia ok (titolo, screenshot, description).
2. Pubblica.
3. **Note**: il rollout Play Console a volte richiede review breve (1-3 giorni) per i cambi grandi (nome app cambiato). Aspettatelo.

---

## SESSIONE 2 — Firebase Console (15 min)

### Step 2.1 — Registra app Web

1. https://console.firebase.google.com/u/0/project/sherlock-6f88c/overview
2. Sulla pagina overview, vedrai un'icona `</>` (Add app → Web). Click.
3. Nickname: `Sherlock Site`. NON spuntare "Hosting".
4. Click "Register app".
5. **Copia tutto il config object** che Firebase ti mostra (le 7 chiavi `apiKey`, `authDomain`, ecc.).
6. "Continue to console".

### Step 2.2 — Incolla env vars su Vercel

1. https://vercel.com/sstefano-s-projects/sherlock-polizze-site/settings/environment-variables
2. Aggiungi 7 variabili (clicca "Add another" 7 volte). Per ognuna:
   - **Name**: `PUBLIC_FIREBASE_API_KEY` → **Value**: il valore di `apiKey` dal config Firebase
   - Stessa cosa per `PUBLIC_FIREBASE_AUTH_DOMAIN`, `PUBLIC_FIREBASE_PROJECT_ID`, `PUBLIC_FIREBASE_STORAGE_BUCKET`, `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `PUBLIC_FIREBASE_APP_ID`, `PUBLIC_FIREBASE_MEASUREMENT_ID`.
3. Environment: spunta **Production + Preview + Development** per tutte e 7.
4. Salva. Vercel triggera un deploy automatico (1-2 min).

### Step 2.3 — Verifica analytics sito attivo

1. Aspetta 2 min che il deploy finisca.
2. Apri https://sherlock-polizze-site-five.vercel.app/ in incognito.
3. Apri Firebase Console → menu sinistra **Analytics** → **Realtime**.
4. Entro 30 secondi vedi te stesso comparire come utente attivo.
5. Naviga a `/abbonati` sul sito → l'evento `paywall_view_intent` dovrebbe arrivare in Realtime.
6. ✅ Sito tracking attivo.

### Step 2.4 — Registra app Android (per analytics dell'app)

> ⚠️ **Step opzionale per ora**: l'app v3.7 ha già le `track()` calls JS inserite, ma sono no-op finché non aggiungi il bridge Java + `google-services.json`. Puoi farlo dopo, in un nuovo `.aab` v3.8.

1. Firebase Console → stesso project → click sull'icona Android (Add app → Android).
2. Package: `it.sherlock.polizze` (esattamente questo).
3. Nickname: `Sherlock Android`.
4. SHA-1: salta.
5. Click "Register app".
6. **Scarica `google-services.json`** → salva in: `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_patched\sherlock_project\app\google-services.json`.
7. Per attivare effettivamente l'analytics dell'app, applica le patch Java dal file `docs/strategy/firebase-analytics-setup.md` (Patch 2.1, 2.2, 2.3). Poi rebuild `.aab` v3.8 e ricarica su Play Console.

**Questo step lo puoi rimandare** alla prossima sessione di lavoro app. L'analytics web è già abbastanza per misurare il funnel marketing.

---

## SESSIONE 3 — Verifica e A/B test (15 min, fai dopo 1 settimana dalla pubblicazione)

Una settimana dopo aver pubblicato la v3.7:

### Step 3.1 — Controlla metriche Play Console

1. Play Console → Analytics → Installazioni e disinstallazioni.
2. Confronta installazioni IT prima/dopo il cambio store listing.
3. Se installazioni IT crescono > 30%: il nuovo copy funziona.

### Step 3.2 — Controlla funnel Firebase

1. Firebase Console → Analytics → Dashboard → Events.
2. Eventi che dovresti vedere se tutto funziona:
   - `page_view` (decine al giorno)
   - `play_store_click` (entry funnel)
   - `paywall_view_intent` (utenti che cliccano "Abbonati")
   - `subscribe_plan_click` (utenti che scelgono un piano)
3. Calcola conversioni:
   - `paywall_view_intent / page_view` (tasso interesse) — sano > 5%
   - `subscribe_plan_click / paywall_view_intent` (tasso decisione) — sano > 10%

### Step 3.3 — Avvia primo Store Listing Experiment

1. Play Console → Crescita → **Esperimenti scheda dello store**.
2. Crea esperimento → varia **Short description**:
   - Variante A: testo attuale (controllo)
   - Variante B: variante "principale" dal file `store-listing-copy.md`
3. Audience: 50/50, Italia.
4. Lascia girare ≥ 14 giorni o 100 installazioni per variante.
5. Metrica primaria: **Install rate**.
6. Adotta la vincitrice.

---

## RIASSUNTO ULTRA-COMPATTO

Se non hai tempo di leggere tutto, fai così — in quest'ordine:

1. ☐ Carica `Sherlock-v3.7-vc47.aab` su Play Console come nuova release. _(5 min)_
2. ☐ Cambia paesi a solo EU+UK+CH. _(5 min)_
3. ☐ Cambia nome app + descrizione + screenshot (esporta dai mockup). _(20 min)_
4. ☐ Pubblica. _(2 min)_
5. ☐ Firebase: registra app Web, copia 7 env vars su Vercel. _(15 min)_
6. ☐ Aspetta 1 settimana. Controlla numeri. _(— )_
7. ☐ Lancia A/B test short description. _(5 min)_

Il resto (Firebase Android app + Patch Java + .aab v3.8) lo fai quando vuoi.

---

## File di riferimento

| File | Cosa contiene |
|------|---------------|
| `docs/strategy/2026-06-22-play-billing-audit.md` | Analisi rischio Play Billing + perché non migrare ora |
| `docs/strategy/store-listing-copy.md` | Copy nuovo titolo/short/long + release notes 6 lingue + strategia A/B |
| `docs/strategy/firebase-analytics-setup.md` | Setup Firebase completo: console + Vercel env + patch app + lista eventi |
| `public/store-mockups.html` (live su https://sherlock-polizze-site-five.vercel.app/store-mockups.html) | 8 mockup screenshot Play Store, esportabili 1080×1920 via Chrome DevTools |
| `C:\Users\Stefano\Downloads\Sherlock-v3.7-vc47.aab` | Build firmata release pronta da caricare |
| `C:\Users\Stefano\Downloads\Sherlock app final\sherlock_project_v3.7_*.zip` | Backup completo del progetto post-modifica |

Buon lavoro 🔍
