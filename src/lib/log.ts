import { Redis } from '@upstash/redis';

function envVar(name: string): string | undefined {
  return (
    (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name] ?? undefined
  );
}

function urlRedis(): string | undefined {
  return envVar('UPSTASH_REDIS_REST_URL') ?? envVar('KV_REST_API_URL');
}

function tokenRedis(): string | undefined {
  return envVar('UPSTASH_REDIS_REST_TOKEN') ?? envVar('KV_REST_API_TOKEN');
}

let _kv: Redis | null = null;
function kv(): Redis {
  if (!_kv) {
    const url = urlRedis();
    const token = tokenRedis();
    if (!url || !token) throw new Error('Upstash/KV non configurato');
    _kv = new Redis({ url, token });
  }
  return _kv;
}

export type EventoAPI = {
  ts: string; // ISO timestamp
  tipo: 'analizza' | 'lettera';
  esito: 'ok' | 'errore' | 'bloccato';
  errore?: string;
  requestId: string;
  ip: string;
  ms: number;
};

function kvOn(): boolean {
  return Boolean(urlRedis() && tokenRedis());
}

const fallbackLog: EventoAPI[] = [];

const LOG_KEY = 'log:api';
const LOG_MAX = 500;

function dateKey(d: Date): string {
  // YYYY-MM-DD UTC
  return d.toISOString().slice(0, 10);
}

// Storico Manus (non migrabile da API): valori frozen dal screenshot della
// vecchia dashboard al momento della migrazione. Override possibile via env vars.
const BASELINE_DEFAULTS: Record<string, number> = {
  BASELINE_ANALISI_TOTALI: 2360,
  BASELINE_LETTERE_TOTALI: 3,
  BASELINE_ERRORI_TOTALI: 22,
  BASELINE_BLOCCATI_TOTALI: 125,
};

function baseline(name: string): number {
  const v = envVar(name);
  if (v) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return BASELINE_DEFAULTS[name] ?? 0;
}

export async function loggaEvento(ev: EventoAPI): Promise<void> {
  if (!kvOn()) {
    fallbackLog.unshift(ev);
    if (fallbackLog.length > LOG_MAX) fallbackLog.length = LOG_MAX;
    return;
  }

  const r = kv();
  // Lista circolare con LPUSH + LTRIM
  await r.lpush(LOG_KEY, JSON.stringify(ev));
  await r.ltrim(LOG_KEY, 0, LOG_MAX - 1);

  // Counter aggregati
  const g = dateKey(new Date(ev.ts));
  await r.incr(`count:${ev.tipo}:${g}`);
  await r.incr(`count:${ev.tipo}:total`);
  if (ev.esito === 'errore') {
    await r.incr(`count:errore:${g}`);
    await r.incr(`count:errore:total`);
  }
  if (ev.esito === 'bloccato') {
    await r.incr(`count:bloccato:${g}`);
    await r.incr(`count:bloccato:total`);
  }
}

export async function leggiUltimiEventi(limit = 50): Promise<EventoAPI[]> {
  if (!kvOn()) return fallbackLog.slice(0, limit);
  const righe = await kv().lrange<string>(LOG_KEY, 0, limit - 1);
  return righe
    .map((r) => {
      try {
        return typeof r === 'string' ? (JSON.parse(r) as EventoAPI) : (r as unknown as EventoAPI);
      } catch {
        return null;
      }
    })
    .filter((x): x is EventoAPI => x !== null);
}

export type StatsAPI = {
  analisiTotali: number;
  analisiOggi: number;
  lettereTotali: number;
  lettereOggi: number;
  erroriTotali: number;
  bloccatiTotali: number;
  perGiorno: Array<{ giorno: string; analisi: number; errori: number }>;
};

export async function leggiStats(): Promise<StatsAPI> {
  const oggi = dateKey(new Date());

  if (!kvOn()) {
    const tot = (tipo: 'analizza' | 'lettera') => fallbackLog.filter((e) => e.tipo === tipo).length;
    const totOggi = (tipo: 'analizza' | 'lettera') =>
      fallbackLog.filter((e) => e.tipo === tipo && dateKey(new Date(e.ts)) === oggi).length;
    const errs = fallbackLog.filter((e) => e.esito === 'errore').length;
    const blocs = fallbackLog.filter((e) => e.esito === 'bloccato').length;
    return {
      analisiTotali: tot('analizza'),
      analisiOggi: totOggi('analizza'),
      lettereTotali: tot('lettera'),
      lettereOggi: totOggi('lettera'),
      erroriTotali: errs,
      bloccatiTotali: blocs,
      perGiorno: serie7giorni(fallbackLog),
    };
  }

  const r = kv();
  const [analisiT, analisiO, lettereT, lettereO, erroriT, bloccatiT] = await Promise.all([
    r.get<number>('count:analizza:total'),
    r.get<number>(`count:analizza:${oggi}`),
    r.get<number>('count:lettera:total'),
    r.get<number>(`count:lettera:${oggi}`),
    r.get<number>('count:errore:total'),
    r.get<number>('count:bloccato:total'),
  ]);

  const giorni: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    giorni.push(dateKey(d));
  }
  const perGiornoRaw = await Promise.all(
    giorni.map(async (g) => {
      const [a, e] = await Promise.all([
        r.get<number>(`count:analizza:${g}`),
        r.get<number>(`count:errore:${g}`),
      ]);
      return { giorno: g, analisi: a ?? 0, errori: e ?? 0 };
    }),
  );

  return {
    // Baseline: somma cumulativa storica importata da una piattaforma precedente
    // (es. dashboard Manus pre-migrazione). Configurabile via env BASELINE_*.
    analisiTotali: (analisiT ?? 0) + baseline('BASELINE_ANALISI_TOTALI'),
    analisiOggi: analisiO ?? 0,
    lettereTotali: (lettereT ?? 0) + baseline('BASELINE_LETTERE_TOTALI'),
    lettereOggi: lettereO ?? 0,
    erroriTotali: (erroriT ?? 0) + baseline('BASELINE_ERRORI_TOTALI'),
    bloccatiTotali: (bloccatiT ?? 0) + baseline('BASELINE_BLOCCATI_TOTALI'),
    perGiorno: perGiornoRaw,
  };
}

function serie7giorni(eventi: EventoAPI[]): Array<{ giorno: string; analisi: number; errori: number }> {
  const out: Array<{ giorno: string; analisi: number; errori: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const g = dateKey(d);
    const giorno = eventi.filter((e) => dateKey(new Date(e.ts)) === g);
    out.push({
      giorno: g,
      analisi: giorno.filter((e) => e.tipo === 'analizza').length,
      errori: giorno.filter((e) => e.esito === 'errore').length,
    });
  }
  return out;
}

export function nuovoRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function estraiIp(request: Request): string {
  const h = request.headers;
  return (
    h.get('x-real-ip') ??
    h.get('x-vercel-forwarded-for') ??
    (h.get('x-forwarded-for') ?? '').split(',')[0].trim() ??
    'unknown'
  );
}
