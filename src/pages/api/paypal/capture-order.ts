import type { APIRoute } from 'astro';
import { catturaOrdinePayPal, calcolaScadenza, PIANI } from '../../../lib/paypal';
import { generaCodicePro } from '../../../lib/codici';
import {
  salvaCodicePro,
  incrementaFounderVenduti,
  leggiCodicePro,
  registraReferralAcquisto,
  estendiScadenza,
  cercaPerPayPalOrderId,
  registraPayPalOrderId,
} from '../../../lib/storage';
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

  // ==== Idempotenza (refresh pagina conferma, doppio clic, retry) ====
  // Se questo orderId è già stato processato, restituisci il codice esistente
  // SENZA: (a) richiamare PayPal capture, (b) generare nuovo codice, (c)
  // incrementare founder counter, (d) inviare mail, (e) inviare eventi GA4.
  const esistente = await cercaPerPayPalOrderId(orderId).catch(() => null);
  if (esistente) {
    return json({
      codice: esistente.codice,
      piano: esistente.piano,
      email: esistente.email,
      dataScadenza: esistente.dataScadenza,
      mailInviata: true, // se il record esiste, la prima esecuzione aveva già gestito la mail
      idempotent: true,
    });
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

  // Registra atomicamente l'associazione orderId->codice PRIMA di ogni side
  // effect (mail, founder counter, GA4). Se un'altra invocazione parallela
  // ha già registrato l'orderId, restituiamo il codice esistente invece di
  // generarne uno secondo. In pratica gestisce race condition tra capture
  // PayPal simultanea da 2 tab / doppio clic.
  const registrato = await registraPayPalOrderId(orderId, codice).catch(() => true);
  if (!registrato) {
    const gia = await cercaPerPayPalOrderId(orderId).catch(() => null);
    if (gia) {
      return json({
        codice: gia.codice,
        piano: gia.piano,
        email: gia.email,
        dataScadenza: gia.dataScadenza,
        mailInviata: true,
        idempotent: true,
      });
    }
  }
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

  // ===== Referral best-effort =====
  // Se il custom_id includeva ref:<CODICE>, e quel codice esiste come Pro
  // valido (escluso il referrer = se stesso e i singoli/usati), accredito
  // 30gg di estensione e incremento il counter referral. Idempotente sull'orderId.
  let refApplicato: { referrer: string; nuovaScadenza?: string } | undefined;
  if (cattura.ref && cattura.ref !== codice) {
    try {
      const referrer = await leggiCodicePro(cattura.ref);
      const validoReferrer = referrer
        && referrer.piano !== 'singolo'
        && referrer.email.toLowerCase() !== cattura.email.toLowerCase();
      if (validoReferrer) {
        const primo = await registraReferralAcquisto(cattura.ref, orderId);
        if (primo) {
          const ext = await estendiScadenza(cattura.ref, 1);
          refApplicato = { referrer: cattura.ref, nuovaScadenza: ext.nuovaScadenza };
          void ga4TrackServer('referral_bonus_applied', orderId, {
            referrer_code: cattura.ref,
            new_buyer_email: cattura.email,
            piano: cattura.piano,
          });
        }
      }
    } catch {
      // Fallimento del referral non blocca mai l'acquisto principale.
    }
  }

  const mail = await inviaMailCodice({
    email: cattura.email,
    codice,
    piano: PIANI[cattura.piano].nome,
    dataScadenza,
    tipo: PIANI[cattura.piano].tipo,
  });

  void ga4TrackServer(
    'purchase',
    orderId,
    {
      transaction_id: orderId,
      value: Number(PIANI[cattura.piano]?.prezzo) || 0,
      currency: 'EUR',
      piano: cattura.piano,
      mail_sent: mail.ok ? 1 : 0,
    },
    [
      {
        item_id: cattura.piano,
        item_name: PIANI[cattura.piano]?.nome || cattura.piano,
        item_category: cattura.piano === 'singolo' ? 'consulenza' : 'abbonamento',
        price: Number(PIANI[cattura.piano]?.prezzo) || 0,
        quantity: 1,
        currency: 'EUR',
      },
    ],
  );
  void ga4TrackServer('paypal_success', orderId, { piano: cattura.piano });
  void ga4TrackServer('payment_completed', orderId, {
    piano: cattura.piano,
    value: PIANI[cattura.piano]?.prezzo || 0,
    currency: 'EUR',
  });

  return json({
    codice,
    piano: cattura.piano,
    email: cattura.email,
    dataScadenza,
    mailInviata: mail.ok,
    mailError: mail.ok ? undefined : mail.error,
    referralApplicato: refApplicato ? true : false,
  });
};
