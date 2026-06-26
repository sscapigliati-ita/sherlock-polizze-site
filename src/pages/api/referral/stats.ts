import type { APIRoute } from 'astro';
import { leggiCodicePro, leggiCounterReferral } from '../../../lib/storage';
import { checksumValido } from '../../../lib/codici';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/referral/stats?codice=SHK-XXXX-XXXX
// Ritorna { valido: boolean, amici: number } se il codice è un Pro attivo
// (non singolo, non scaduto). Endpoint pubblico ma richiede checksum valido +
// presenza in KV — quindi solo chi ha davvero pagato può vedere i propri stats.
export const GET: APIRoute = async ({ url }) => {
  const codice = (url.searchParams.get('codice') ?? '').trim().toUpperCase();
  if (!checksumValido(codice)) {
    return json({ valido: false, error: 'Codice non valido' }, 400);
  }

  const rec = await leggiCodicePro(codice);
  if (!rec) return json({ valido: false, error: 'Codice non trovato' }, 404);
  if (rec.piano === 'singolo') {
    return json({ valido: false, error: 'I codici lettera singola non possono invitare amici (servono codici Pro o Founder)' }, 400);
  }
  if (rec.dataScadenza < new Date().toISOString()) {
    return json({ valido: false, error: 'Codice scaduto' }, 410);
  }

  const amici = await leggiCounterReferral(codice);
  return json({
    valido: true,
    amici,
    piano: rec.piano,
    dataScadenza: rec.dataScadenza,
  });
};
