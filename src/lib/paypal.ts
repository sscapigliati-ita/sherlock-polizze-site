function getEnv(name: string): string | undefined {
  return (import.meta.env[name] ?? process.env[name]) as string | undefined;
}

function getMode(): 'live' | 'sandbox' {
  const m = (getEnv('PAYPAL_MODE') ?? 'live').toLowerCase();
  return m === 'sandbox' ? 'sandbox' : 'live';
}

function baseApi(): string {
  return getMode() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

export type PianoId = 'mensile' | 'semestrale' | 'annuale' | 'singolo' | 'founder';
export type TipoCodice = 'pro' | 'singolo';

export const PIANI: Record<
  PianoId,
  { nome: string; prezzo: string; durataMesi: number; tipo: TipoCodice }
> = {
  mensile: { nome: 'Pass Pro 1 mese', prezzo: '2.99', durataMesi: 1, tipo: 'pro' },
  semestrale: { nome: 'Pass Pro 6 mesi', prezzo: '7.99', durataMesi: 6, tipo: 'pro' },
  annuale: { nome: 'Pass Pro 12 mesi', prezzo: '14.99', durataMesi: 12, tipo: 'pro' },
  // Acquisto una-tantum: consulenza completa (analisi + 1 lettera generata).
  // Il codice è usa-e-getta sulla lettera; l'analisi è comunque gratuita per
  // definizione ma il codice funge da titolo d'accesso alla sessione completa
  // (utilizzabile sia dall'app che da /consulenza sul web). Validità 30 giorni.
  singolo: { nome: 'Consulenza singola', prezzo: '3.99', durataMesi: 1, tipo: 'singolo' },
  // Founder lifetime: pagamento singolo, accesso Pro "per sempre". Numero
  // limitato — vedi FOUNDER_MAX. Quando esauriti, /api/paypal/create-order
  // rifiuta nuovi acquisti founder.
  founder: { nome: 'Pass Pro a vita (Founder)', prezzo: '19.90', durataMesi: 1200, tipo: 'pro' },
};

// Limite assoluto di codici Founder vendibili. Quando il counter KV
// 'count:founder:venduti' raggiunge questo valore, l'offerta è chiusa.
export const FOUNDER_MAX = 50;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value;
  }

  const clientId = getEnv('PAYPAL_CLIENT_ID');
  const secret = getEnv('PAYPAL_SECRET');
  if (!clientId || !secret) {
    throw new Error('PAYPAL_CLIENT_ID o PAYPAL_SECRET mancanti');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const r = await fetch(`${baseApi()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error_description ?? 'PayPal auth fallita');

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 32000) * 1000,
  };
  return cachedToken.value;
}

export async function creaOrdinePayPal(opts: {
  piano: PianoId;
  email: string;
  returnUrl: string;
  cancelUrl: string;
  ref?: string; // codice referrer opzionale
}): Promise<{ orderId: string; approveUrl: string }> {
  const token = await getAccessToken();
  const dettaglio = PIANI[opts.piano];

  // custom_id propaga email + (opzionale) referrer al capture.
  // Formato: "<email>" oppure "<email>|ref:<CODICE>"
  // Limite PayPal: 127 caratteri. Email può essere fino a 254, ma in pratica
  // sotto i 80; un codice referral aggiunge ~20 char → safe.
  const refSegment = opts.ref ? `|ref:${opts.ref.trim().toUpperCase().slice(0, 20)}` : '';
  const customId = (opts.email + refSegment).slice(0, 127);

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: opts.piano,
        custom_id: customId,
        description: `Sherlock Pro - piano ${dettaglio.nome}`,
        amount: {
          currency_code: 'EUR',
          value: dettaglio.prezzo,
        },
      },
    ],
    payer: {
      email_address: opts.email,
    },
    application_context: {
      brand_name: 'Sherlock',
      locale: 'it-IT',
      user_action: 'PAY_NOW',
      return_url: opts.returnUrl,
      cancel_url: opts.cancelUrl,
    },
  };

  const r = await fetch(`${baseApi()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.message ?? 'PayPal createOrder fallita');

  const approveLink = data.links?.find((l: any) => l.rel === 'approve' || l.rel === 'payer-action');
  if (!approveLink?.href) throw new Error('Approve link mancante dalla risposta PayPal');

  return { orderId: data.id, approveUrl: approveLink.href };
}

export type CaptureResult = {
  status: string;
  email: string;
  piano: PianoId;
  ref?: string; // codice referrer, se presente nel custom_id
  captureId?: string; // ID univoco della capture PayPal (per idempotenza e reconciliation)
};

// Namespace UUID stabile per Sherlock (RFC 4122 § 4.3). Serve come radice
// deterministica per generare UUID v5 relativi a operazioni PayPal. Non è un
// secret: è pubblico by design ed è ciò che permette a due retry di produrre
// lo stesso UUID senza dover coordinare stato tra invocazioni serverless.
// Valore scelto a partire dal DNS namespace RFC 4122 (unmodified — è convenzionale).
const SHERLOCK_PP_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Parsing UUID "8-4-4-4-12" in 16 byte binari.
function parseUuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error('UUID non valido');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Formatta 16 byte come UUID canonico "8-4-4-4-12" (36 char totali).
function bytesToUuid(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  );
}

// UUID v5 deterministic: SHA-1(namespace_bytes || name_bytes), primi 16 byte,
// con version=5 (byte 6) e variant=10 (byte 8) impostati secondo RFC 4122 § 4.3.
async function uuidV5(name: string, namespace: string): Promise<string> {
  const ns = parseUuidToBytes(namespace);
  const nm = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns, 0);
  buf.set(nm, ns.length);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  const b = new Uint8Array(hash).slice(0, 16);
  // Version bits (byte 6): 0101_xxxx → 5
  b[6] = (b[6] & 0x0f) | 0x50;
  // Variant bits (byte 8): 10_xxxxxx → RFC 4122 variant
  b[8] = (b[8] & 0x3f) | 0x80;
  return bytesToUuid(b);
}

// Genera un PayPal-Request-Id deterministico per una specifica (orderId, operazione).
// Formato: UUID v5 canonico "xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx" (36 char < 38
// limite PayPal). Ogni retry dello stesso capture usa lo stesso Request-Id →
// PayPal restituisce la stessa risposta (idempotency guarantee lato PayPal).
//
// Il name include un tag semantico dell'operazione (`capture`, `create`, ecc.) →
// operazioni diverse sullo stesso orderId producono UUID diversi.
export async function paypalRequestId(
  orderId: string,
  operazione: 'capture' | 'create' | 'refund',
): Promise<string> {
  return uuidV5(`${orderId}:${operazione}:sherlock`, SHERLOCK_PP_NAMESPACE);
}

export async function catturaOrdinePayPal(orderId: string): Promise<CaptureResult> {
  const token = await getAccessToken();
  const requestId = await paypalRequestId(orderId, 'capture');

  const r = await fetch(`${baseApi()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Idempotency di PayPal: retry con stesso Request-Id restituisce la stessa
      // risposta senza doppia capture. Evita doppio addebito sull'utente in
      // scenari di rete instabile o webhook duplicati.
      'PayPal-Request-Id': requestId,
    },
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.message ?? 'PayPal capture fallita');

  const unit = data.purchase_units?.[0];
  const piano = (unit?.reference_id ?? 'mensile') as PianoId;
  // captureId: identificativo univoco della singola capture (diverso dall'orderId).
  // Serve per idempotenza server-side (KV: purchase:paypal:capture:<captureId>) e
  // per reconciliation con webhook PAYMENT.CAPTURE.COMPLETED PayPal.
  const captureId: string | undefined = unit?.payments?.captures?.[0]?.id;
  const customIdRaw: string =
    unit?.custom_id ??
    data?.payer?.email_address ??
    unit?.payments?.captures?.[0]?.payer?.email_address ??
    '';
  // Parsing custom_id: "<email>" o "<email>|ref:<CODICE>"
  let email = customIdRaw;
  let ref: string | undefined;
  const refMatch = customIdRaw.match(/^(.+)\|ref:([A-Z0-9-]+)$/i);
  if (refMatch) {
    email = refMatch[1];
    ref = refMatch[2].toUpperCase();
  }

  return {
    status: data.status ?? 'UNKNOWN',
    email,
    piano,
    ref,
    captureId,
  };
}

export function calcolaScadenza(piano: PianoId, da: Date = new Date()): string {
  const d = new Date(da);
  d.setMonth(d.getMonth() + PIANI[piano].durataMesi);
  return d.toISOString();
}
