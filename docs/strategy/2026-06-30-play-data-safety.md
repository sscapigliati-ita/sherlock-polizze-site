# Data Safety Play Console — checklist precisa per Sherlock (giugno 2026)

Stato AndroidManifest.xml v4.4 (`Sherlock-v4.4-vc54.aab`):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />
```

**NESSUN permesso di location**. Nessun `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`. Da dichiarare in Data Safety di conseguenza.

---

## Modulo Data Safety Play Console — risposte esatte

Apri: Play Console → Sherlock → **Norme** → **Sicurezza dei dati**.

### Sezione 1 — Raccolta dati e sicurezza

**L'app raccoglie o condivide dati utente richiesti?**
✅ **Sì** — raccoglie alcuni dati (vedi sotto sezione 2 — File e documenti)

**I dati vengono crittografati durante il trasferimento?**
✅ **Sì** — tutte le chiamate al backend usano HTTPS

**Gli utenti possono richiedere la cancellazione dei dati?**
✅ **Sì** — via email a scaplab@sherlockpolizze.it (sito + Privacy Policy)

**L'app è conforme alle norme di Play sulla famiglia?**
☐ Non applicabile (non target bambini)

---

### Sezione 2 — Tipologie di dati raccolti

Aggiungi UNA SOLA categoria: **File e documenti** → **File e documenti** (il PDF della polizza).

| Domanda | Risposta |
|---|---|
| Tipo di dato | File e documenti — **File e documenti** |
| Questo dato è raccolto? | ✅ Sì |
| Questo dato è condiviso? | ❌ No (mai trasmesso a terze parti per scopi non operativi) |
| Lo scopo della raccolta | **Funzionalità dell'app** (analisi del documento richiesta dall'utente) |
| La raccolta è facoltativa o obbligatoria? | **Obbligatoria per la funzionalità** (senza file, non c'è analisi) |
| I dati sono effimeri (cancellati dopo elaborazione)? | ✅ Sì — il PDF viene letto in memoria una sola volta dall'AI, non salvato su disco né usato per training |

**Altre categorie da NON spuntare** (NON raccolte da Sherlock):

❌ **Posizione** — l'app NON ha permessi di location, NON raccoglie GPS né IP geolocalizzato per scopi diversi dal logging tecnico anonimo standard di Vercel (i log non sono mai associati all'utente)

❌ **Informazioni personali** — nome, email (l'email è raccolta SOLO al checkout PayPal sul sito web, NON nell'app), telefono, indirizzo: nulla di tutto questo viene chiesto dall'app

❌ **Informazioni finanziarie** — non c'è billing in-app (DMA: pagamento esterno via web)

❌ **Salute e fitness** — solo se l'utente carica volontariamente una polizza salute il PDF passa attraverso il backend, MA non viene mai salvato; va dichiarato come "File e documenti", non come "Salute"

❌ **Messaggi** — nessun accesso a SMS/email/messaggi del telefono

❌ **Foto e video** — l'app accede alla **fotocamera** SOLO se l'utente la attiva esplicitamente per fotografare un documento. La foto è trattata come "File e documenti", non viene archiviata, non viene mai inviata altrove se non al backend per l'analisi singola

❌ **Audio** — nessun microfono

❌ **Contatti** — nessun accesso

❌ **Calendario** — nessun accesso

❌ **Identificatori dispositivo** — `android_id` viene letto via `Br.getDeviceId()` per uso analitico interno (non per pubblicità). Da valutare se dichiararlo separatamente come "ID univoco non personalizzabile". Vedi sezione "Casi limite" sotto

❌ **Cronologia app** — non raccolta

❌ **Cronologia web** — non raccolta

❌ **Performance app** — Firebase Analytics raccoglie metriche tecniche aggregate (crash, ANR, eventi app_open). Da dichiarare come **"Diagnostica"** → **"Crash log"** + **"App performance"**

---

### Sezione 3 — Dichiarazione corretta per "Diagnostica"

Aggiungi: **Diagnostica → Crash log** e **Diagnostica → Diagnostica app**:

| Domanda | Risposta |
|---|---|
| Raccolto? | ✅ Sì |
| Condiviso con terze parti? | ✅ Sì — Google Firebase (provider analytics di Google stesso) |
| Scopo | **Analisi** + **Funzionalità dell'app** |
| Obbligatoria/facoltativa | Facoltativa per l'utente (l'utente può disattivare Firebase Analytics nelle impostazioni del proprio dispositivo Android) |
| Effimera | No, archiviata da Firebase |

---

### Sezione 4 — ⚠️ Punto critico: "Posizione"

**RISPOSTA CORRETTA: NESSUN dato di posizione raccolto.**

Spiegazione per il modulo (se richiesta):
> L'app non richiede né utilizza i permessi `ACCESS_FINE_LOCATION` o `ACCESS_COARSE_LOCATION`. Nessuna localizzazione GPS, nessuna localizzazione approssimativa via celle/WiFi. Il backend serverless (Vercel) può registrare l'indirizzo IP come parte dei normali log di accesso HTTP, ma questo log NON è associato all'utente, è effimero (auto-cancellato dopo 7 giorni dalla policy Vercel) e non viene mai usato per profilazione geografica.

Se Play Console ha confuso una versione precedente con permessi di location: probabilmente eredità di una build vecchia o di una libreria di terze parti che li dichiarava. Nella v4.4 attuale (`AndroidManifest.xml` letto: solo INTERNET, CAMERA, VIBRATE) la dichiarazione corretta è **"Posizione: NO"**.

---

## Casi limite da chiarire

### `android_id` come identificatore
Il bridge Java `SherlockBridge.getDeviceId()` espone `Settings.Secure.ANDROID_ID`. Da policy Google:
- Va dichiarato come **"ID dispositivo"** sotto categoria **"Identificatori dispositivo o altri"**
- Scopo dichiarato: **Analisi** (deduplica utenti per analytics, NON pubblicità)
- **Non condiviso con terze parti** (resta nel backend di Sherlock per metriche)

**Alternativa più pulita**: rimuovere `getDeviceId()` dal bridge (verificare se è usato lato JS — nel codice attuale non sembra essere chiamato, quindi è codice dormiente). Se rimosso, NON va dichiarato nulla.

→ **Decisione consigliata**: rimuovere `getDeviceId()` nella prossima build (v4.5) per semplificare la Data Safety e ridurre la superficie di dichiarazione.

### Email per checkout PayPal
L'email è raccolta SOLO sul sito web `/abbonamento/*` durante il checkout — quindi è un flusso **del sito**, non **dell'app**. Per la Data Safety Play Console (che riguarda solo l'app) non va dichiarata.

### Codice Pro Sherlock (SHK-XXXX-XXXX)
È un identificatore di licenza generato dal backend Sherlock e salvato in `localStorage` dell'app. **Non è un dato personale** (non riconduce all'utente in modo univoco), è una stringa di attivazione anonima. **Non va dichiarato**.

### Log API anonimi
Le chiamate `/api/analizza`, `/api/lettera`, `/api/compara` salvano in Upstash Redis un evento per richiesta (tipo, esito, ms, IP **anonimizzato**, requestId). Questi log:
- NON includono il contenuto del documento
- NON includono email o altri identificatori utente
- L'IP è solo per rate-limiting, auto-cancellato dopo finestra di logging

**Da dichiarare in Privacy Policy**, ma per Data Safety Play Console: rientra in "Diagnostica" già coperta.

---

## Sezione 5 — Privacy Policy URL

```
https://sherlock-polizze-site-five.vercel.app/privacy
```

Verifica che la Privacy Policy in `/privacy` rifletta esattamente queste dichiarazioni. Se è disallineata (es. dichiara raccolta di posizione che l'app non fa), Play Console lo flagga.

---

## Riepilogo finale Data Safety

✅ **Sì raccolta**:
- File e documenti (PDF polizze) — effimero, non condiviso, scopo funzionalità
- Diagnostica (crash, performance) — condiviso con Firebase, scopo analisi
- (Opzionale, se rimosso da bridge) ID dispositivo — NON condiviso, scopo analisi

❌ **Sì assenza esplicita** (importante per la trasparenza):
- ❌ Posizione (no permessi, no dichiarazione)
- ❌ Informazioni personali
- ❌ Informazioni finanziarie (sono sul sito, non sull'app)
- ❌ Foto/video archiviati (la fotocamera è usata solo per scattare il documento del momento)
- ❌ Contatti, messaggi, audio, calendario

---

## Step operativi

1. Apri Play Console → Sherlock → Norme → Sicurezza dei dati
2. Compila secondo questa checklist
3. Verifica che Privacy Policy `/privacy` sia coerente
4. Considera la rimozione di `getDeviceId()` nella v4.5 per pulizia
5. Invia la dichiarazione per review (di solito 1-3 giorni)

Aggiornare la dichiarazione ogni volta che cambi:
- Permessi del manifest
- Bridge nativo (es. aggiungi/rimuovi getDeviceId, getLocation, ecc.)
- Provider di analytics
- Endpoint API che maneggiano nuovi tipi di dati
