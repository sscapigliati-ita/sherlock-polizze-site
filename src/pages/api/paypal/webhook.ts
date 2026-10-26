import type { APIRoute } from 'astro';
import { verificaWebhookPayPal } from '../../../lib/paypal';
import { evadiOrdinePayPal } from '../../../lib/paypal-fulfill';

export const prerender = false;

// Webhook PayPal: rete di sicurezza per i pagamenti approvati dal cliente che
// non torna sulla pagina /abbonamento/conferma (scheda chiusa, errore di rete,
// ad-blocker). Senza, l'ordine resta approvato ma non incassato: nessun
// addebito, nessun codice, nessuna mail.
//
// Eventi gestiti (da sottoscrivere nella dashboard developer PayPal):
//  - CHECKOUT.ORDER.APPROVED     → cattura l'ordine e emette il codice
//  - PAYMENT.CAPTURE.COMPLETED   → emette il codice se non già fatto
// Tutto passa da evadiOrdinePayPal, idempotente: non duplica mai codici/mail.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function orderIdDaEvento(evento: any): string {
  if (evento?.event_type === 'CHECKOUT.ORDER.APPROVED') {
    return String(evento?.resource?.id ?? '');
  }
  if (evento?.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    return String(evento?.resource?.supplementary_data?.related_ids?.order_id ?? '');
  }
  return '';
}

export const POST: APIRoute = async ({ request }) => {
  let evento: any;
  try {
    evento = await request.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  let valido = false;
  try {
    valido = await verificaWebhookPayPal(request.headers, evento);
  } catch (e: any) {
    console.error('[paypal-webhook] verifica firma fallita:', e?.message);
  }
  if (!valido) return json({ error: 'Firma non valida' }, 401);

  const orderId = orderIdDaEvento(evento);
  if (!orderId) return json({ ignored: evento?.event_type ?? 'unknown' }, 200);

  const esito = await evadiOrdinePayPal(orderId);
  console.log(`[paypal-webhook] ${evento.event_type} ordine ${orderId} → ${esito.status}`);
  // 2xx/4xx definitivi: PayPal non ritenta. 5xx e 202 (recupero in corso) →
  // rispondiamo 500 così PayPal ritenta il webhook con backoff.
  if (esito.status >= 500 || esito.status === 202) {
    return json({ error: 'Evasione non completata, riprovare' }, 500);
  }
  return json({ ok: true, status: esito.status });
};
