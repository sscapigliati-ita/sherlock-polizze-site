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
