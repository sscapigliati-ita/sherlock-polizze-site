// Runtime check di /.well-known/assetlinks.json per Android App Links.
// Serve a rilevare se il file e' raggiungibile e formalmente corretto —
// dal punto di vista dell'utente Android, un file rotto significa che il
// click su un link sherlockpolizze.it non apre piu' l'app.
//
// Nessuna nuova env: fa una GET HTTP verso il proprio dominio pubblico.
// Cache 10 min: la modifica di assetlinks.json e' rara e Google fa il
// re-crawl solo su reinstall dell'app.

import { Redis } from '@upstash/redis';

const PACKAGE_NAME = 'it.sherlock.polizze';
const ASSETLINKS_URL = 'https://www.sherlockpolizze.it/.well-known/assetlinks.json';
const CACHE_KEY = 'applinks:v1:sherlockpolizze';
const CACHE_TTL_SEC = 10 * 60;

function envVar(name: string): string | undefined {
  return (
    (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name] ?? undefined
  );
}

let _kv: Redis | null = null;
function kv(): Redis | null {
  if (_kv) return _kv;
  const url = envVar('UPSTASH_REDIS_REST_URL') ?? envVar('KV_REST_API_URL');
  const token = envVar('UPSTASH_REDIS_REST_TOKEN') ?? envVar('KV_REST_API_TOKEN');
  if (!url || !token) return null;
  _kv = new Redis({ url, token });
  return _kv;
}

export type AppLinksCheck = {
  ok: boolean;
  status: number | null;
  packageMatch: boolean;
  fingerprintsCount: number;
  problemi: string[];
  raw?: string;
  checkedAt: string;
};

async function esegui(): Promise<AppLinksCheck> {
  const problemi: string[] = [];
  const checkedAt = new Date().toISOString();
  let status: number | null = null;
  let raw = '';

  try {
    const r = await fetch(ASSETLINKS_URL, {
      headers: { Accept: 'application/json' },
      // Timeout implicito: Vercel functions hanno gia' un limite globale.
    });
    status = r.status;
    raw = await r.text();

    if (!r.ok) {
      problemi.push(`HTTP ${r.status} sul file assetlinks.json`);
      return { ok: false, status, packageMatch: false, fingerprintsCount: 0, problemi, raw, checkedAt };
    }

    const contentType = r.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      // Non fatale — Google accetta application/json ma alcuni server rispondono text/plain.
      // Segnaliamo solo se e' text/html (indica probabile 404 di un router SPA).
      if (contentType.includes('text/html')) {
        problemi.push(`content-type inatteso: ${contentType} (dovrebbe essere application/json)`);
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      problemi.push(`JSON parse error: ${e?.message ?? e}`);
      return { ok: false, status, packageMatch: false, fingerprintsCount: 0, problemi, raw, checkedAt };
    }

    if (!Array.isArray(parsed)) {
      problemi.push('root non e\' un array (schema Digital Asset Links richiede array top-level)');
      return { ok: false, status, packageMatch: false, fingerprintsCount: 0, problemi, raw, checkedAt };
    }

    const nostroTarget = parsed.find((entry: any) => {
      return (
        entry?.target?.namespace === 'android_app' &&
        entry?.target?.package_name === PACKAGE_NAME
      );
    });

    if (!nostroTarget) {
      problemi.push(`nessun entry con namespace=android_app e package_name=${PACKAGE_NAME}`);
      return { ok: false, status, packageMatch: false, fingerprintsCount: 0, problemi, raw, checkedAt };
    }

    const relations: string[] = Array.isArray(nostroTarget.relation) ? nostroTarget.relation : [];
    if (!relations.includes('delegate_permission/common.handle_all_urls')) {
      problemi.push('manca relation "delegate_permission/common.handle_all_urls"');
    }

    const fps: string[] = Array.isArray(nostroTarget.target?.sha256_cert_fingerprints)
      ? nostroTarget.target.sha256_cert_fingerprints
      : [];
    if (fps.length === 0) {
      problemi.push('nessun sha256_cert_fingerprint dichiarato');
    }

    return {
      ok: problemi.length === 0,
      status,
      packageMatch: true,
      fingerprintsCount: fps.length,
      problemi,
      raw,
      checkedAt,
    };
  } catch (e: any) {
    problemi.push(`fetch error: ${e?.message ?? e}`);
    return { ok: false, status, packageMatch: false, fingerprintsCount: 0, problemi, raw, checkedAt };
  }
}

export async function verificaAppLinks(bypassCache = false): Promise<AppLinksCheck> {
  const r = kv();
  if (!r || bypassCache) return esegui();
  const hit = await r.get<AppLinksCheck>(CACHE_KEY);
  if (hit) return hit;
  const risultato = await esegui();
  await r.set(CACHE_KEY, risultato, { ex: CACHE_TTL_SEC });
  return risultato;
}

export async function invalidaCacheAppLinks(): Promise<void> {
  const r = kv();
  if (!r) return;
  await r.del(CACHE_KEY);
}
