import type { APIRoute } from 'astro';
import { verifyInappPurchase, acknowledgePurchase } from '../../../lib/play-billing';
import {
  cercaPerPurchaseToken,
  salvaPurchaseTokenIndex,
  salvaCodicePro,
  incrementaFounderVenduti,
  type RecordPro,
} from '../../../lib/storage';
import { ga4TrackServer } from '../../../lib/ga4';
import { generaCodicePro } from '../../../lib/codici';

export const prerender = false;

// Mappa productId Play → configurazione lato server. Founder è lifetime,
// acquisto_singolo è una-tantum (consulenza singola: analisi + 1 lettera).
type MappaProdotto = {
  piano: RecordPro['piano'];
  prezzoEur: number;
  durataMesi: number; // 1200 per lifetime
};
const MAPPA_PRODOTTI: Record<string, MappaProdotto> = {
  founder_lifetime: { piano: 'founder', prezzoEur: 19.9, durataMesi: 1200 },
  acquisto_singolo: { piano: 'singolo', prezzoEur: 4.99, durataMesi: 1 },
};
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SCADENZA_LIFETIME = '2099-12-31T23:59:59Z';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function calcolaScadenzaIso(mesi: number, daIso: string): string {
  if (mesi >= 1200) return SCADENZA_LIFETIME;
  const d = new Date(daIso);
  d.setMonth(d.getMonth() + mesi);
  return d.toISOString();
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
  const prodotto = MAPPA_PRODOTTI[productId];
  if (!prodotto) return json({ error: 'INVALID_PRODUCT' }, 400);
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

  // Emetti codice virtuale in formato SHK-XXXX-XXXX (checksum compatibile con
  // valutaCodice/lettera.ts) + salva record + indice token per idempotenza.
  const codice = generaCodicePro();
  const dataEmissione = new Date(
    parseInt(verify.purchaseTimeMillis, 10) || Date.now(),
  ).toISOString();
  const dataScadenza = calcolaScadenzaIso(prodotto.durataMesi, dataEmissione);
  const isTestPurchase = verify.purchaseType === 0;
  const commercialStatus = isTestPurchase ? 'test' : 'reale';
  const record: RecordPro = {
    codice,
    email,
    piano: prodotto.piano,
    dataEmissione,
    dataScadenza,
    fonte: 'play',
    purchaseToken,
    playOrderId: verify.orderId,
    commercialStatus,
    commercialStatusReason: isTestPurchase ? 'google_play_license_test' : 'google_play_verified',
    commercialStatusUpdatedAt: new Date().toISOString(),
    paymentEnvironment: isTestPurchase ? 'test' : 'production',
  };
  await salvaCodicePro(record);
  await salvaPurchaseTokenIndex(purchaseToken, codice);

  // Founder venduto via Play — incrementa contatore condiviso con flusso PayPal.
  // Solo per il piano 'founder': i codici singoli non toccano il counter.
  if (prodotto.piano === 'founder' && commercialStatus === 'reale') {
    await incrementaFounderVenduti().catch(() => undefined);
  }

  // GA4 play_billing_verified: no-op finché l'app Android non trasmette un
  // context Analytics reale (Firebase app_instance_id via bridge). Il vecchio
  // codice usava purchaseToken.slice(0,8) come client_id — inventato dal
  // backend, semanticamente errato. Vedi report R3/R4 per il piano di
  // migrazione. L'evento Play Billing lato app è comunque emesso via Firebase
  // Analytics client-side (SDK Firebase nativa Android).
  //
  // Stream 'firebase' esplicito: se in futuro l'app trasmettesse app_instance_id
  // come clientId, questo evento andrebbe alla proprietà Firebase (non alla
  // proprietà Ads web che si aspetta client_id GA4 web).
  if (commercialStatus === 'reale') {
    void ga4TrackServer(
      'play_billing_verified',
      null,
      {
        product: productId,
        piano: prodotto.piano,
        value: prodotto.prezzoEur,
        currency: 'EUR',
      },
      undefined,
      'firebase',
    );
  }

  return json({ codice, piano: prodotto.piano, dataScadenza });
};
