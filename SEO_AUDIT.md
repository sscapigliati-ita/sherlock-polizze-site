# Audit SEO pubblico

Ultimo aggiornamento: 15 luglio 2026.

## Dominio e canonical

- Dominio ufficiale: `https://www.sherlockpolizze.it`.
- Configurazione Astro e robots puntano al dominio ufficiale.
- Un test statico impedisce destinazioni pubbliche `*.vercel.app`, lasciando ammesso il solo controllo tecnico nel layout.

## Route indicizzate

Restano indicizzabili homepage, PWA, privacy, trasparenza, guide, simulazioni e landing informative non legacy.

## Route noindex

- `/abbonati`
- `/abbonamento/mensile`
- `/abbonamento/semestrale`
- `/abbonamento/annuale`
- `/reclamo-singolo`

## Esclusioni sitemap

Sono escluse le famiglie `/abbonati`, `/abbonamento` e `/reclamo-singolo`, oltre alle utility amministrative/offline già escluse. La build del 15 luglio 2026 ha prodotto zero match per route legacy e `vercel.app` nei file sitemap.

## Residui

- La revisione di title, description e linking interno dell'intero corpus è rinviata alla fase di restyling/SEO.
- Le route di conferma restano accessibili per retrocompatibilità, ma sono escluse dalla sitemap insieme alla famiglia legacy.
