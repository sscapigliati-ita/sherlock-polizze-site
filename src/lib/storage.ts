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
  // Allineato con PianoId di paypal.ts. Il 'founder' è arrivato col commit
  // b915b65 ma il tipo qui era rimasto indietro.
  piano: 'mensile' | 'semestrale' | 'annuale' | 'singolo' | 'founder';
  dataEmissione: string; // ISO
  dataScadenza: string; // ISO (per lifetime usiamo 2099-12-31)
  paypalOrderId?: string;
  // Solo per piano='singolo': true dopo la 1ª generazione lettera (codice usa-e-getta)
  usato?: boolean;
  dataUso?: string;
  // Play Billing — popolati quando fonte='play'
  fonte?: 'paypal' | 'play';
  purchaseToken?: string;
  playOrderId?: string;
};

export async function marcaCodiceUsato(codice: string): Promise<void> {
  const key = `pro:${codice.trim().toUpperCase()}`;
  const patch = { usato: true, dataUso: new Date().toISOString() };
  if (kvConfigurato()) {
    const rec = await kv().get<RecordPro>(key);
    if (rec) await kv().set(key, { ...rec, ...patch });
    return;
  }
  const rec = fallback.get(key);
  if (rec) fallback.set(key, { ...rec, ...patch });
}

const FOUNDER_KEY = 'count:founder:venduti';
let _founderFallback = 0;

export async function contaFounderVenduti(): Promise<number> {
  if (!kvConfigurato()) return _founderFallback;
  const n = await kv().get<number>(FOUNDER_KEY);
  return n ?? 0;
}

// Incrementa atomicamente il counter dei Founder venduti e ritorna il nuovo valore.
export async function incrementaFounderVenduti(): Promise<number> {
  if (!kvConfigurato()) return ++_founderFallback;
  return await kv().incr(FOUNDER_KEY);
}

// ===== Referral =====
// 'ref:<codiceReferrer>:count'  → counter degli acquisti generati
// 'ref:<codiceReferrer>:orders' → set degli orderId già accreditati (idempotenza)
const _refFallback = new Map<string, { count: number; orders: Set<string> }>();

export async function leggiCounterReferral(refCode: string): Promise<number> {
  const r = refCode.trim().toUpperCase();
  if (!kvConfigurato()) return _refFallback.get(r)?.count ?? 0;
  const n = await kv().get<number>(`ref:${r}:count`);
  return n ?? 0;
}

// Registra un acquisto come generato dal referral. Idempotente sull'orderId.
// Ritorna true se è la prima volta che si registra (cioè bisogna applicare il bonus),
// false se l'orderId era già accreditato (no doppia ricompensa).
export async function registraReferralAcquisto(refCode: string, orderId: string): Promise<boolean> {
  const r = refCode.trim().toUpperCase();
  const oid = orderId.trim();
  if (!kvConfigurato()) {
    const entry = _refFallback.get(r) ?? { count: 0, orders: new Set<string>() };
    if (entry.orders.has(oid)) return false;
    entry.orders.add(oid);
    entry.count += 1;
    _refFallback.set(r, entry);
    return true;
  }
  // sadd ritorna 1 se membro nuovo, 0 se già presente
  const added = await kv().sadd(`ref:${r}:orders`, oid);
  if (added === 0) return false;
  await kv().incr(`ref:${r}:count`);
  return true;
}

// Estende dataScadenza di un record Pro di N mesi (bonus referral).
// Best-effort: non lancia se il record non c'è.
export async function estendiScadenza(codice: string, mesi: number): Promise<{ ok: boolean; nuovaScadenza?: string }> {
  const key = `pro:${codice.trim().toUpperCase()}`;
  const ora = new Date();
  if (!kvConfigurato()) {
    const rec = fallback.get(key);
    if (!rec) return { ok: false };
    const base = new Date(rec.dataScadenza > ora.toISOString() ? rec.dataScadenza : ora.toISOString());
    base.setMonth(base.getMonth() + mesi);
    const nuovaScadenza = base.toISOString();
    fallback.set(key, { ...rec, dataScadenza: nuovaScadenza });
    return { ok: true, nuovaScadenza };
  }
  const rec = await kv().get<RecordPro>(key);
  if (!rec) return { ok: false };
  const base = new Date(rec.dataScadenza > ora.toISOString() ? rec.dataScadenza : ora.toISOString());
  base.setMonth(base.getMonth() + mesi);
  const nuovaScadenza = base.toISOString();
  await kv().set(key, { ...rec, dataScadenza: nuovaScadenza });
  return { ok: true, nuovaScadenza };
}

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

// ===== Play Billing — indice secondario purchaseToken -> codice =====
// Permette idempotenza dell'endpoint /api/play-billing/verify: lo stesso
// purchaseToken (es. dopo restore o retry) deve ritornare sempre il
// medesimo codice virtuale già emesso.
const PLAY_TOKEN_INDEX_PREFIX = 'play_token:';

export async function cercaPerPurchaseToken(token: string): Promise<RecordPro | null> {
  if (!token) return null;
  if (!kvConfigurato()) return null;
  const codice = await kv().get<string>(`${PLAY_TOKEN_INDEX_PREFIX}${token}`);
  if (!codice) return null;
  return await leggiCodicePro(codice);
}

export async function salvaPurchaseTokenIndex(token: string, codice: string): Promise<void> {
  if (!token || !codice) return;
  if (!kvConfigurato()) return;
  await kv().set(`${PLAY_TOKEN_INDEX_PREFIX}${token}`, codice);
}

export type SintesiAbbonati = {
  records: RecordPro[];
  totali: number;
  attivi: number;
  ricavoEuroCent: number;
};

// Allineati con paypal.ts > PIANI. Espressi in centesimi per evitare floating
// point sull'aggregato ricavo.
const PREZZI_CENT: Record<RecordPro['piano'], number> = {
  mensile: 299,
  semestrale: 799,
  annuale: 1499,
  singolo: 399,
  founder: 1990,
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
