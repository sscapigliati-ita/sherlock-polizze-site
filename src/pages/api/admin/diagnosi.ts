import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

export const prerender = false;

function envVar(name: string): string | undefined {
  return (
    (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name] ?? undefined
  );
}
function kv(): Redis {
  const url = envVar('UPSTASH_REDIS_REST_URL') ?? envVar('KV_REST_API_URL');
  const token = envVar('UPSTASH_REDIS_REST_TOKEN') ?? envVar('KV_REST_API_TOKEN');
  if (!url || !token) throw new Error('KV non configurato');
  return new Redis({ url, token });
}

function ymdRome(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

// GET /api/admin/diagnosi[?fix=1] — endpoint disposable per riconciliare stato KV vs UI
export const GET: APIRoute = async ({ url }) => {
  const fix = url.searchParams.get('fix') === '1';
  const r = kv();
  const oraIso = new Date().toISOString();

  const codiciSet = (await r.smembers('pro:codici')) as string[];

  const keysPro: string[] = [];
  let cursor: number | string = 0;
  do {
    const [next, batch] = (await r.scan(cursor, { match: 'pro:*', count: 200 })) as [string, string[]];
    cursor = next;
    for (const k of batch) {
      if (k === 'pro:codici') continue;
      if (k.startsWith('pro:email:')) continue;
      keysPro.push(k);
    }
  } while (Number(cursor) !== 0);

  const codiciDaSet = new Set(codiciSet);
  const codiciDaRecord = new Set(keysPro.map((k) => k.replace('pro:', '')));
  const orfaniSenzaSet = [...codiciDaRecord].filter((c) => !codiciDaSet.has(c));
  const setSenzaRecord = [...codiciDaSet].filter((c) => !codiciDaRecord.has(c));

  const records: any[] = [];
  for (const k of keysPro) {
    const rec = await r.get(k);
    if (rec) records.push(rec);
  }
  const recAttivi = records.filter((rec: any) => rec.dataScadenza > oraIso).length;

  const oggiUtc = new Date().toISOString().slice(0, 10);
  const oggiRome = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const counterUtc = await r.get<number>(`count:analizza:${oggiUtc}`);
  const counterRome = oggiUtc !== oggiRome ? await r.get<number>(`count:analizza:${oggiRome}`) : counterUtc;

  const eventi = (await r.lrange<string>('log:api', 0, 499)).map((e) => {
    try { return typeof e === 'string' ? JSON.parse(e) : e; } catch { return null; }
  }).filter(Boolean) as any[];

  const ymdUtc = (iso: string) => new Date(iso).toISOString().slice(0, 10);

  const analisi = eventi.filter((e) => e.tipo === 'analizza');
  const oggiRomeFromLog = analisi.filter((e) => ymdRome(e.ts) === oggiRome).length;
  const oggiUtcFromLog = analisi.filter((e) => ymdUtc(e.ts) === oggiUtc).length;

  // ---- Riconciliazione counter dal log eventi (?fix=1) ----
  // ATTENZIONE: ricostruisce SOLO dagli ultimi 500 eventi nel log (LOG_MAX).
  // Quindi: per-giorno è preciso solo per i giorni interamente contenuti nel
  // log; il :total ricostruito sarà solo la somma di quei 500 eventi e
  // sovrascriverà il totale "vero" se ce ne sono di più fuori finestra.
  let riconciliazione: any = null;
  if (fix) {
    // 1) Aggrega dal log eventi
    type Bucket = { perGiorno: Record<string, number>; totali: number };
    const bk: Record<string, Bucket> = {};
    const incr = (chiave: string, g: string) => {
      if (!bk[chiave]) bk[chiave] = { perGiorno: {}, totali: 0 };
      bk[chiave].perGiorno[g] = (bk[chiave].perGiorno[g] ?? 0) + 1;
      bk[chiave].totali += 1;
    };
    for (const e of eventi) {
      const g = ymdRome(e.ts);
      incr(e.tipo, g);
      if (e.esito === 'errore') incr('errore', g);
      if (e.esito === 'bloccato') incr('bloccato', g);
    }

    // 2) Cancella i counter esistenti (analizza/lettera/errore/bloccato — per giorno e totali)
    const keysDaPulire: string[] = [];
    for (const chiave of ['analizza', 'lettera', 'errore', 'bloccato']) {
      let cursor: number | string = 0;
      do {
        const [next, batch] = (await r.scan(cursor, { match: `count:${chiave}:*`, count: 200 })) as [string, string[]];
        cursor = next;
        for (const k of batch) keysDaPulire.push(k);
      } while (Number(cursor) !== 0);
    }
    if (keysDaPulire.length) await r.del(...keysDaPulire);

    // 3) Riscrivi dal bucket aggregato
    const p = r.pipeline();
    for (const [chiave, b] of Object.entries(bk)) {
      p.set(`count:${chiave}:total`, b.totali);
      for (const [g, n] of Object.entries(b.perGiorno)) {
        p.set(`count:${chiave}:${g}`, n);
      }
    }
    await p.exec();

    riconciliazione = {
      keys_eliminate: keysDaPulire.length,
      counter_riscritti: Object.entries(bk).reduce(
        (s, [, b]) => s + 1 + Object.keys(b.perGiorno).length,
        0,
      ),
      bucket: bk,
    };
  }

  return new Response(JSON.stringify({
    abbonamenti: {
      pro_codici_set_size: codiciSet.length,
      pro_codici_set: codiciSet,
      record_pro_keys_count: keysPro.length,
      record_pro_keys: keysPro,
      orfani_record_senza_set: orfaniSenzaSet,
      orfani_set_senza_record: setSenzaRecord,
      record_letti: records.length,
      record_attivi: recAttivi,
      record_detail: records.map((r) => ({
        codice: r.codice, email: r.email, piano: r.piano,
        emiss: r.dataEmissione?.slice(0, 10), scad: r.dataScadenza?.slice(0, 10),
        attivo: r.dataScadenza > oraIso, paypalOrderId: r.paypalOrderId,
      })),
    },
    analisi_oggi: {
      oggi_utc: oggiUtc,
      oggi_rome: oggiRome,
      counter_utc: counterUtc,
      counter_rome: counterRome,
      log_eventi_analisi_oggi_rome: oggiRomeFromLog,
      log_eventi_analisi_oggi_utc: oggiUtcFromLog,
      log_eventi_totali: eventi.length,
    },
    riconciliazione,
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
