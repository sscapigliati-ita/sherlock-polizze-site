import type { APIRoute } from 'astro';
import { creaOrdinePayPal, PIANI, FOUNDER_MAX, type PianoId } from '../../../lib/paypal';
import { contaFounderVenduti } from '../../../lib/storage';
import { ga4TrackServer } from '../../../lib/ga4';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, url }) => {
  let payload: { piano?: string; email?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const piano = payload.piano as PianoId;
  const email = (payload.email ?? '').trim().toLowerCase();

  if (!piano || !(piano in PIANI)) {
    return json({ error: 'Piano non valido (usa mensile|semestrale|annuale|singolo|founder)' }, 400);
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Email non valida' }, 400);
  }

  // Founder è a tiratura limitata: blocco la creazione ordine se già esauriti.
  // Atto preventivo, non atomico — il check definitivo è nel capture-order.
  if (piano === 'founder') {
    const venduti = await contaFounderVenduti();
    if (venduti >= FOUNDER_MAX) {
      return json({
        error: `Offerta Founder esaurita (${FOUNDER_MAX}/${FOUNDER_MAX}). Resta disponibile il piano annuale a 14,99€.`,
      }, 410);
    }
  }

  const origin = `${url.protocol}//${url.host}`;
  // I singoli usano una pagina di conferma dedicata; Founder e Pro
  // condividono la stessa conferma generica.
  const returnUrl = piano === 'singolo'
    ? `${origin}/reclamo-singolo/conferma`
    : `${origin}/abbonamento/conferma`;
  const cancelUrl = piano === 'singolo'
    ? `${origin}/reclamo-singolo?annullato=1`
    : piano === 'founder'
      ? `${origin}/abbonati?annullato=founder`
      : `${origin}/abbonamento/${piano}?annullato=1`;

  try {
    const { orderId, approveUrl } = await creaOrdinePayPal({
      piano,
      email,
      returnUrl,
      cancelUrl,
    });
    void ga4TrackServer('paypal_redirect', orderId, { piano, value: PIANI[piano]?.prezzo || 0, currency: 'EUR' });
    return json({ orderId, approveUrl, piano, email });
  } catch (e: any) {
    void ga4TrackServer('paypal_create_error', email || 'unknown', { piano, reason: String(e?.message || 'unknown').slice(0, 100) });
    return json({ error: e?.message ?? 'Errore PayPal' }, 502);
  }
};
