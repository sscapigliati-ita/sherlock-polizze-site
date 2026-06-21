import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

export const prerender = false;

function envVar(name: string): string | undefined {
  return (
    (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name] ?? undefined
  );
}
function kvClient(): Redis {
  const url = envVar('UPSTASH_REDIS_REST_URL') ?? envVar('KV_REST_API_URL');
  const token = envVar('UPSTASH_REDIS_REST_TOKEN') ?? envVar('KV_REST_API_TOKEN');
  if (!url || !token) throw new Error('KV non configurato');
  return new Redis({ url, token });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/rimuovi-codice?codice=SHK-…&email=…
// Rimuove un record codice Pro dal KV (key + set membership). Solo admin.
export const GET: APIRoute = async ({ url }) => {
  const codice = (url.searchParams.get('codice') ?? '').trim().toUpperCase();
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();

  if (!/^SHK-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codice)) {
    return json({ error: 'Codice non valido' }, 400);
  }
  if (!email) {
    return json({ error: 'Email richiesta (per pulire pure pro:email:*)' }, 400);
  }

  const r = kvClient();
  await r.del(`pro:${codice}`);
  await r.srem('pro:codici', codice);
  await r.srem(`pro:email:${email}`, codice);
  return json({ ok: true, rimosso: { codice, email } });
};
