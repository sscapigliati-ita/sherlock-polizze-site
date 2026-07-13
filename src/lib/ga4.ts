// GA4 Measurement Protocol — eventi server-side verso Google Analytics 4.
//
// PROPERTY DI DESTINAZIONE
// Al momento server-side punta a `PUBLIC_FIREBASE_MEASUREMENT_ID` (Firebase Analytics
// property "Sherlock — Detective Polizze", project sherlock-6f88c) perché
// `GA4_API_SECRET` è configurato solo per quella property. La property Ads
// `PUBLIC_GA4_ID` (G-21MQHMK771) riceve gli eventi solo dal gtag client-side.
//
// Conseguenza: Google Ads (collegato a G-21MQHMK771) NON riceve `purchase`
// server-side. Vedere ADS_ATTRIBUTION.md nel report della R3 per il fix
// (richiede env var separata `GA4_API_SECRET_ADS` + logica multi-property).
//
// REGOLE PRIVACY
// - No-op se GA4_API_SECRET / PUBLIC_FIREBASE_MEASUREMENT_ID non configurati.
// - No-op se il context non ha `analyticsStorage === 'granted'`.
// - No-op se il context non ha un `clientId` reale (nessun identificatore
//   inventato dal backend — orderId/requestId/hash email sono banditi).
// - `consent` field GA4 MP v2: ad_user_data / ad_personalization emessi
//   coerenti col context. `non_personalized_ads` è deprecato — non usato.

import {
  puoEmettereGa4,
  type AnalyticsContext,
  type ConsentValue,
} from './analytics-context';

type GA4EventParams = Record<string, string | number | boolean | undefined>;

// Struttura items per eventi ecommerce (purchase, add_to_cart, ecc.).
// GA4 Measurement Protocol richiede items come array di object, non stringa.
export type GA4Item = {
  item_id?: string;
  item_name?: string;
  item_category?: string;
  price?: number;
  quantity?: number;
  currency?: string;
};

// Formato accettato dal MP endpoint per il consent object.
// Ref: https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag
function toMPConsent(v: ConsentValue): 'GRANTED' | 'DENIED' {
  return v === 'granted' ? 'GRANTED' : 'DENIED';
}

/**
 * Invia un evento a GA4 via Measurement Protocol.
 *
 * @param eventName nome evento (snake_case, max 40 char)
 * @param context AnalyticsContext trasmesso dal client dopo consenso Analytics.
 *                DEVE contenere un clientId reale (da gtag('get', ID, 'client_id')).
 *                Se `null`/`undefined` o senza consenso → no-op (l'analisi/servizio
 *                principale continua a funzionare normalmente).
 * @param params parametri evento (max 25 per evento). Per eventi ecommerce (purchase),
 *               passare `items` separatamente per rispettare il formato GA4.
 * @param items array di GA4Item per eventi ecommerce.
 */
export async function ga4TrackServer(
  eventName: string,
  context: AnalyticsContext | null | undefined,
  params: GA4EventParams = {},
  items?: GA4Item[],
): Promise<void> {
  const measurementId = process.env.PUBLIC_FIREBASE_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return; // no-op se non configurato
  if (!eventName) return;
  if (!puoEmettereGa4(context)) return; // no-op senza consenso o senza clientId reale

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  const eventParams: Record<string, unknown> = { ...params };
  if (items && items.length > 0) {
    eventParams.items = items;
  }
  if (context.sessionId) {
    // session_id GA4 è necessario per collegare l'evento alla sessione web
    // (Realtime + attribution). Trasmesso come parametro evento standard.
    eventParams.session_id = context.sessionId;
    // engagement_time_msec > 0 è un requisito GA4 per contare la sessione come "engaged".
    if (typeof eventParams.engagement_time_msec !== 'number') {
      eventParams.engagement_time_msec = 1;
    }
  }

  const body = {
    client_id: context.clientId,
    consent: {
      ad_user_data: toMPConsent(context.consent.adUserData),
      ad_personalization: toMPConsent(context.consent.adPersonalization),
    },
    events: [{ name: eventName, params: eventParams }],
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Non bloccare mai il flusso applicativo per analytics fallita.
  }
}
