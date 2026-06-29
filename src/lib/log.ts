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
  tipo: 'analizza' | 'lettera' | 'compara';
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

// YYYY-MM-DD nel fuso Europe/Rome — allineato con la dashboard, che usa
// timeZone: 'Europe/Rome' per stampare i timestamp degli eventi. Usare UTC
// qui creerebbe disallineamenti per eventi tra mezzanotte e le 02:00 italiane.
function dateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export async function loggaEvento(ev: EventoAPI): Promise<void> {
  if (!kvOn()) {
    fallbackLog.unshift(ev);
    if (fallbackLog.length > LOG_MAX) fallbackLog.length = LOG_MAX;
    return;
  }

  // Tutto in una sola pipeline atomica (1 round-trip HTTP a Upstash). Importante
  // per evitare scritture parziali quando l'invocazione serverless viene sospesa
  // dopo la response — pattern già osservato come 'eventi nel log ma counter
  // non incrementato'.
  const r = kv();
  const g = dateKey(new Date(ev.ts));
  const p = r.pipeline();
  p.lpush(LOG_KEY, JSON.stringify(ev));
  p.ltrim(LOG_KEY, 0, LOG_MAX - 1);
  p.incr(`count:${ev.tipo}:${g}`);
  p.incr(`count:${ev.tipo}:total`);
  if (ev.esito === 'errore') {
    // Counter aggregato (storico, mantenuto per back-compat con vecchie letture).
    p.incr(`count:errore:${g}`);
    p.incr(`count:errore:total`);
    // Counter per-tipo: introdotti per separare errori analizza vs lettera
    // nella dashboard. Pre-esistenti partono da 0; la differenza vs aggregato
    // rappresenta gli errori prima dello split.
    p.incr(`count:errore:${ev.tipo}:${g}`);
    p.incr(`count:errore:${ev.tipo}:total`);
  }
  if (ev.esito === 'bloccato') {
    p.incr(`count:bloccato:${g}`);
    p.incr(`count:bloccato:total`);
    p.incr(`count:bloccato:${ev.tipo}:${g}`);
    p.incr(`count:bloccato:${ev.tipo}:total`);
  }
  await p.exec();
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
  comparaTotali: number;
  comparaOggi: number;
  // Aggregato storico (analizza + lettera + compara) — mantenuto per back-compat.
  erroriTotali: number;
  bloccatiTotali: number;
  // Per-tipo (disponibili dal deploy che ha introdotto lo split: pre-esistenti
  // contati solo come aggregato).
  erroriAnalizzaTotali: number;
  erroriLetteraTotali: number;
  erroriComparaTotali: number;
  bloccatiAnalizzaTotali: number;
  bloccatiLetteraTotali: number;
  bloccatiComparaTotali: number;
  perGiorno: Array<{ giorno: string; analisi: number; errori: number }>;
};

export async function leggiStats(): Promise<StatsAPI> {
  const oggi = dateKey(new Date());

  if (!kvOn()) {
    const tot = (tipo: 'analizza' | 'lettera' | 'compara') => fallbackLog.filter((e) => e.tipo === tipo).length;
    const totOggi = (tipo: 'analizza' | 'lettera' | 'compara') =>
      fallbackLog.filter((e) => e.tipo === tipo && dateKey(new Date(e.ts)) === oggi).length;
    const errs = fallbackLog.filter((e) => e.esito === 'errore').length;
    const blocs = fallbackLog.filter((e) => e.esito === 'bloccato').length;
    const errsTipo = (tipo: 'analizza' | 'lettera' | 'compara') =>
      fallbackLog.filter((e) => e.esito === 'errore' && e.tipo === tipo).length;
    const blocsTipo = (tipo: 'analizza' | 'lettera' | 'compara') =>
      fallbackLog.filter((e) => e.esito === 'bloccato' && e.tipo === tipo).length;
    return {
      analisiTotali: tot('analizza'),
      analisiOggi: totOggi('analizza'),
      lettereTotali: tot('lettera'),
      lettereOggi: totOggi('lettera'),
      comparaTotali: tot('compara'),
      comparaOggi: totOggi('compara'),
      erroriTotali: errs,
      bloccatiTotali: blocs,
      erroriAnalizzaTotali: errsTipo('analizza'),
      erroriLetteraTotali: errsTipo('lettera'),
      erroriComparaTotali: errsTipo('compara'),
      bloccatiAnalizzaTotali: blocsTipo('analizza'),
      bloccatiLetteraTotali: blocsTipo('lettera'),
      bloccatiComparaTotali: blocsTipo('compara'),
      perGiorno: serie7giorni(fallbackLog),
    };
  }

  const r = kv();
  const [
    analisiT, analisiO, lettereT, lettereO,
    erroriT, bloccatiT,
    erroriAnalizzaT, erroriLetteraT,
    bloccatiAnalizzaT, bloccatiLetteraT,
    comparaT, comparaO,
    erroriComparaT, bloccatiComparaT,
  ] = await Promise.all([
    r.get<number>('count:analizza:total'),
    r.get<number>(`count:analizza:${oggi}`),
    r.get<number>('count:lettera:total'),
    r.get<number>(`count:lettera:${oggi}`),
    r.get<number>('count:errore:total'),
    r.get<number>('count:bloccato:total'),
    r.get<number>('count:errore:analizza:total'),
    r.get<number>('count:errore:lettera:total'),
    r.get<number>('count:bloccato:analizza:total'),
    r.get<number>('count:bloccato:lettera:total'),
    r.get<number>('count:compara:total'),
    r.get<number>(`count:compara:${oggi}`),
    r.get<number>('count:errore:compara:total'),
    r.get<number>('count:bloccato:compara:total'),
  ]);

  const giorni: string[] = [];
  // Ancoro a mezzogiorno UTC per evitare scivolamenti di giorno dovuti al DST
  // o all'offset Europe/Rome quando l'invocazione cade vicino a mezzanotte.
  const ancoraRome = new Date(`${oggi}T12:00:00Z`);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ancoraRome);
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
    analisiTotali: analisiT ?? 0,
    analisiOggi: analisiO ?? 0,
    lettereTotali: lettereT ?? 0,
    lettereOggi: lettereO ?? 0,
    comparaTotali: comparaT ?? 0,
    comparaOggi: comparaO ?? 0,
    erroriTotali: erroriT ?? 0,
    bloccatiTotali: bloccatiT ?? 0,
    erroriAnalizzaTotali: erroriAnalizzaT ?? 0,
    erroriLetteraTotali: erroriLetteraT ?? 0,
    erroriComparaTotali: erroriComparaT ?? 0,
    bloccatiAnalizzaTotali: bloccatiAnalizzaT ?? 0,
    bloccatiLetteraTotali: bloccatiLetteraT ?? 0,
    bloccatiComparaTotali: bloccatiComparaT ?? 0,
    perGiorno: perGiornoRaw,
  };
}

function serie7giorni(eventi: EventoAPI[]): Array<{ giorno: string; analisi: number; errori: number }> {
  const out: Array<{ giorno: string; analisi: number; errori: number }> = [];
  const ancoraRome = new Date(`${dateKey(new Date())}T12:00:00Z`);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ancoraRome);
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
