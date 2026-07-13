import type { APIRoute } from 'astro';
import { creaOrdinePayPal, PIANI, FOUNDER_MAX, type PianoId } from '../../../lib/paypal';
import { contaFounderVenduti, salvaPayPalGa4Context } from '../../../lib/storage';
import { ga4TrackServer } from '../../../lib/ga4';
import { sanitizeContext } from '../../../lib/analytics-context';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, url }) => {
  let payload: { piano?: string; email?: string; ref?: string; _ga4Context?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const piano = payload.piano as PianoId;
  const email = (payload.email ?? '').trim().toLowerCase();
  // Referrer opzionale: deve essere un codice ben formato (checksum verificato
  // al capture per non duplicare lavoro qui). Se vuoto/invalido, lo ignoro.
  const refRaw = (payload.ref ?? '').trim().toUpperCase();
  const ref = /^SHK-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(refRaw) ? refRaw : undefined;

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
      ref,
    });
    // Salva il context Analytics associato all'ordine (24h TTL) per poterlo
    // rileggere in capture-order e emettere `purchase` server-side con il vero
    // GA4 client_id + session_id della sessione di acquisto — non un
    // identificatore inventato dal backend.
    const ga4Ctx = sanitizeContext(payload._ga4Context);
    if (ga4Ctx) {
      await salvaPayPalGa4Context(orderId, ga4Ctx).catch(() => undefined);
    }
    const valore = Number(PIANI[piano]?.prezzo) || 0;
    // Eventi diagnostici emessi solo se abbiamo un context valido.
    void ga4TrackServer('paypal_redirect', ga4Ctx, {
      piano,
      value: valore,
      currency: 'EUR',
      has_ref: ref ? 1 : 0,
    });
    void ga4TrackServer('checkout_started', ga4Ctx, {
      piano,
      value: valore,
      currency: 'EUR',
    });
    return json({ orderId, approveUrl, piano, email });
  } catch (e: any) {
    // paypal_create_error: fallimento pre-ordine. Emesso solo se abbiamo un
    // context valido (con consenso e clientId reale) — l'errore non deve mai
    // creare eventi identificabili senza consenso.
    const ga4CtxErr = sanitizeContext(payload._ga4Context);
    void ga4TrackServer('paypal_create_error', ga4CtxErr, {
      piano,
      reason: String(e?.message || 'unknown').slice(0, 100),
    });
    return json({ error: e?.message ?? 'Errore PayPal' }, 502);
  }
};
