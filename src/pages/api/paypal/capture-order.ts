import type { APIRoute } from 'astro';
import { catturaOrdinePayPal, calcolaScadenza, PIANI } from '../../../lib/paypal';
import { generaCodicePro } from '../../../lib/codici';
import { salvaCodicePro } from '../../../lib/storage';
import { inviaMailCodice } from '../../../lib/mail';

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
    return json({ error: e?.message ?? 'Errore cattura PayPal' }, 502);
  }

  if (cattura.status !== 'COMPLETED' && cattura.status !== 'APPROVED') {
    return json({ error: `Pagamento non completato (status: ${cattura.status})` }, 402);
  }

  const codice = generaCodicePro();
  const dataEmissione = new Date().toISOString();
  const dataScadenza = calcolaScadenza(cattura.piano, new Date(dataEmissione));

  await salvaCodicePro({
    codice,
    email: cattura.email,
    piano: cattura.piano,
    dataEmissione,
    dataScadenza,
    paypalOrderId: orderId,
  });

  const mail = await inviaMailCodice({
    email: cattura.email,
    codice,
    piano: PIANI[cattura.piano].nome,
    dataScadenza,
  });

  return json({
    codice,
    piano: cattura.piano,
    email: cattura.email,
    dataScadenza,
    mailInviata: mail.ok,
    mailError: mail.ok ? undefined : mail.error,
  });
};
