import type { APIRoute } from 'astro';
import { codiciAttiviPerEmail } from '../../lib/storage';
import { ga4TrackServer } from '../../lib/ga4';

export const prerender = false;

// Genera un client_id GA4 deterministico ma non tracciabile alla persona.
// Hash SHA-256 troncato dell'email — stesso utente per lo stesso device
// (attribuzione coerente cross-session), ma non permette reverse-lookup
// dell'email dal solo hash.
async function clientIdFromEmail(email: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode(email.toLowerCase().trim() + ':pro_act');
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const arr = Array.from(new Uint8Array(buf));
    return arr.slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'pro_act_unknown';
  }
}

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

  // GA4 pro_activation: scatta SOLO quando il backend ha effettivamente
  // trovato e restituito un codice valido (non su email invalida ne'
  // sul semplice tentativo). Non inviamo il codice completo ne' l'email
  // in chiaro — solo un client_id derivato per attribuzione coerente.
  const cid = await clientIdFromEmail(email);
  void ga4TrackServer('pro_activation', cid, {
    activation_type: 'email_recovery',
    plan: r.piano,
    source: 'web',
  });

  return json({
    codice: r.codice,
    email: r.email,
    piano: r.piano,
    dataScadenza: r.dataScadenza,
  });
};
