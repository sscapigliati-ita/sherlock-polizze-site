# Play Console — Data Safety: risposte campo per campo

**Quando**: aggiornare PRIMA della pubblicazione v3.9 (la versione con Firebase nativo cambia il profilo di trattamento dati — l'app ora raccoglie analytics, prima no).

**Dove**: Play Console → la tua app → menu sinistra **Crescita** (Grow) → **Schede del Play Store** → **Sicurezza dei dati** (Data safety). Oppure direttamente: `App content → Data safety`.

**Tempo**: 25 minuti.

---

## Sezione 1 — "Data collection and security" (Domande iniziali)

Compila come segue:

| Domanda | Risposta |
|---------|----------|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Do you provide a way for users to request that their data be deleted? | **Yes** |
| Have you committed to follow the Google Play Families Policy? | **No** (non è app per famiglie) |
| Has your app been independently validated against a global security standard? | **No** (a meno che tu non abbia certificazioni ISO/SOC2) |

---

## Sezione 2 — "Data types" (per ogni tipo: collected? shared? purpose?)

Per ogni dato sotto, devi cliccare la categoria, attivare il toggle "Collected", "Shared" se condiviso con terzi, e poi selezionare i Purpose (puoi sceglierne più di uno). Sotto trovi la mappatura esatta dei 6 punti che mi hai dato.

### 2.1 — Personal info → Email address

- **Collected**: ✅ Yes
- **Shared**: ✅ Yes
- **Optional or required**: **Optional** (l'utente può usare la prima analisi gratis senza fornire email)
- **Purpose** (spunta tutti i pertinenti):
  - ✅ App functionality
  - ✅ Account management
- **Why shared**:
  - 📩 **Resend** (per inviare il codice Pro via email)
  - 💳 **PayPal** (in fase di checkout pagamento, PayPal vede l'email del pagatore)
- **Encrypted in transit**: Yes
- **Users can request deletion**: Yes (via email a `stefano.scapigliati@gmail.com`)

### 2.2 — Personal info → User IDs

- **Collected**: ✅ Yes (Firebase Analytics genera un App Instance ID pseudonimizzato + ANDROID_ID via Settings.Secure)
- **Shared**: ✅ Yes (con Google/Firebase per analytics)
- **Optional or required**: Required (necessario per analytics — l'utente non ha controllo granulare)
- **Purpose**:
  - ✅ Analytics
  - ✅ App functionality (per identificare device-level Pro status)
- **Why shared**: Google Firebase Analytics
- **Encrypted in transit**: Yes
- **Users can request deletion**: Yes (Firebase Console permette opt-out + cancellazione)

### 2.3 — Financial info → Purchase history

- **Collected**: ✅ Yes (metadati ordine PayPal: orderId, piano scelto, importo, data — NIENTE numero carta)
- **Shared**: ✅ Yes
- **Optional or required**: Optional (solo se l'utente sceglie di abbonarsi a Pro)
- **Purpose**:
  - ✅ App functionality (validare il codice Pro generato)
  - ✅ Account management
- **Why shared**:
  - 💳 PayPal (è la fonte dei dati)
  - 💾 Upstash Redis (storage Vercel — i codici Pro sono memorizzati lì)
- **Encrypted in transit**: Yes
- **Users can request deletion**: Yes

> ⚠️ **NON dichiarare** "User payment info" — quella categoria si riferisce a dati carta/IBAN, che tu non vedi mai (li gestisce direttamente PayPal sul loro dominio).

### 2.4 — Files and docs

- **Collected**: ✅ Yes (i PDF/foto delle polizze caricate dall'utente)
- **Shared**: ✅ Yes
- **Optional or required**: Required (è il core dell'app)
- **Purpose**:
  - ✅ App functionality (analizzare la polizza)
- **Why shared**: Anthropic (Claude API per l'analisi AI)
- **Encrypted in transit**: Yes (HTTPS/TLS 1.3)
- **Users can request deletion**: Yes — nota: i file NON vengono mai persistiti, vengono distrutti a fine richiesta serverless. Ma il form richiede comunque il flag "Yes" sulla cancellazione: marcalo Yes e spiega in description "Data is not stored, processed in-memory only".

### 2.5 — App activity → App interactions

- **Collected**: ✅ Yes (eventi Firebase Analytics: app_open, analysis_completed, paywall_viewed, ecc.)
- **Shared**: ✅ Yes
- **Optional or required**: Required (analytics built-in)
- **Purpose**:
  - ✅ Analytics
- **Why shared**: Google Firebase Analytics
- **Encrypted in transit**: Yes
- **Users can request deletion**: Yes

### 2.6 — App info and performance → Crash logs

- **Collected**: ✅ Yes (Firebase Analytics raccoglie automaticamente crash + ANR)
- **Shared**: ✅ Yes
- **Optional or required**: Required
- **Purpose**:
  - ✅ Analytics
  - ✅ App functionality (debug e fix)
- **Why shared**: Google Firebase
- **Encrypted in transit**: Yes
- **Users can request deletion**: Yes

### 2.7 — App info and performance → Diagnostics

- **Collected**: ✅ Yes (device model, OS version, etc — automatico Firebase + opzionale lato backend nei log applicativi)
- **Shared**: ✅ Yes
- **Optional or required**: Required
- **Purpose**:
  - ✅ Analytics
  - ✅ App functionality
- **Why shared**: Google Firebase
- **Encrypted in transit**: Yes
- **Users can request deletion**: Yes

### 2.8 — Device or other IDs

- **Collected**: ✅ Yes (`ANDROID_ID` recuperato dal bridge `Android.getDeviceId()` — usato in `MainActivity.java`)
- **Shared**: ❌ No (lo usiamo solo lato client, non lo inviamo a terzi)
- **Optional or required**: Required
- **Purpose**:
  - ✅ App functionality (identificare il device per anti-frode codici Pro)
  - ✅ Fraud prevention
- **Encrypted in transit**: Yes
- **Users can request deletion**: Yes (cancellando l'app)

---

## Sezione 3 — DATI da NON dichiarare

| Categoria | Perché NON la dichiari |
|-----------|----------------------|
| ❌ Personal info → Name | Non lo richiedi all'utente |
| ❌ Personal info → Address, Phone | Non li richiedi |
| ❌ Personal info → Race/ethnicity, Religion, Sexual orientation | Mai trattati |
| ❌ Financial info → User payment info | Tu non vedi mai dati carta — sono solo su PayPal |
| ❌ Financial info → Credit score | Non lo tratti |
| ❌ Health and fitness | Non lo tratti |
| ❌ Messages | Non leggi SMS/email |
| ❌ Photos/videos (categoria a sé) | Tecnicamente la foto della polizza è una "photo", ma Google considera prevalente la categoria d'uso → "Files and docs" è più accurata. **Se vuoi essere extra-prudente** puoi dichiarare anche questa, marcandola allo stesso modo di "Files and docs". |
| ❌ Audio files | Non li raccogli |
| ❌ Calendar | Non lo leggi |
| ❌ Contacts | Non li leggi |
| ❌ Web browsing | Non lo tracci |
| ❌ Other user-generated content | Già coperto da "Files and docs" |

---

## Sezione 4 — "Security practices" (sezione finale del form)

| Domanda | Risposta |
|---------|----------|
| Is your data encrypted in transit? | ✅ **Yes** — TLS 1.3 fra app e backend Vercel, fra backend e Anthropic, Firebase, PayPal, Upstash. |
| Do you provide a way for users to request that their data be deleted? | ✅ **Yes** — il file `/trasparenza` del sito documenta che basta una richiesta a `stefano.scapigliati@gmail.com` per cancellare l'email e il codice Pro entro 7 giorni lavorativi (GDPR art. 17). |
| Are you committed to following the Play Families Policy? | ❌ **No** (non è app per famiglie/minori) |
| Has your app been independently security reviewed? | ❌ **No** (a meno che tu abbia una certificazione) |

---

## Sezione 5 — Link informativi obbligatori

| Campo | Valore da incollare |
|-------|---------------------|
| **Privacy Policy URL** | `https://sherlock-polizze-site-five.vercel.app/privacy` |
| **Account deletion URL** (richiesto se hai login/account) | Lascia vuoto se non hai un sistema di account formale; altrimenti `https://sherlock-polizze-site-five.vercel.app/trasparenza` (ha la sezione "Cancellazione su richiesta") |

---

## Sezione 6 — Pubblicazione

1. Dopo aver compilato tutto: click **Next** in fondo.
2. **Preview** della Data Safety card che apparirà nel Play Store.
3. **Submit for review**.
4. Google approva tipicamente in 1-3 giorni. Se ci sono incongruenze (es. dichiari "no analytics" ma il SDK Firebase è nel bundle) Google rifiuta con motivazione.

---

## Bonus — comportamento di rischio

**Se dichiari MENO di quanto effettivamente raccogli**, Google scansiona il bundle e ti contesta — sospensione possibile.

**Se dichiari PIÙ di quanto raccogli**, nessun problema regolatorio, ma utenti potenziali si possono spaventare leggendo la Data Safety card. Strategia: dichiara accuratamente, e nel campo "Description" di ogni categoria scrivi 1 frase chiara che spiega *perché* lo raccogli e *cosa NON fai* con esso. Esempio per "Files and docs":

> "Documents are uploaded only to perform AI analysis. Files are processed in-memory and immediately discarded — never stored in any database. Not used for AI training."

Questa frase trasforma una dichiarazione apparentemente preoccupante in un punto di fiducia.
