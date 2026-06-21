import type { APIRoute } from 'astro';
import { salvaCodicePro, type RecordPro } from '../../../lib/storage';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/admin/migra-utente?email=…&codice=SHK-XXXX-XXXX&piano=mensile|semestrale|annuale
// Aggiunge un record codice Pro al KV come migrazione da una piattaforma esterna
// (es. Manus.space). Protetto dal middleware admin (cookie OAuth Google).
export const GET: APIRoute = async ({ url }) => {
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
  const codice = (url.searchParams.get('codice') ?? 'SHK-EAH2-KY3D').trim().toUpperCase();
  const piano = (url.searchParams.get('piano') ?? 'annuale') as RecordPro['piano'];

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Email non valida' }, 400);
  }
  if (!/^SHK-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codice)) {
    return json({ error: 'Codice deve essere SHK-XXXX-XXXX' }, 400);
  }
  if (!['mensile', 'semestrale', 'annuale'].includes(piano)) {
    return json({ error: 'Piano non valido' }, 400);
  }

  const mesi = piano === 'mensile' ? 1 : piano === 'semestrale' ? 6 : 12;
  const now = new Date();
  const scad = new Date(now);
  scad.setMonth(scad.getMonth() + mesi);

  const rec: RecordPro = {
    codice,
    email,
    piano,
    dataEmissione: now.toISOString(),
    dataScadenza: scad.toISOString(),
    paypalOrderId: 'MANUS-MIGRATION',
  };

  await salvaCodicePro(rec);

  return json({ ok: true, record: rec });
};
