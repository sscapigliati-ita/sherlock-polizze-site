import { checksumValido } from './codici';
import { codicePresente } from './storage';

export async function validaCodicePro(codice: string | null | undefined): Promise<boolean> {
  if (!codice) return false;
  const pulito = codice.trim().toUpperCase();
  if (!checksumValido(pulito)) return false;

  // Whitelist hardcoded da env var (codici "preautorizzati")
  const env = (import.meta.env.PRO_CODES ?? process.env.PRO_CODES ?? '') as string;
  const whitelist = env
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  if (whitelist.includes(pulito)) return true;

  // Codici emessi tramite il flow PayPal (salvati in KV / storage)
  if (await codicePresente(pulito)) return true;

  // Modalità dev: se nessuna whitelist E storage vuoto, accetta qualunque codice ben formato
  // (controllato verificando se kv non è configurato e whitelist è vuota)
  if (whitelist.length === 0) {
    const kvOn = Boolean(
      (import.meta.env.KV_REST_API_URL ?? process.env.KV_REST_API_URL) &&
        (import.meta.env.KV_REST_API_TOKEN ?? process.env.KV_REST_API_TOKEN),
    );
    if (!kvOn) return true;
  }

  return false;
}

export function getAnthropicKey(): string | undefined {
  return (import.meta.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY) as string | undefined;
}

export function getModel(): string {
  return (
    (import.meta.env.ANTHROPIC_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6') as string
  );
}
