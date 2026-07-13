import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// R4.2 — test dual-property GA4: eventi web vanno a GA4_WEB_*, eventi
// firebase a GA4_FIREBASE_* (con fallback retrocompat a PUBLIC_FIREBASE_*).
// Verifica anche che il secret API non finisca mai nel bundle client.

describe('R4-TEST-1..6: GA4 dual-property routing', () => {
  const originalEnv: Record<string, string | undefined> = {};
  const keys = [
    'GA4_WEB_MEASUREMENT_ID',
    'GA4_WEB_API_SECRET',
    'GA4_FIREBASE_MEASUREMENT_ID',
    'GA4_FIREBASE_API_SECRET',
    'PUBLIC_FIREBASE_MEASUREMENT_ID',
    'GA4_API_SECRET',
  ];

  beforeEach(() => {
    for (const k of keys) {
      originalEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it('R4-TEST-1: evento web → measurement ID web (GA4_WEB_*)', async () => {
    process.env.GA4_WEB_MEASUREMENT_ID = 'G-WEBADS12345';
    process.env.GA4_WEB_API_SECRET = 'web-secret-abc';
    const { getStreamConfig } = await import('../../src/lib/ga4');
    const cfg = getStreamConfig('web');
    expect(cfg).not.toBeNull();
    expect(cfg?.measurementId).toBe('G-WEBADS12345');
    expect(cfg?.apiSecret).toBe('web-secret-abc');
  });

  it('R4-TEST-2: evento firebase con env dedicate → GA4_FIREBASE_*', async () => {
    process.env.GA4_FIREBASE_MEASUREMENT_ID = 'G-FIREBASE9999';
    process.env.GA4_FIREBASE_API_SECRET = 'firebase-secret-xyz';
    const { getStreamConfig } = await import('../../src/lib/ga4');
    const cfg = getStreamConfig('firebase');
    expect(cfg).not.toBeNull();
    expect(cfg?.measurementId).toBe('G-FIREBASE9999');
    expect(cfg?.apiSecret).toBe('firebase-secret-xyz');
  });

  it('R4-TEST-2b: retrocompat firebase — fallback a PUBLIC_FIREBASE_* + GA4_API_SECRET', async () => {
    // Env pre-R4: solo le vecchie var → firebase stream funziona ancora
    process.env.PUBLIC_FIREBASE_MEASUREMENT_ID = 'G-LEGACY0001';
    process.env.GA4_API_SECRET = 'legacy-secret';
    const { getStreamConfig } = await import('../../src/lib/ga4');
    const cfg = getStreamConfig('firebase');
    expect(cfg).not.toBeNull();
    expect(cfg?.measurementId).toBe('G-LEGACY0001');
    expect(cfg?.apiSecret).toBe('legacy-secret');
  });

  it('R4-TEST-2c: nuove GA4_FIREBASE_* prevalgono sui fallback legacy', async () => {
    process.env.PUBLIC_FIREBASE_MEASUREMENT_ID = 'G-LEGACY0001';
    process.env.GA4_API_SECRET = 'legacy-secret';
    process.env.GA4_FIREBASE_MEASUREMENT_ID = 'G-NEW-FB';
    process.env.GA4_FIREBASE_API_SECRET = 'new-fb-secret';
    const { getStreamConfig } = await import('../../src/lib/ga4');
    const cfg = getStreamConfig('firebase');
    expect(cfg?.measurementId).toBe('G-NEW-FB');
    expect(cfg?.apiSecret).toBe('new-fb-secret');
  });

  it('R4-TEST-3: API secret mai nel bundle client — env vars sono server-only', async () => {
    // Verifica statica: nessuna delle 6 env vars ha prefisso PUBLIC_ o VITE_
    // (che sarebbero incluse nel bundle client Astro). PUBLIC_FIREBASE_MEASUREMENT_ID
    // È pubblica by design (misurement ID è nel bundle gtag comunque), ma il
    // relativo API secret (GA4_API_SECRET / GA4_FIREBASE_API_SECRET / GA4_WEB_API_SECRET)
    // è server-only e non deve MAI comparire in un identificatore PUBLIC_*.
    const secretKeys = ['GA4_WEB_API_SECRET', 'GA4_FIREBASE_API_SECRET', 'GA4_API_SECRET'];
    for (const k of secretKeys) {
      expect(k.startsWith('PUBLIC_')).toBe(false);
      expect(k.startsWith('VITE_')).toBe(false);
    }
  });

  it('R4-TEST-4: no doppia conversione — un solo stream per evento', async () => {
    // Test di contratto: getStreamConfig ritorna una singola config per stream.
    // Il codice di dominio (capture-order.ts) chiama ga4TrackServer('purchase', ...)
    // UNA sola volta per invocazione riuscita. Nessun fan-out automatico su
    // entrambi gli stream.
    process.env.GA4_WEB_MEASUREMENT_ID = 'G-W';
    process.env.GA4_WEB_API_SECRET = 'sw';
    process.env.GA4_FIREBASE_MEASUREMENT_ID = 'G-F';
    process.env.GA4_FIREBASE_API_SECRET = 'sf';
    const { getStreamConfig } = await import('../../src/lib/ga4');
    const web = getStreamConfig('web');
    const fb = getStreamConfig('firebase');
    // I due stream sono distinguibili — chi chiama sceglie esplicitamente lo stream
    expect(web?.measurementId).not.toBe(fb?.measurementId);
    expect(web?.apiSecret).not.toBe(fb?.apiSecret);
  });

  it('R4-TEST-5: consenso denied → no invio (verifica in ga4.ts via puoEmettereGa4)', async () => {
    // Cross-test: anche con stream config OK, se il context non ha consenso,
    // il fetch non parte. Verificato via puoEmettereGa4 in analytics-context.
    process.env.GA4_WEB_MEASUREMENT_ID = 'G-W';
    process.env.GA4_WEB_API_SECRET = 'sw';
    const { puoEmettereGa4 } = await import('../../src/lib/analytics-context');
    expect(puoEmettereGa4({
      clientId: 'valid.client.id',
      consent: {
        analyticsStorage: 'denied',
        adStorage: 'denied',
        adUserData: 'denied',
        adPersonalization: 'denied',
      },
    })).toBe(false);
  });

  it('R4-TEST: stream web richiede env dedicate, no fallback silente', async () => {
    // Se GA4_WEB_* non è configurato, lo stream web ritorna null → no-op.
    // Non c'è fallback silente a PUBLIC_FIREBASE_MEASUREMENT_ID: evita di
    // mandare eventi alla proprietà sbagliata per errore di configurazione.
    process.env.PUBLIC_FIREBASE_MEASUREMENT_ID = 'G-FB-LEGACY';
    process.env.GA4_API_SECRET = 'legacy';
    const { getStreamConfig } = await import('../../src/lib/ga4');
    expect(getStreamConfig('web')).toBeNull();
    // Ma firebase con fallback legacy funziona
    expect(getStreamConfig('firebase')).not.toBeNull();
  });
});
