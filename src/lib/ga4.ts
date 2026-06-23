// GA4 Measurement Protocol — eventi server-side verso Google Analytics 4.
// Si attiva solo se entrambe le env vars sono settate:
//   PUBLIC_FIREBASE_MEASUREMENT_ID   (es. G-XXXXXXXXXX)
//   GA4_API_SECRET                   (Firebase → Admin → Data Streams → Web → "Measurement Protocol API secrets" → Create)
// Senza una delle due, la funzione è no-op (nessun errore, nessuna richiesta).

type GA4EventParams = Record<string, string | number | boolean | undefined>;

/**
 * Invia un evento a GA4 via Measurement Protocol.
 * @param eventName nome evento (snake_case, max 40 char)
 * @param clientId identificatore deterministico per la sessione/transazione (es. orderId PayPal).
 *                 Userà sempre lo stesso clientId per la stessa transazione → eventi correlati.
 * @param params parametri evento (max 25 per evento)
 */
export async function ga4TrackServer(
  eventName: string,
  clientId: string,
  params: GA4EventParams = {},
): Promise<void> {
  const measurementId = process.env.PUBLIC_FIREBASE_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return; // no-op se non configurato
  if (!eventName || !clientId) return;

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const body = {
    client_id: clientId,
    non_personalized_ads: true,
    events: [{ name: eventName, params }],
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // non bloccare mai il flusso applicativo per analytics fallita
  }
}
