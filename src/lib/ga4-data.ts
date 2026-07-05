// Client per Google Analytics Data API v1 (GA4). Riusa il pattern JWT/access
// token già esportato da play.ts (stessa Service Account).
//
// Setup una tantum in GA4:
//   Admin → Property Access Management → Aggiungi utente → email della SA →
//   Ruolo "Viewer". Va fatto per OGNI property che vuoi leggere.
//
// Env vars su Vercel (aggiungerne una o entrambe):
//   GA4_PROPERTY_ID_ADS       — Property numerico "sherlock polizze web"
//                                (Admin → Property details → Property ID)
//                                es. "123456789"
//   GA4_PROPERTY_ID_FIREBASE  — Property numerico "sherlock-6f88c" (Firebase
//                                Analytics collegato all'app Android)
//   GOOGLE_SERVICE_ACCOUNT_B64 — già presente per Play Reporting API,
//                                riusiamo la stessa SA.
//
// Caching KV: 1 ora — GA4 ha comunque un ritardo di aggiornamento di 4h+
// per real-time / 24h per la maggior parte dei report standard.

import { Redis } from '@upstash/redis';
import { accessToken } from './play';

function envVar(name: string): string | undefined {
  return (
    (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name] ?? undefined
  );
}

let _kv: Redis | null = null;
function kv(): Redis | null {
  if (_kv) return _kv;
  const url = envVar('UPSTASH_REDIS_REST_URL') ?? envVar('KV_REST_API_URL');
  const token = envVar('UPSTASH_REDIS_REST_TOKEN') ?? envVar('KV_REST_API_TOKEN');
  if (!url || !token) return null;
  _kv = new Redis({ url, token });
  return _kv;
}

async function cached<T>(chiave: string, ttlSec: number, calcola: () => Promise<T>): Promise<T> {
  const r = kv();
  if (!r) return calcola();
  const hit = await r.get<T>(chiave);
  if (hit !== null && hit !== undefined) return hit;
  const valore = await calcola();
  await r.set(chiave, valore, { ex: ttlSec });
  return valore;
}

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

async function runReport(propertyId: string, body: unknown): Promise<any> {
  const token = await accessToken(SCOPE);
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.error?.message ?? `HTTP ${r.status}`;
    throw new Error(`GA4 Data API: ${msg}`);
  }
  return j;
}

export type AnalyticsProperty = {
  propertyId: string;
  utenti7gg: number;
  utentiOggi: number;
  pageviews7gg: number;
  sessioni7gg: number;
  serieUtenti: Array<{ giorno: string; utenti: number; pageviews: number }>;
  topPagine: Array<{ path: string; views: number }>;
  topEventi: Array<{ nome: string; occorrenze: number }>;
};

export type AnalyticsResult = AnalyticsProperty | { errore: string };

/**
 * Legge le metriche principali di una property GA4 (finestra 7 gg + oggi).
 * Ritorna un oggetto con `errore` se la property non è configurata o l'API
 * risponde con un errore (permessi mancanti, quota, ID sbagliato).
 */
export async function leggiAnalyticsProperty(
  propertyIdEnv: 'GA4_PROPERTY_ID_ADS' | 'GA4_PROPERTY_ID_FIREBASE',
  giorni = 7,
): Promise<AnalyticsResult> {
  const propertyId = envVar(propertyIdEnv);
  if (!propertyId) {
    return {
      errore: `${propertyIdEnv} non configurata. Aggiungi la env var in Vercel con il Property ID numerico (GA4 → Admin → Property details → Property ID).`,
    };
  }
  if (!envVar('GOOGLE_SERVICE_ACCOUNT_B64')) {
    return { errore: 'GOOGLE_SERVICE_ACCOUNT_B64 non configurata' };
  }

  try {
    return await cached(`ga4:v1:${propertyId}:${giorni}`, 60 * 60, async () => {
      const range = { startDate: `${giorni}daysAgo`, endDate: 'today' };
      const rangeOggi = { startDate: 'today', endDate: 'today' };

      // 1) Serie giornaliera utenti+pageviews (per KPI e mini-chart)
      const serieRes = await runReport(propertyId, {
        dateRanges: [range],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 40,
      });

      // 2) Utenti oggi
      const oggiRes = await runReport(propertyId, {
        dateRanges: [rangeOggi],
        metrics: [{ name: 'activeUsers' }],
      });

      // 3) Top pagine
      const pagineRes = await runReport(propertyId, {
        dateRanges: [range],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 6,
      });

      // 4) Top eventi
      const eventiRes = await runReport(propertyId, {
        dateRanges: [range],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 6,
      });

      const serieUtenti = (serieRes.rows ?? []).map((r: any) => {
        const d = r.dimensionValues?.[0]?.value ?? '';
        return {
          giorno: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d,
          utenti: Number(r.metricValues?.[0]?.value ?? 0),
          pageviews: Number(r.metricValues?.[1]?.value ?? 0),
        };
      });

      const utenti7gg = serieUtenti.reduce((s: number, g) => s + g.utenti, 0);
      const pageviews7gg = serieUtenti.reduce((s: number, g) => s + g.pageviews, 0);
      const sessioni7gg = (serieRes.rows ?? []).reduce(
        (s: number, r: any) => s + Number(r.metricValues?.[2]?.value ?? 0),
        0,
      );

      const utentiOggi = Number(oggiRes.rows?.[0]?.metricValues?.[0]?.value ?? 0);

      const topPagine = (pagineRes.rows ?? []).map((r: any) => ({
        path: r.dimensionValues?.[0]?.value ?? '',
        views: Number(r.metricValues?.[0]?.value ?? 0),
      }));

      const topEventi = (eventiRes.rows ?? []).map((r: any) => ({
        nome: r.dimensionValues?.[0]?.value ?? '',
        occorrenze: Number(r.metricValues?.[0]?.value ?? 0),
      }));

      return {
        propertyId,
        utenti7gg,
        utentiOggi,
        pageviews7gg,
        sessioni7gg,
        serieUtenti,
        topPagine,
        topEventi,
      } satisfies AnalyticsProperty;
    });
  } catch (e: any) {
    return { errore: String(e?.message ?? e) };
  }
}

/**
 * Invalida le cache GA4 (chiamata da /admin?refresh=ga4).
 */
export async function invalidaCacheGa4(): Promise<void> {
  const r = kv();
  if (!r) return;
  const chiavi: string[] = [];
  for await (const k of r.scanIterator({ match: 'ga4:v1:*' })) {
    chiavi.push(k);
  }
  if (chiavi.length) await r.del(...chiavi);
}
