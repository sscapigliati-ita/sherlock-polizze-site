import type { APIRoute } from 'astro';
import { catturaOrdinePayPal, calcolaScadenza, PIANI } from '../../../lib/paypal';
import { generaCodicePro } from '../../../lib/codici';
import { salvaCodicePro, incrementaFounderVenduti } from '../../../lib/storage';
import { inviaMailCodice } from '../../../lib/mail';
import { ga4TrackServer } from '../../../lib/ga4';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let payload: { orderId?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const orderId = (payload.orderId ?? '').trim();
  if (!orderId) {
    return json({ error: 'orderId richiesto' }, 400);
  }

  let cattura;
  try {
    cattura = await catturaOrdinePayPal(orderId);
  } catch (e: any) {
    void ga4TrackServer('paypal_cancel', orderId, { reason: String(e?.message || 'capture_failed').slice(0, 100) });
    return json({ error: e?.message ?? 'Errore cattura PayPal' }, 502);
  }

  if (cattura.status !== 'COMPLETED' && cattura.status !== 'APPROVED') {
    void ga4TrackServer('paypal_cancel', orderId, { reason: 'status_' + cattura.status });
    return json({ error: `Pagamento non completato (status: ${cattura.status})` }, 402);
  }

  const codice = generaCodicePro();
  const dataEmissione = new Date().toISOString();
  const dataScadenza = calcolaScadenza(cattura.piano, new Date(dataEmissione));
  const isSingolo = cattura.piano === 'singolo';

  await salvaCodicePro({
    codice,
    email: cattura.email,
    piano: cattura.piano,
    dataEmissione,
    dataScadenza,
    paypalOrderId: orderId,
    ...(isSingolo ? { usato: false } : {}),
  });

  // Founder: incrementa il counter (sblocca la chiusura dell'offerta a FOUNDER_MAX)
  if (cattura.piano === 'founder') {
    await incrementaFounderVenduti().catch(() => undefined);
  }

  const mail = await inviaMailCodice({
    email: cattura.email,
    codice,
    piano: PIANI[cattura.piano].nome,
    dataScadenza,
    tipo: PIANI[cattura.piano].tipo,
  });

  void ga4TrackServer('purchase', orderId, {
    transaction_id: orderId,
    value: PIANI[cattura.piano]?.prezzo || 0,
    currency: 'EUR',
    items: JSON.stringify([{ item_id: cattura.piano, item_name: PIANI[cattura.piano]?.nome || cattura.piano }]).slice(0, 100),
    piano: cattura.piano,
    mail_sent: mail.ok ? 1 : 0,
  });
  void ga4TrackServer('paypal_success', orderId, { piano: cattura.piano });

  return json({
    codice,
    piano: cattura.piano,
    email: cattura.email,
    dataScadenza,
    mailInviata: mail.ok,
    mailError: mail.ok ? undefined : mail.error,
  });
};
