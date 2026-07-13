// GA4 Measurement Protocol — eventi server-side verso Google Analytics 4.
// Si attiva solo se entrambe le env vars sono settate:
//   PUBLIC_FIREBASE_MEASUREMENT_ID   (es. G-XXXXXXXXXX)
//   GA4_API_SECRET                   (Firebase → Admin → Data Streams → Web → "Measurement Protocol API secrets" → Create)
// Senza una delle due, la funzione è no-op (nessun errore, nessuna richiesta).

type GA4EventParams = Record<string, string | number | boolean | undefined>;

// Struttura items per eventi ecommerce (purchase, add_to_cart, ecc.).
// GA4 Measurement Protocol richiede items come array di object, non stringa.
// Se serializzato come string, il report ecommerce di GA4 non popola item_id / item_name.
export type GA4Item = {
  item_id?: string;
  item_name?: string;
  item_category?: string;
  price?: number;
  quantity?: number;
  currency?: string;
};

/**
 * Invia un evento a GA4 via Measurement Protocol.
 * @param eventName nome evento (snake_case, max 40 char)
 * @param clientId identificatore deterministico per la sessione/transazione (es. orderId PayPal).
 *                 Userà sempre lo stesso clientId per la stessa transazione → eventi correlati.
 *                 NOTA: usare orderId lo fa apparire come nuovo utente ad ogni transazione, quindi
 *                 l'attribuzione cross-session Google Ads è limitata. Migliorabile solo con userId
 *                 stabile lato client.
 * @param params parametri evento (max 25 per evento). Per eventi ecommerce (purchase),
 *               passare items separatamente per rispettare il formato GA4.
 * @param items array di GA4Item per eventi ecommerce. Rimane undefined per eventi non-ecommerce.
 */
export async function ga4TrackServer(
  eventName: string,
  clientId: string,
  params: GA4EventParams = {},
  items?: GA4Item[],
): Promise<void> {
  const measurementId = process.env.PUBLIC_FIREBASE_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return; // no-op se non configurato
  if (!eventName || !clientId) return;

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  // Costruisci params GA4-compatibili: items come array reale se presente.
  const eventParams: Record<string, unknown> = { ...params };
  if (items && items.length > 0) {
    eventParams.items = items;
  }
  const body = {
    client_id: clientId,
    non_personalized_ads: true,
    events: [{ name: eventName, params: eventParams }],
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
