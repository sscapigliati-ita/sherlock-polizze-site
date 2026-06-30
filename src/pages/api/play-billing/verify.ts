import type { APIRoute } from 'astro';
import { verifyInappPurchase, acknowledgePurchase } from '../../../lib/play-billing';
import {
  cercaPerPurchaseToken,
  salvaPurchaseTokenIndex,
  salvaCodicePro,
  type RecordPro,
} from '../../../lib/storage';
import { ga4TrackServer } from '../../../lib/ga4';

export const prerender = false;

const PRODOTTI_VALIDI = new Set(['founder_lifetime']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Data di scadenza "infinita" per i lifetime. Sentinella >> oraIso.
const SCADENZA_LIFETIME = '2099-12-31T23:59:59Z';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generaCodicePlay(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `PLAY-${hex}`;
}

export const POST: APIRoute = async ({ request }) => {
  let payload: { purchaseToken?: string; productId?: string; email?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'INVALID_BODY' }, 400);
  }

  const purchaseToken = (payload.purchaseToken ?? '').trim();
  const productId = (payload.productId ?? '').trim();
  const email = (payload.email ?? '').trim().toLowerCase();

  if (!purchaseToken) return json({ error: 'TOKEN_REQUIRED' }, 400);
  if (!PRODOTTI_VALIDI.has(productId)) return json({ error: 'INVALID_PRODUCT' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'EMAIL_REQUIRED' }, 400);

  // Idempotenza: se questo purchaseToken è già stato verificato, ritorna il
  // codice esistente (caso restore al boot, retry su rete, ecc.)
  const esistente = await cercaPerPurchaseToken(purchaseToken);
  if (esistente) {
    return json({
      codice: esistente.codice,
      piano: esistente.piano,
      dataScadenza: esistente.dataScadenza,
    });
  }

  // Verify lato server via Play Developer API
  const verify = await verifyInappPurchase(productId, purchaseToken);
  if ('errore' in verify) {
    const status = verify.status ?? 0;
    if (status === 410 || status === 404) return json({ error: 'INVALID_TOKEN' }, 400);
    return json({ error: 'PLAY_API_ERROR', detail: verify.errore }, 502);
  }
  if (verify.purchaseState !== 0) {
    return json({ error: 'TOKEN_NOT_PURCHASED', state: verify.purchaseState }, 400);
  }

  // Acknowledge solo se non già fatto. Se non ack entro 3gg, Play rimborsa
  // automaticamente — quindi farlo qui chiude il ciclo lato Google.
  if (verify.acknowledgementState === 0) {
    const ack = await acknowledgePurchase(productId, purchaseToken);
    if (!ack.ok) {
      return json({ error: 'ACK_FAILED', detail: ack.errore }, 502);
    }
  }

  // Emetti codice virtuale + salva record + indice token
  const codice = generaCodicePlay();
  const dataEmissione = new Date(
    parseInt(verify.purchaseTimeMillis, 10) || Date.now(),
  ).toISOString();
  const record: RecordPro = {
    codice,
    email,
    piano: 'founder',
    dataEmissione,
    dataScadenza: SCADENZA_LIFETIME,
    fonte: 'play',
    purchaseToken,
    playOrderId: verify.orderId,
  };
  await salvaCodicePro(record);
  await salvaPurchaseTokenIndex(purchaseToken, codice);

  void ga4TrackServer('play_billing_verified', purchaseToken.slice(0, 8), {
    product: productId,
    value: 19.9,
    currency: 'EUR',
  });

  return json({ codice, piano: 'founder', dataScadenza: SCADENZA_LIFETIME });
};
