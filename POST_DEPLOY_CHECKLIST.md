# Post-Deploy Checklist

- [ ] Dominio e HTTPS corretti su `https://www.sherlockpolizze.it`.
- [ ] Homepage, privacy, trasparenza, simulazione report e PWA rispondono senza errori.
- [ ] `/abbonati`, `/abbonamento/*` e `/reclamo-singolo` espongono `noindex,nofollow` e non sono collegate dalla navigazione pubblica.
- [ ] Founder lifetime e scarsità artificiale non sono visibili.
- [ ] Sitemap, robots, canonical e Open Graph puntano al dominio ufficiale.
- [ ] Sitemap priva di `vercel.app`, `/abbonati`, `/abbonamento/` e `/reclamo-singolo`.
- [ ] Consenso negato non emette analytics; consenso concesso usa lo stream previsto.
- [ ] Analisi con file sintetico funziona; MIME/dimensione non validi sono rifiutati.
- [ ] Errori AI non mostrano un report definitivo incompleto.
- [ ] Checkout PayPal sandbox è idempotente e non conta test come ricavo reale.
- [ ] Ripristino acquisto Play di test non crea duplicati.
- [ ] Email di test non espone codice nei log.
- [ ] Nessun documento, email, codice o token compare nei log.
- [ ] Metriche costo/errore non contengono dati personali.
- [ ] È disponibile il deployment precedente per rollback.
