// GA4 Measurement Protocol — eventi server-side verso Google Analytics 4.
//
// DUE PROPRIETÀ DISTINTE (R4)
// - stream 'web'      → GA4_WEB_MEASUREMENT_ID + GA4_WEB_API_SECRET
//                       Proprietà "Sherlock Polizze Web" collegata a Google Ads.
//                       Riceve gli eventi di conversione web: purchase,
//                       analysis_complete, checkout_started, paypal_redirect, ecc.
// - stream 'firebase' → GA4_FIREBASE_MEASUREMENT_ID + GA4_FIREBASE_API_SECRET
//                       Proprietà Firebase (project sherlock-6f88c). Legacy
//                       property per eventi app Android nativa (nomi legacy
//                       play_store_click, app_open_click, ecc.). Non collegata
//                       a Google Ads.
//                       Retrocompatibilità: se GA4_FIREBASE_* mancano, fallback
//                       a PUBLIC_FIREBASE_MEASUREMENT_ID + GA4_API_SECRET
//                       (nomi precedenti l'audit R4).
//
// L'API secret è SEMPRE server-side (mai nel bundle client). Le due proprietà
// hanno secret INDIPENDENTI per limitare l'impatto di una eventuale compromissione.
//
// REGOLE PRIVACY (invariate dopo R3)
// - No-op se stream config non presente (env vars mancanti).
// - No-op se il context non ha `analyticsStorage === 'granted'`.
// - No-op se il context non ha un `clientId` reale (nessun identificatore
//   inventato dal backend — orderId/requestId/hash email sono banditi).
// - `consent` field GA4 MP v2: ad_user_data / ad_personalization coerenti col
//   context. `non_personalized_ads` deprecato — non usato.

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

export type GA4Stream = 'web' | 'firebase';

interface StreamConfig {
  measurementId: string;
  apiSecret: string;
}

// Legge la configurazione per lo stream richiesto. Ritorna null se le env vars
// necessarie non sono presenti (in dev o preview senza secret configurati).
export function getStreamConfig(stream: GA4Stream): StreamConfig | null {
  if (stream === 'web') {
    // Stream web collegato a Google Ads. Nessun fallback silente: se non
    // configurato, gli eventi non partono (evita di mandarli alla proprietà
    // sbagliata per errore).
    const measurementId = process.env.GA4_WEB_MEASUREMENT_ID;
    const apiSecret = process.env.GA4_WEB_API_SECRET;
    if (!measurementId || !apiSecret) return null;
    return { measurementId, apiSecret };
  }
  // Stream firebase con retrocompatibilità sulle env vars pre-R4.
  const measurementId =
    process.env.GA4_FIREBASE_MEASUREMENT_ID ?? process.env.PUBLIC_FIREBASE_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_FIREBASE_API_SECRET ?? process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return null;
  return { measurementId, apiSecret };
}

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
 * @param stream 'web' (default, property Ads) o 'firebase' (legacy app native).
 *               Eventi web hanno client_id GA4 web-style, eventi firebase hanno
 *               app_instance_id — sono INCOMPATIBILI. Non usare 'web' per eventi
 *               provenienti dall'app Android nativa.
 */
export async function ga4TrackServer(
  eventName: string,
  context: AnalyticsContext | null | undefined,
  params: GA4EventParams = {},
  items?: GA4Item[],
  stream: GA4Stream = 'web',
): Promise<void> {
  const config = getStreamConfig(stream);
  if (!config) return; // no-op se stream non configurato
  if (!eventName) return;
  if (!puoEmettereGa4(context)) return; // no-op senza consenso o senza clientId reale

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.measurementId)}&api_secret=${encodeURIComponent(config.apiSecret)}`;

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
