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

// GET /api/admin/diagnosi — endpoint disposable per riconciliare stato KV vs UI
export const GET: APIRoute = async () => {
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

  const ymdRome = (iso: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
  const ymdUtc = (iso: string) => new Date(iso).toISOString().slice(0, 10);

  const analisi = eventi.filter((e) => e.tipo === 'analizza');
  const oggiRomeFromLog = analisi.filter((e) => ymdRome(e.ts) === oggiRome).length;
  const oggiUtcFromLog = analisi.filter((e) => ymdUtc(e.ts) === oggiUtc).length;

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
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
