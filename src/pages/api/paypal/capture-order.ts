import type { APIRoute } from 'astro';
import { evadiOrdinePayPal } from '../../../lib/paypal-fulfill';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let payload: { orderId?: string; _ga4Context?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const esito = await evadiOrdinePayPal(payload.orderId ?? '');
  return json(esito.body, esito.status);
};
