import type { APIRoute } from 'astro';
import { creaOrdinePayPal, PIANI, type PianoId } from '../../../lib/paypal';

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
    return json({ error: 'Piano non valido (usa mensile|semestrale|annuale)' }, 400);
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Email non valida' }, 400);
  }

  const origin = `${url.protocol}//${url.host}`;
  const returnUrl = `${origin}/abbonamento/conferma`;
  const cancelUrl = `${origin}/abbonamento/${piano}?annullato=1`;

  try {
    const { orderId, approveUrl } = await creaOrdinePayPal({
      piano,
      email,
      returnUrl,
      cancelUrl,
    });
    return json({ orderId, approveUrl, piano, email });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Errore PayPal' }, 502);
  }
};
