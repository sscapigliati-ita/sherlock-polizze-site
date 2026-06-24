// Client per Google Play Developer Reporting API + (in seguito) Cloud Storage
// bucket dei report Play. Usa Service Account JWT — nessuna libreria esterna.
//
// Env vars richieste su Vercel:
//   GOOGLE_SERVICE_ACCOUNT_B64  — base64 del JSON della chiave SA
//   PLAY_APP_PACKAGE_NAME       — es. "it.sherlock.polizze"
//   PLAY_REPORTS_BUCKET         — es. "pubsite_prod_8257021962405195668"
//
// Caching: i dati Play si aggiornano una volta al giorno, quindi cache 6h è
// abbondante e ci tiene lontani da qualsiasi quota.

import { createSign } from 'node:crypto';
import { Redis } from '@upstash/redis';

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

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let _sa: ServiceAccount | null = null;
function sa(): ServiceAccount {
  if (_sa) return _sa;
  const b64 = envVar('GOOGLE_SERVICE_ACCOUNT_B64');
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 non configurata');
  _sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  return _sa!;
}

function pkg(): string {
  return envVar('PLAY_APP_PACKAGE_NAME') ?? 'it.sherlock.polizze';
}

function bucket(): string | undefined {
  return envVar('PLAY_REPORTS_BUCKET');
}

// ---- JWT bearer flow → access_token Google ----

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Token cache in-process per la vita della function instance (Vercel Fluid
// Compute riusa istanze, quindi paga senso); fallback a 1h TTL per sicurezza.
const _tokenCache = new Map<string, { token: string; exp: number }>();

async function accessToken(scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cached = _tokenCache.get(scope);
  if (cached && cached.exp - now > 60) return cached.token;

  const s = sa();
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: s.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = b64url(signer.sign(s.private_key));
  const jwt = `${header}.${claim}.${sig}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) {
    throw new Error(`Token Google: ${j.error_description ?? j.error ?? r.status}`);
  }
  _tokenCache.set(scope, { token: j.access_token, exp: now + (j.expires_in ?? 3600) });
  return j.access_token;
}

// ---- Cache su KV con TTL ----

async function cached<T>(chiave: string, ttlSec: number, calcola: () => Promise<T>): Promise<T> {
  const r = kv();
  if (!r) return calcola();
  const hit = await r.get<T>(chiave);
  if (hit !== null && hit !== undefined) return hit;
  const valore = await calcola();
  await r.set(chiave, valore, { ex: ttlSec });
  return valore;
}

// ===== Play Developer Reporting API =====

type ReportingRow = {
  startTime?: { year?: number; month?: number; day?: number };
  metrics?: Array<{ metric: string; decimalValue?: { value: string }; integerValue?: { value: string } }>;
};

async function queryMetricSet(metricSet: 'crashRateMetricSet' | 'anrRateMetricSet' | 'errorCountMetricSet', metrics: string[], days = 28): Promise<ReportingRow[]> {
  const token = await accessToken('https://www.googleapis.com/auth/playdeveloperreporting');
  const today = new Date();
  const ydy = new Date(today); ydy.setUTCDate(today.getUTCDate() - 1);
  const start = new Date(today); start.setUTCDate(today.getUTCDate() - days);
  const body = {
    timelineSpec: {
      aggregationPeriod: 'DAILY',
      startTime: { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1, day: start.getUTCDate(), timeZone: { id: 'America/Los_Angeles' } },
      endTime: { year: ydy.getUTCFullYear(), month: ydy.getUTCMonth() + 1, day: ydy.getUTCDate(), timeZone: { id: 'America/Los_Angeles' } },
    },
    metrics,
    pageSize: days + 5,
  };
  const r = await fetch(`https://playdeveloperreporting.googleapis.com/v1beta1/apps/${pkg()}/${metricSet}:query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { rows?: ReportingRow[]; error?: { message?: string } };
  if (!r.ok) throw new Error(`Reporting API ${metricSet}: ${j.error?.message ?? r.status}`);
  return j.rows ?? [];
}

export type StabilitaApp = {
  crashRate28gg: number | null;     // media percentuale (0-100)
  anrRate28gg: number | null;       // media percentuale (0-100)
  crashRateOggi: number | null;
  anrRateOggi: number | null;
  serieCrash: Array<{ giorno: string; valore: number }>;
  serieAnr: Array<{ giorno: string; valore: number }>;
};

function rowsAdSerie(rows: ReportingRow[], metric: string): Array<{ giorno: string; valore: number }> {
  return rows
    .map((r) => {
      const t = r.startTime;
      const m = r.metrics?.find((x) => x.metric === metric);
      const val = m?.decimalValue?.value ?? m?.integerValue?.value;
      if (!t?.year || !t?.month || !t?.day || val === undefined) return null;
      const giorno = `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
      return { giorno, valore: Number(val) * 100 }; // proporzione → percentuale
    })
    .filter((x): x is { giorno: string; valore: number } => x !== null);
}

function media(arr: number[]): number | null {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export async function leggiStabilitaApp(): Promise<StabilitaApp> {
  return cached('play:stabilita', 6 * 3600, async () => {
    const [crashRows, anrRows] = await Promise.all([
      queryMetricSet('crashRateMetricSet', ['userPerceivedCrashRate'], 28),
      queryMetricSet('anrRateMetricSet', ['userPerceivedAnrRate'], 28),
    ]);
    const serieCrash = rowsAdSerie(crashRows, 'userPerceivedCrashRate');
    const serieAnr = rowsAdSerie(anrRows, 'userPerceivedAnrRate');
    return {
      crashRate28gg: media(serieCrash.map((r) => r.valore)),
      anrRate28gg: media(serieAnr.map((r) => r.valore)),
      crashRateOggi: serieCrash.at(-1)?.valore ?? null,
      anrRateOggi: serieAnr.at(-1)?.valore ?? null,
      serieCrash,
      serieAnr,
    };
  });
}

// ===== Cloud Storage bucket Play (CSV installs / acquisitions) =====
// Path tipici:
//   stats/installs/installs_<package>_<YYYYMM>_overview.csv
//   stats/store_performance/store_performance_<package>_<YYYYMM>_country.csv
//   stats/retained_installers/retained_installers_<package>_<YYYYMM>_overview.csv

export type UsoApp = {
  installazioniPerGiorno: Array<{ giorno: string; nuove: number; cumulative: number; disinstall: number }>;
  mau: number | null;             // utenti attivi mensili (ultimo dato disponibile)
  acquisizioni28gg: number;       // installazioni nette ultimi 28 giorni
  primeAperture28gg: number | null;
  errore?: string;                // se il bucket non è ancora accessibile
};

function ymToString(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function fetchCsv(objectName: string): Promise<string | null> {
  const b = bucket();
  if (!b) throw new Error('PLAY_REPORTS_BUCKET non configurato');
  const token = await accessToken('https://www.googleapis.com/auth/devstorage.read_only');
  // Storage media download — gli oggetti Play sono salvati in UTF-16 LE con BOM,
  // quindi prendo come ArrayBuffer e decodifico esplicitamente.
  const url = `https://storage.googleapis.com/storage/v1/b/${b}/o/${encodeURIComponent(objectName)}?alt=media`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`GCS ${r.status}: ${err.slice(0, 200)}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  // I CSV Play sono UTF-16 LE con BOM FF FE
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le');
  }
  return buf.toString('utf8');
}

function parseCsv(testo: string): Array<Record<string, string>> {
  const righe = testo.split(/\r?\n/).filter((r) => r.trim().length);
  if (!righe.length) return [];
  const header = righe[0].split(',').map((h) => h.trim());
  return righe.slice(1).map((r) => {
    const cols = r.split(',');
    return Object.fromEntries(header.map((h, i) => [h, (cols[i] ?? '').trim()]));
  });
}

export async function leggiUsoApp(): Promise<UsoApp> {
  return cached('play:uso', 6 * 3600, async () => {
    try {
      const oggi = new Date();
      const meseScorso = new Date(oggi); meseScorso.setUTCMonth(oggi.getUTCMonth() - 1);
      const p = pkg();

      // overview installs degli ultimi due mesi (corrente + precedente per coprire 28gg a cavallo)
      const [csvCurr, csvPrev] = await Promise.all([
        fetchCsv(`stats/installs/installs_${p}_${ymToString(oggi)}_overview.csv`),
        fetchCsv(`stats/installs/installs_${p}_${ymToString(meseScorso)}_overview.csv`),
      ]);

      type Riga = { giorno: string; nuove: number; cumulative: number; disinstall: number };
      const righe: Riga[] = [];
      const ingest = (csv: string | null) => {
        if (!csv) return;
        for (const r of parseCsv(csv)) {
          const giorno = r['Date'] ?? r['Data'];
          const cumulative = Number(r['Cumulative User Installers'] ?? r['Cumulative Device Installs'] ?? 0);
          const nuove = Number(r['Daily User Installers'] ?? r['Daily Device Installs'] ?? 0);
          const disinstall = Number(r['Daily User Uninstalls'] ?? r['Daily Device Uninstalls'] ?? 0);
          if (giorno) righe.push({ giorno, nuove, cumulative, disinstall });
        }
      };
      ingest(csvPrev);
      ingest(csvCurr);
      righe.sort((a, b) => a.giorno.localeCompare(b.giorno));

      // ultimi 28 giorni
      const ultimi28 = righe.slice(-28);
      const acquisizioni28gg = ultimi28.reduce((s, r) => s + (r.nuove - r.disinstall), 0);

      return {
        installazioniPerGiorno: ultimi28,
        mau: null, // TODO: leggere da retained_installers CSV o equivalente
        acquisizioni28gg,
        primeAperture28gg: null, // TODO: store_performance CSV
      };
    } catch (e: any) {
      return {
        installazioniPerGiorno: [],
        mau: null,
        acquisizioni28gg: 0,
        primeAperture28gg: null,
        errore: e?.message ?? String(e),
      };
    }
  });
}
