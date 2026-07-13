import type { APIRoute } from 'astro';
import { codiciAttiviPerEmail } from '../../lib/storage';
import { ga4TrackServer } from '../../lib/ga4';
import { sanitizeContext } from '../../lib/analytics-context';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let payload: { email?: string; _ga4Context?: unknown };
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

  // GA4 pro_status_lookup_success (rinominato da pro_activation).
  //
  // SEMANTICA: questo endpoint fa un LOOKUP di codici già attivi associati a
  // un'email, NON emette una nuova attivazione. Non è quindi una "conversione"
  // primaria — è un evento diagnostico che dice "l'utente ha recuperato con
  // successo il proprio codice". Usare come conversione porta a duplicati
  // (l'utente può fare il lookup 10 volte nella stessa sessione).
  //
  // La vera attivazione (transizione codice→attivo) avviene:
  // - lato server nel flow PayPal `capture-order` (evento `purchase`);
  // - lato client nell'app quando l'utente inserisce il codice e il backend
  //   lo valida (nessun evento server-side attualmente cablato — vedi report R3).
  //
  // Nessun dato personale inviato: no email, no hash email, no codice completo,
  // no dominio email, no frammenti. Solo il piano e la fonte.
  const ga4Ctx = sanitizeContext(payload._ga4Context);
  void ga4TrackServer('pro_status_lookup_success', ga4Ctx, {
    plan: r.piano,
    source: 'web_email_recovery',
  });

  return json({
    codice: r.codice,
    email: r.email,
    piano: r.piano,
    dataScadenza: r.dataScadenza,
  });
};
