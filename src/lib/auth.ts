import { checksumValido } from './codici';
import { codicePresente, leggiCodicePro, type RecordPro } from './storage';

export type EsitoCodice =
  | { valido: true; tipo: 'pro' | 'singolo' | 'whitelist' | 'dev'; record?: RecordPro }
  | { valido: false; motivo: 'formato' | 'sconosciuto' | 'scaduto' | 'gia_usato' };

export async function valutaCodice(codice: string | null | undefined): Promise<EsitoCodice> {
  if (!codice) return { valido: false, motivo: 'sconosciuto' };
  const pulito = codice.trim().toUpperCase();
  if (!checksumValido(pulito)) return { valido: false, motivo: 'formato' };

  // Whitelist preautorizzata (env var PRO_CODES)
  const env = (import.meta.env.PRO_CODES ?? process.env.PRO_CODES ?? '') as string;
  const whitelist = env.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (whitelist.includes(pulito)) return { valido: true, tipo: 'whitelist' };

  // Codici emessi via PayPal (KV)
  const rec = await leggiCodicePro(pulito);
  if (rec) {
    const oraIso = new Date().toISOString();
    if (rec.dataScadenza < oraIso) return { valido: false, motivo: 'scaduto' };
    if (rec.piano === 'singolo') {
      if (rec.usato) return { valido: false, motivo: 'gia_usato' };
      return { valido: true, tipo: 'singolo', record: rec };
    }
    return { valido: true, tipo: 'pro', record: rec };
  }

  // Dev mode: nessuna whitelist E kv off → accetta qualunque codice ben formato
  if (whitelist.length === 0) {
    const kvOn = Boolean(
      (import.meta.env.KV_REST_API_URL ?? process.env.KV_REST_API_URL) &&
        (import.meta.env.KV_REST_API_TOKEN ?? process.env.KV_REST_API_TOKEN),
    );
    if (!kvOn) return { valido: true, tipo: 'dev' };
  }

  return { valido: false, motivo: 'sconosciuto' };
}

// Mantenuto per compatibilità con i call site esistenti che vogliono solo true/false.
export async function validaCodicePro(codice: string | null | undefined): Promise<boolean> {
  const esito = await valutaCodice(codice);
  return esito.valido;
}

export function getAnthropicKey(): string | undefined {
  return (import.meta.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY) as string | undefined;
}

export function getModel(): string {
  return (
    (import.meta.env.ANTHROPIC_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6') as string
  );
}
