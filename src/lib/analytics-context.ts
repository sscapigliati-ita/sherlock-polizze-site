// Analytics context condiviso tra frontend e backend.
//
// Regole cardine (privacy-first):
// - Nessun evento GA4 server-side viene emesso senza `analyticsStorage === 'granted'`
//   trasmesso esplicitamente dal frontend (default DENIED se manca).
// - Nessun identificatore inventato dal backend (no hash email, no orderId, no requestId
//   come client_id GA4).
// - Il vero GA4 `client_id` e `session_id` provengono dal gtag della sessione del browser,
//   sono raccolti solo dopo consent, e trasmessi come metadati dell'evento.

export type ConsentValue = 'granted' | 'denied';

export interface AnalyticsConsent {
  // GA4 Consent Mode v2. Default DENIED prima del consenso utente.
  analyticsStorage: ConsentValue;
  adStorage: ConsentValue;
  adUserData: ConsentValue;
  adPersonalization: ConsentValue;
}

export interface AnalyticsContext {
  // Vero GA4 client_id ricavato da gtag('get', ID, 'client_id', ...). Formato tipico:
  // "<uint>.<uint>" (es "1234567890.1234567890"). Undefined finché il consenso non è
  // stato concesso o finché il gtag non è pronto.
  clientId?: string;
  // Vero GA4 session_id (uint) recuperato via gtag('get', ID, 'session_id', ...).
  sessionId?: string;
  // Consent state completo. Se analyticsStorage !== 'granted', il server NON emette
  // eventi GA4 anche se clientId/sessionId sono valorizzati.
  consent: AnalyticsConsent;
}

export const DENIED_CONSENT: AnalyticsConsent = {
  analyticsStorage: 'denied',
  adStorage: 'denied',
  adUserData: 'denied',
  adPersonalization: 'denied',
};

/**
 * Deriva il consent state di default: tutto denied. Usato ovunque manchi contesto
 * esplicito (backend che riceve payload senza `_ga4Context` valido → non emette eventi).
 */
export function consentDeniedByDefault(): AnalyticsConsent {
  return { ...DENIED_CONSENT };
}

/**
 * Sanifica un consent object arrivato da fonte non fidata (payload JSON dal client).
 * Ogni valore non 'granted' viene coerentemente ridotto a 'denied'. Non fa
 * upgrade automatico ('granted' resta granted solo se esplicitato).
 */
export function sanitizeConsent(raw: unknown): AnalyticsConsent {
  const out = consentDeniedByDefault();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  const chiavi: (keyof AnalyticsConsent)[] = [
    'analyticsStorage',
    'adStorage',
    'adUserData',
    'adPersonalization',
  ];
  for (const k of chiavi) {
    if (src[k] === 'granted') out[k] = 'granted';
  }
  return out;
}

/**
 * Sanifica un context arrivato da fonte non fidata. Ritorna null se il context
 * non è utilizzabile (nessun clientId valorizzato → server-side non può emettere
 * eventi identificabili).
 *
 * Valida che clientId sia una stringa non troppo lunga (evita abuse-injection).
 */
export function sanitizeContext(raw: unknown): AnalyticsContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const consent = sanitizeConsent(src.consent);

  const clientIdRaw = typeof src.clientId === 'string' ? src.clientId.trim() : '';
  const sessionIdRaw = typeof src.sessionId === 'string' ? src.sessionId.trim() : '';
  // Anti-abuse: forma tipica GA4 client_id è "1234567890.1234567890" (< 24 char);
  // session_id è un intero epoch (< 20 char). Blocco stringhe abnormi che
  // potrebbero essere PII iniettata.
  const clientIdOk = /^[A-Za-z0-9._-]{1,64}$/.test(clientIdRaw);
  const sessionIdOk = sessionIdRaw === '' || /^[0-9]{1,20}$/.test(sessionIdRaw);
  if (!clientIdOk || !sessionIdOk) return null;

  return {
    clientId: clientIdRaw,
    sessionId: sessionIdRaw || undefined,
    consent,
  };
}

/**
 * Ritorna true solo se il context è utilizzabile per emettere eventi GA4 server-side.
 */
export function puoEmettereGa4(ctx: AnalyticsContext | null | undefined): ctx is AnalyticsContext {
  return Boolean(
    ctx && ctx.clientId && ctx.consent && ctx.consent.analyticsStorage === 'granted',
  );
}
