# Google Play Functionality Remediation

Data: 14 luglio 2026. Scadenza Console: 23 luglio 2026.

## Release preparata

- Package: `it.sherlock.polizze`
- Versione: 4.6.7 (`versionCode 65`)
- AAB locale: `artifacts/Sherlock-v4.6.7-vc65.aab` (ignorato da Git)
- Dimensione: 3.641.429 byte
- SHA-256: `5C7A8CB99E9F0EE27820C7278C7D3DD323146AA73A4269B05523B627E91E085C`

## Difetti individuati e corretti

| Area | Difetto v4.6.6 | Correzione vc65 | Prova |
|---|---|---|---|
| Backend | URL Vercel provvisorio in Java e PWA | dominio canonico `www.sherlockpolizze.it` | test anti-regressione |
| Link | eccezioni ignorate e nessun feedback | policy HTTPS/mail, fallback visibile, schemi pericolosi rifiutati | JUnit |
| Indietro | cronologia WebView non allineata alle schermate SPA | contratto `SherlockNavigation` e doppia pressione per uscire | JUnit + test contenuto |
| File chooser | callback potenzialmente pendente | callback conclusa su successo, annullamento ed errore | build/test Android |
| Bridge API | dettagli tecnici e risultati impliciti | JSON successo/errore con codici stabili | JUnit |
| Icone | impostazioni senza nome accessibile | `aria-label`, icona decorativa nascosta | Vitest |
| Touch/focus | target e focus non uniformi | minimo 48 px, focus ad alto contrasto, stati disabled | Vitest |
| Errori | feedback incoerente | regione `role=alert`, helper timeout/busy/retry | Vitest |
| Animazioni | nessun fallback globale | `prefers-reduced-motion` | Vitest |

## Miglioramenti visivi

Rafforzati gerarchia delle card, profondità, focus oro, stati disabilitati, spaziatura sui 320 px e feedback flottante. L'identità blu/oro e la lente Sherlock restano riconoscibili; le animazioni sono disattivabili.

## Test eseguiti

- Vitest completo: 112/112 test, 17/17 file.
- Test Android JVM: navigazione e bridge verdi.
- Gradle `testDebugUnitTest bundleRelease`: `BUILD SUCCESSFUL`.
- R8, lint vital e firma release completati dalla build Gradle.
- Playwright sulla produzione: **14 test superati**, 2 acquisizioni non applicabili saltate; viewport 320×568, 412×915, 1024×768 e 1440×900.
- Smoke test HTTP produzione: homepage e `/app/` rispondono 200; contratto di navigazione, nome accessibile Impostazioni e regione di feedback presenti.
- Screenshot senza dati personali: `test-results/google-play/` (home, upload e paywall nei profili mobile-small e Android; output locale ignorato da Git).

Non sono ancora dichiarati come eseguiti: test Play Billing reale, Pre-launch report Console e prova manuale su più dispositivi fisici. Devono essere completati sulla track di test prima della pubblicazione su Google Play.

## Deploy web verificato

- Produzione: `https://www.sherlockpolizze.it`
- Deployment Vercel: `dpl_6HgY1nrwNwG1Sy8wdHQKHvXzPwW2`
- HSTS: `max-age=63072000`
- CSP applicata e verificata sulla risposta pubblica.

## Produzione del bundle

Impostare localmente `JAVA_HOME`, `ANDROID_HOME`, `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, poi:

```powershell
cd android
.\gradlew.bat clean testDebugUnitTest bundleRelease
```

Il bundle viene creato in `android/app/build/outputs/bundle/release/app-release.aab`.

## Checklist Google Play Console

- [x] Caricare `Sherlock-v4.6.7-vc65.aab` e verificare versionCode 65/versionName 4.6.7.
- [x] Creare e inviare la release 65 nel canale di produzione; stato Console al 14 luglio 2026: **In revisione**.
- [ ] Eseguire Pre-launch report su telefono piccolo, medio e tablet.
- [ ] Provare onboarding, impostazioni, upload/annullamento, link, Indietro, errore rete, errore AI, acquisto test e ripristino.
- [ ] Allegare screenshot/video dei controlli funzionanti.
- [ ] Inviare la risposta alla contestazione soltanto dopo il test su track.

La release 64 (4.6.6) resta disponibile su Google Play durante la revisione della 65.

Testo suggerito: “Abbiamo corretto la gestione dei controlli interattivi nella versione 4.6.7 (65): navigazione Indietro, link, selettore documenti, feedback di errore e stati dei pulsanti ora restituiscono sempre un esito visibile. Abbiamo inoltre aggiunto nomi accessibili, target touch adeguati e test automatici multi-livello. La release è stata verificata nella track di test prima dell'invio.”
