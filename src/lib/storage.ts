import { kv } from '@vercel/kv';

export type RecordPro = {
  codice: string;
  email: string;
  piano: 'mensile' | 'semestrale' | 'annuale';
  dataEmissione: string; // ISO
  dataScadenza: string; // ISO
  paypalOrderId: string;
};

function kvConfigurato(): boolean {
  // Vercel KV inietta KV_REST_API_URL e KV_REST_API_TOKEN quando il KV è collegato al progetto
  return Boolean(
    (import.meta.env.KV_REST_API_URL ?? process.env.KV_REST_API_URL) &&
      (import.meta.env.KV_REST_API_TOKEN ?? process.env.KV_REST_API_TOKEN),
  );
}

// Fallback in-memory per dev senza KV (NON adatto a produzione: ogni invocazione serverless è isolata)
const fallback = new Map<string, RecordPro>();

export async function salvaCodicePro(rec: RecordPro): Promise<void> {
  const key = `pro:${rec.codice}`;
  if (kvConfigurato()) {
    await kv.set(key, rec);
    await kv.sadd('pro:codici', rec.codice);
    await kv.sadd(`pro:email:${rec.email.toLowerCase()}`, rec.codice);
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
    const rec = await kv.get<RecordPro>(key);
    return rec ?? null;
  }
  return fallback.get(key) ?? null;
}

export async function codicePresente(codice: string): Promise<boolean> {
  return (await leggiCodicePro(codice)) !== null;
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
    const codici = await kv.smembers('pro:codici');
    if (!codici.length) {
      records = [];
    } else {
      const chiavi = codici.map((c) => `pro:${c}`);
      const recs = await kv.mget<RecordPro[]>(...chiavi);
      records = recs.filter((r): r is RecordPro => Boolean(r));
    }
  } else {
    records = Array.from(fallback.values());
  }

  records.sort((a, b) => b.dataEmissione.localeCompare(a.dataEmissione));
  const oraIso = new Date().toISOString();
  const attivi = records.filter((r) => r.dataScadenza > oraIso).length;
  const ricavoEuroCent = records.reduce((s, r) => s + (PREZZI_CENT[r.piano] ?? 0), 0);
  return { records, totali: records.length, attivi, ricavoEuroCent };
}
