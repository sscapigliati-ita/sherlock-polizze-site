import type { APIRoute } from 'astro';
import { codiciAttiviPerEmail } from '../../lib/storage';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let payload: { email?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const email = (payload.email ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Email non valida' }, 400);
  }

  const records = await codiciAttiviPerEmail(email);
  if (records.length === 0) {
    return json(
      {
        error:
          "Nessun abbonamento attivo trovato per questa email. Verifica che sia la stessa usata per il pagamento PayPal, oppure inserisci manualmente il codice ricevuto via email.",
      },
      404,
    );
  }

  // Restituisce il più recente — di solito quello che l'utente vuole usare
  const r = records[0];
  return json({
    codice: r.codice,
    email: r.email,
    piano: r.piano,
    dataScadenza: r.dataScadenza,
  });
};
