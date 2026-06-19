import { kv } from '@vercel/kv';

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
  return Boolean(
    (import.meta.env.KV_REST_API_URL ?? process.env.KV_REST_API_URL) &&
      (import.meta.env.KV_REST_API_TOKEN ?? process.env.KV_REST_API_TOKEN),
  );
}

const fallbackLog: EventoAPI[] = [];

const LOG_KEY = 'log:api';
const LOG_MAX = 500;

function dateKey(d: Date): string {
  // YYYY-MM-DD UTC
  return d.toISOString().slice(0, 10);
}

export async function loggaEvento(ev: EventoAPI): Promise<void> {
  if (!kvOn()) {
    fallbackLog.unshift(ev);
    if (fallbackLog.length > LOG_MAX) fallbackLog.length = LOG_MAX;
    return;
  }

  // Lista circolare con LPUSH + LTRIM
  await kv.lpush(LOG_KEY, JSON.stringify(ev));
  await kv.ltrim(LOG_KEY, 0, LOG_MAX - 1);

  // Counter aggregati
  const g = dateKey(new Date(ev.ts));
  await kv.incr(`count:${ev.tipo}:${g}`);
  await kv.incr(`count:${ev.tipo}:total`);
  if (ev.esito === 'errore') {
    await kv.incr(`count:errore:${g}`);
    await kv.incr(`count:errore:total`);
  }
  if (ev.esito === 'bloccato') {
    await kv.incr(`count:bloccato:${g}`);
    await kv.incr(`count:bloccato:total`);
  }
}

export async function leggiUltimiEventi(limit = 50): Promise<EventoAPI[]> {
  if (!kvOn()) return fallbackLog.slice(0, limit);
  const righe = await kv.lrange<string>(LOG_KEY, 0, limit - 1);
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

  const [analisiT, analisiO, lettereT, lettereO, erroriT, bloccatiT] = await Promise.all([
    kv.get<number>('count:analizza:total'),
    kv.get<number>(`count:analizza:${oggi}`),
    kv.get<number>('count:lettera:total'),
    kv.get<number>(`count:lettera:${oggi}`),
    kv.get<number>('count:errore:total'),
    kv.get<number>('count:bloccato:total'),
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
        kv.get<number>(`count:analizza:${g}`),
        kv.get<number>(`count:errore:${g}`),
      ]);
      return { giorno: g, analisi: a ?? 0, errori: e ?? 0 };
    }),
  );

  return {
    analisiTotali: analisiT ?? 0,
    analisiOggi: analisiO ?? 0,
    lettereTotali: lettereT ?? 0,
    lettereOggi: lettereO ?? 0,
    erroriTotali: erroriT ?? 0,
    bloccatiTotali: bloccatiT ?? 0,
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
