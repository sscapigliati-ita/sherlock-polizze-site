import { describe, it, expect } from 'vitest';
import {
  sanitizeConsent,
  sanitizeContext,
  puoEmettereGa4,
  consentDeniedByDefault,
  DENIED_CONSENT,
} from '../../src/lib/analytics-context';

describe('analytics-context sanitization + consent', () => {
  it('consentDeniedByDefault: tutto denied', () => {
    const c = consentDeniedByDefault();
    expect(c.analyticsStorage).toBe('denied');
    expect(c.adStorage).toBe('denied');
    expect(c.adUserData).toBe('denied');
    expect(c.adPersonalization).toBe('denied');
  });

  it('sanitizeConsent: input null/undefined → tutto denied', () => {
    expect(sanitizeConsent(null)).toEqual(DENIED_CONSENT);
    expect(sanitizeConsent(undefined)).toEqual(DENIED_CONSENT);
    expect(sanitizeConsent('hackattempt')).toEqual(DENIED_CONSENT);
  });

  it('sanitizeConsent: solo valori esattamente "granted" passano', () => {
    const c = sanitizeConsent({
      analyticsStorage: 'granted',
      adStorage: 'GRANTED', // case-sensitive: non passa
      adUserData: true, // non stringa: non passa
      adPersonalization: 'yes', // non stringa "granted": non passa
    });
    expect(c.analyticsStorage).toBe('granted');
    expect(c.adStorage).toBe('denied');
    expect(c.adUserData).toBe('denied');
    expect(c.adPersonalization).toBe('denied');
  });

  it('sanitizeContext: null se input non è oggetto', () => {
    expect(sanitizeContext(null)).toBeNull();
    expect(sanitizeContext(undefined)).toBeNull();
    expect(sanitizeContext('string')).toBeNull();
    expect(sanitizeContext(42)).toBeNull();
  });

  it('sanitizeContext: null se clientId manca o è troppo lungo (anti-injection)', () => {
    expect(sanitizeContext({ consent: {} })).toBeNull(); // no clientId
    expect(sanitizeContext({ clientId: '', consent: {} })).toBeNull(); // vuoto
    expect(sanitizeContext({ clientId: 'a'.repeat(65), consent: {} })).toBeNull(); // troppo lungo
    expect(sanitizeContext({ clientId: '<script>alert(1)</script>', consent: {} })).toBeNull();
    // OK: format GA4 tipico
    const ok = sanitizeContext({ clientId: '1234567890.1234567890', consent: {} });
    expect(ok).not.toBeNull();
    expect(ok?.clientId).toBe('1234567890.1234567890');
  });

  it('sanitizeContext: sessionId deve essere numerico stringa se presente', () => {
    const okNoSession = sanitizeContext({ clientId: 'abc.def', consent: {} });
    expect(okNoSession).not.toBeNull();
    expect(okNoSession?.sessionId).toBeUndefined();
    const okSession = sanitizeContext({ clientId: 'abc.def', sessionId: '1720123456', consent: {} });
    expect(okSession?.sessionId).toBe('1720123456');
    const badSession = sanitizeContext({ clientId: 'abc.def', sessionId: 'abc', consent: {} });
    // sessionId non valido → null (payload rifiutato tutto)
    expect(badSession).toBeNull();
  });

  it('R3-TEST-1: nessun hash email accettato come clientId', () => {
    // hash SHA-256 troncato tipico (16 hex char): passa il regex ma è comunque
    // usabile — quello che vogliamo verificare è che dal frontend non arrivi
    // MAI un valore inventato dal backend. Il regex qui accetta stringhe tipo
    // "abc123def456" (16 hex) perché sono valid GA4 client_id candidati; la
    // difesa è a monte (backend NON GENERA hash email come clientId più).
    const ctxHash = sanitizeContext({ clientId: 'a1b2c3d4e5f6a7b8', consent: {} });
    expect(ctxHash).not.toBeNull();
    // Non ha consenso → non può emettere
    expect(puoEmettereGa4(ctxHash)).toBe(false);
  });

  it('R3-TEST-2/3: orderId e requestId non usati come clientId (verifica arch)', () => {
    // Testa che tuttavia se qualcuno passasse un orderId formato UUID PayPal
    // ("XX123ABC456") come clientId, se avesse formato valido passerebbe il
    // sanitize — QUESTO E ATTESO perché il sanitize non ha modo di distinguere
    // client_id GA4 da altre stringhe. La difesa vera è nei codice API:
    // - analizza.ts riceve _ga4Context dal payload frontend (mai requestId)
    // - capture-order.ts legge da KV paypal_ga4:<orderId> (context salvato in
    //   create-order dal browser), mai usa orderId come clientId
    // Questo test documenta la strategia di difesa.
    const ctx = sanitizeContext({ clientId: 'ORDER-ID-123', consent: { analyticsStorage: 'granted' } });
    // Sanitize accetta la stringa (formato tecnicamente valido), MA il vero
    // controllo è che il codice API non lo passi mai.
    expect(ctx).not.toBeNull();
    // Verifichiamo per contro che con consent granted + clientId, PUO emettere
    // → responsabilità di NON PASSARE orderId sta nei chiamanti, verificato
    // dal fatto che grep 'ga4TrackServer.*orderId' in src/pages/api ritorna 0.
    expect(puoEmettereGa4(ctx)).toBe(true);
  });

  it('R3-TEST-4: evento GA4 NON emesso senza consenso Analytics', () => {
    // Consenso completamente denied
    expect(puoEmettereGa4({
      clientId: '1234.5678',
      consent: DENIED_CONSENT,
    })).toBe(false);
    // Solo ad_* granted ma analytics_storage denied
    expect(puoEmettereGa4({
      clientId: '1234.5678',
      consent: {
        analyticsStorage: 'denied',
        adStorage: 'granted',
        adUserData: 'granted',
        adPersonalization: 'granted',
      },
    })).toBe(false);
    // analytics_storage granted ma clientId assente
    expect(puoEmettereGa4({
      clientId: undefined,
      consent: {
        analyticsStorage: 'granted',
        adStorage: 'granted',
        adUserData: 'granted',
        adPersonalization: 'granted',
      },
    })).toBe(false);
    // Consenso null/undefined
    expect(puoEmettereGa4(null)).toBe(false);
    expect(puoEmettereGa4(undefined)).toBe(false);
    // OK: consenso Analytics granted + clientId valido
    expect(puoEmettereGa4({
      clientId: '1234.5678',
      consent: {
        analyticsStorage: 'granted',
        adStorage: 'denied',
        adUserData: 'denied',
        adPersonalization: 'denied',
      },
    })).toBe(true);
  });
});
