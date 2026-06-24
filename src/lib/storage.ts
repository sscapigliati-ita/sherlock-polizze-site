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

export type RecordPro = {
  codice: string;
  email: string;
  piano: 'mensile' | 'semestrale' | 'annuale';
  dataEmissione: string; // ISO
  dataScadenza: string; // ISO
  paypalOrderId: string;
};

function kvConfigurato(): boolean {
  return Boolean(urlRedis() && tokenRedis());
}

// Fallback in-memory per dev senza KV (NON adatto a produzione: ogni invocazione serverless è isolata)
const fallback = new Map<string, RecordPro>();

export async function salvaCodicePro(rec: RecordPro): Promise<void> {
  const key = `pro:${rec.codice}`;
  if (kvConfigurato()) {
    await kv().set(key, rec);
    await kv().sadd('pro:codici', rec.codice);
    await kv().sadd(`pro:email:${rec.email.toLowerCase()}`, rec.codice);
  } else {
    fallback.set(key, rec);
    console.warn(
      '[storage] Vercel KV non configurato: codice salvato solo in-memory (sarà perso al riavvio).',
    );
  }
}

export async function leggiCodicePro(codice: string): Promise<RecordPro | null> {
  const key = `pro:${codice.trim().toUpperCase()}`;
  if (kvConfigurato()) {
    const rec = await kv().get<RecordPro>(key);
    return rec ?? null;
  }
  return fallback.get(key) ?? null;
}

export async function codicePresente(codice: string): Promise<boolean> {
  return (await leggiCodicePro(codice)) !== null;
}

export async function codiciAttiviPerEmail(email: string): Promise<RecordPro[]> {
  const emailNorm = email.trim().toLowerCase();
  const oraIso = new Date().toISOString();

  let codici: string[];
  if (kvConfigurato()) {
    const raw = (await kv().smembers(`pro:email:${emailNorm}`)) as string[];
    codici = raw ?? [];
  } else {
    codici = Array.from(fallback.values())
      .filter((r) => r.email.toLowerCase() === emailNorm)
      .map((r) => r.codice);
  }

  const records: RecordPro[] = [];
  for (const c of codici) {
    const r = await leggiCodicePro(c);
    if (r && r.dataScadenza > oraIso) records.push(r);
  }
  // più recente per primo
  records.sort((a, b) => b.dataEmissione.localeCompare(a.dataEmissione));
  return records;
}

export type SintesiAbbonati = {
  records: RecordPro[];
  totali: number;
  attivi: number;
  ricavoEuroCent: number;
};

const PREZZI_CENT: Record<RecordPro['piano'], number> = {
  mensile: 299,
  semestrale: 799,
  annuale: 1499,
};

export async function leggiAbbonati(): Promise<SintesiAbbonati> {
  let records: RecordPro[];
  if (kvConfigurato()) {
    const codici = await kv().smembers('pro:codici');
    if (!codici.length) {
      records = [];
    } else {
      const chiavi = codici.map((c) => `pro:${c}`);
      const recs = await kv().mget<RecordPro[]>(...chiavi);
      records = recs.filter((r): r is RecordPro => Boolean(r));
    }
  } else {
    records = Array.from(fallback.values());
  }

  records.sort((a, b) => b.dataEmissione.localeCompare(a.dataEmissione));
  const oraIso = new Date().toISOString();
  const attivi = records.filter((r) => r.dataScadenza > oraIso).length;
  const ricavoEuroCent = records.reduce((s, r) => s + (PREZZI_CENT[r.piano] ?? 0), 0);

  return {
    records,
    totali: records.length,
    attivi,
    ricavoEuroCent,
  };
}
