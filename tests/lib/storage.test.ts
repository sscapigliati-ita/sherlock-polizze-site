import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @upstash/redis prima dell'import del modulo
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    smembers: vi.fn().mockResolvedValue([]),
    sadd: vi.fn(),
    incr: vi.fn(),
    mget: vi.fn().mockResolvedValue([]),
  })),
}));

describe('storage Play Billing', () => {
  beforeEach(() => {
    vi.resetModules();
    // Forza la modalità "kv non configurato" per evitare di toccare istanze Redis reali
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('cercaPerPurchaseToken ritorna null se kv non configurato', async () => {
    const { cercaPerPurchaseToken } = await import('../../src/lib/storage');
    const result = await cercaPerPurchaseToken('token-inesistente');
    expect(result).toBeNull();
  });

  it('cercaPerPurchaseToken ritorna null se token vuoto', async () => {
    const { cercaPerPurchaseToken } = await import('../../src/lib/storage');
    const result = await cercaPerPurchaseToken('');
    expect(result).toBeNull();
  });

  it('salvaPurchaseTokenIndex è no-op se kv non configurato (no throw)', async () => {
    const { salvaPurchaseTokenIndex } = await import('../../src/lib/storage');
    await expect(salvaPurchaseTokenIndex('t', 'PLAY-X')).resolves.toBeUndefined();
  });

  it('RecordPro accetta campi fonte/purchaseToken/playOrderId opzionali (type check)', async () => {
    await import('../../src/lib/storage');
    // type-only check: deve compilare
    const r: import('../../src/lib/storage').RecordPro = {
      codice: 'SHK-ABCD-EF12',
      email: 'x@y.it',
      piano: 'founder',
      dataEmissione: '2026-06-30T12:00:00Z',
      dataScadenza: '2099-12-31T23:59:59Z',
      fonte: 'play',
      purchaseToken: 'opaque-token',
      playOrderId: 'GPA.1234',
    };
    expect(r.fonte).toBe('play');
    expect(r.purchaseToken).toBe('opaque-token');
  });
});

describe('aggregati commerciali prudenti', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('esclude legacy e non reali da ricavi e conteggi commerciali', async () => {
    const mod = await import('../../src/lib/storage');
    const base = {
      email: 'x@example.it', piano: 'mensile' as const,
      dataEmissione: '2026-07-14T12:00:00.000Z', dataScadenza: '2099-01-01T00:00:00.000Z',
    };
    await mod.salvaCodicePro({ ...base, codice: 'LEGACY' });
    await mod.salvaCodicePro({ ...base, codice: 'REAL', commercialStatus: 'reale' });
    await mod.salvaCodicePro({ ...base, codice: 'ADMIN', commercialStatus: 'amministratore' });
    await mod.salvaCodicePro({ ...base, codice: 'REFUND', commercialStatus: 'rimborsato' });
    const result = await mod.leggiAbbonati();
    expect(result.reali).toBe(1);
    expect(result.attiviReali).toBe(1);
    expect(result.ricavoEuroCent).toBe(299);
    expect(result.perStato).toEqual({ reale: 1, test: 1, rimborsato: 1, incompleto: 0, amministratore: 1 });
    expect(result.records.find((r) => r.codice === 'LEGACY')).toMatchObject({
      commercialStatus: 'test', commercialStatusReason: 'legacy_unclassified', paymentEnvironment: 'unknown',
    });
  });
});

describe('storage PayPal idempotenza (fallback in-memory)', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('registraPayPalOrderId ritorna true al primo salvataggio, false al secondo (SETNX)', async () => {
    const { registraPayPalOrderId } = await import('../../src/lib/storage');
    const primo = await registraPayPalOrderId('ORDER-123', 'SHK-AAAA-BBBB');
    expect(primo).toBe(true);
    // Secondo tentativo con stesso orderId (e anche diverso codice) deve fallire
    const secondo = await registraPayPalOrderId('ORDER-123', 'SHK-XXXX-YYYY');
    expect(secondo).toBe(false);
  });

  it('registraPayPalOrderId ritorna false su input vuoti', async () => {
    const { registraPayPalOrderId } = await import('../../src/lib/storage');
    expect(await registraPayPalOrderId('', 'SHK-AAAA-BBBB')).toBe(false);
    expect(await registraPayPalOrderId('ORDER-1', '')).toBe(false);
  });

  it('cercaPerPayPalOrderId ritorna null se orderId sconosciuto', async () => {
    const { cercaPerPayPalOrderId } = await import('../../src/lib/storage');
    const res = await cercaPerPayPalOrderId('NEVER-SEEN');
    expect(res).toBeNull();
  });

  it('cercaPerPayPalOrderId ritorna null se orderId vuoto', async () => {
    const { cercaPerPayPalOrderId } = await import('../../src/lib/storage');
    expect(await cercaPerPayPalOrderId('')).toBeNull();
  });

  it('idempotenza end-to-end: registra + cerca ritorna il record salvato', async () => {
    const mod = await import('../../src/lib/storage');
    // Prima salviamo un codice pro (usa fallback in-memory Map)
    await mod.salvaCodicePro({
      codice: 'SHK-EEEE-FFFF',
      email: 'test@example.it',
      piano: 'annuale',
      dataEmissione: '2026-07-13T12:00:00Z',
      dataScadenza: '2027-07-13T12:00:00Z',
      paypalOrderId: 'PP-ORDER-999',
    });
    // Registriamo l'associazione paypal_order -> codice
    const ok = await mod.registraPayPalOrderId('PP-ORDER-999', 'SHK-EEEE-FFFF');
    expect(ok).toBe(true);
    // Cerca deve ritornare il record completo
    const rec = await mod.cercaPerPayPalOrderId('PP-ORDER-999');
    expect(rec).not.toBeNull();
    expect(rec?.codice).toBe('SHK-EEEE-FFFF');
    expect(rec?.piano).toBe('annuale');
    expect(rec?.email).toBe('test@example.it');
  });

  it('idempotenza previene duplicati: 5 tentativi con stesso orderId danno un solo record', async () => {
    const { registraPayPalOrderId } = await import('../../src/lib/storage');
    const results: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(await registraPayPalOrderId('PP-DUP-42', `SHK-CODE-${i}`));
    }
    // Solo il primo tentativo deve avere successo (true), gli altri false
    expect(results.filter((r) => r === true)).toHaveLength(1);
    expect(results.filter((r) => r === false)).toHaveLength(4);
  });
});

describe('R3-TEST-7/8/9: PayPal Processing Record crash recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('iniziaPayPalProcessing: created=true al primo, created=false ai successivi', async () => {
    const { iniziaPayPalProcessing } = await import('../../src/lib/storage');
    const primo = await iniziaPayPalProcessing('CRASH-1', null);
    expect(primo.created).toBe(true);
    expect(primo.record.status).toBe('processing');
    expect(primo.record.codeSaved).toBe(false);
    expect(primo.record.emailSent).toBe(false);
    expect(primo.record.analyticsSent).toBe(false);

    const secondo = await iniziaPayPalProcessing('CRASH-1', null);
    expect(secondo.created).toBe(false);
    // Ritorna il record esistente identico
    expect(secondo.record.status).toBe('processing');
    expect(secondo.record.createdAt).toBe(primo.record.createdAt);
  });

  it('aggiornaPayPalProcessing: checkpoint dopo crash sono persistenti', async () => {
    const mod = await import('../../src/lib/storage');
    await mod.iniziaPayPalProcessing('CRASH-2', null);
    // Simuliamo il completamento dei checkpoint uno per uno (come farebbe
    // il flow reale se un crash avvenisse tra ogni fase)
    await mod.aggiornaPayPalProcessing('CRASH-2', { code: 'SHK-AAAA-BBBB', codeSaved: true });
    let stato = await mod.leggiPayPalProcessing('CRASH-2');
    expect(stato?.codeSaved).toBe(true);
    expect(stato?.founderCounterUpdated).toBe(false);
    expect(stato?.emailSent).toBe(false);

    // Retry dopo crash → founder counter
    await mod.aggiornaPayPalProcessing('CRASH-2', { founderCounterUpdated: true });
    stato = await mod.leggiPayPalProcessing('CRASH-2');
    expect(stato?.codeSaved).toBe(true); // preservato
    expect(stato?.founderCounterUpdated).toBe(true);

    // Retry dopo crash → email
    await mod.aggiornaPayPalProcessing('CRASH-2', { emailSent: true });
    stato = await mod.leggiPayPalProcessing('CRASH-2');
    expect(stato?.codeSaved).toBe(true);
    expect(stato?.founderCounterUpdated).toBe(true);
    expect(stato?.emailSent).toBe(true);

    // Retry dopo crash → analytics + completed
    await mod.aggiornaPayPalProcessing('CRASH-2', { analyticsSent: true, status: 'completed' });
    stato = await mod.leggiPayPalProcessing('CRASH-2');
    expect(stato?.status).toBe('completed');
    expect(stato?.analyticsSent).toBe(true);
  });

  it('R3-TEST-9: leggiPayPalProcessing ritorna record solo se realmente esistente', async () => {
    const { leggiPayPalProcessing } = await import('../../src/lib/storage');
    // Ordine mai iniziato: null
    expect(await leggiPayPalProcessing('NEVER-SEEN')).toBeNull();
  });

  it('R3-TEST-11: idempotenza analyticsSent evita duplicati purchase GA4', async () => {
    const mod = await import('../../src/lib/storage');
    await mod.iniziaPayPalProcessing('CRASH-3', null);
    // Primo retry marca analyticsSent
    await mod.aggiornaPayPalProcessing('CRASH-3', { analyticsSent: true });
    const rec = await mod.leggiPayPalProcessing('CRASH-3');
    expect(rec?.analyticsSent).toBe(true);
    // Il flow di completaEffetti (in capture-order.ts) NON emette purchase
    // GA4 se analyticsSent === true. Test statico: verifichiamo il checkpoint
    // è persistente per abilitare quel controllo.
    const rec2 = await mod.leggiPayPalProcessing('CRASH-3');
    expect(rec2?.analyticsSent).toBe(true); // sopravvive al retry
  });
});

describe('R3-TEST-5: ga4 context conservato tra create-order e capture-order', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('salvaPayPalGa4Context + leggiPayPalGa4Context: round-trip completo', async () => {
    const mod = await import('../../src/lib/storage');
    const ctx = {
      clientId: '1234567890.9876543210',
      sessionId: '1720123456',
      consent: {
        analyticsStorage: 'granted' as const,
        adStorage: 'denied' as const,
        adUserData: 'granted' as const,
        adPersonalization: 'denied' as const,
      },
    };
    await mod.salvaPayPalGa4Context('PP-ORD-CTX-1', ctx);
    const letto = await mod.leggiPayPalGa4Context('PP-ORD-CTX-1');
    expect(letto).not.toBeNull();
    expect(letto?.clientId).toBe('1234567890.9876543210');
    expect(letto?.sessionId).toBe('1720123456');
    expect(letto?.consent.analyticsStorage).toBe('granted');
    // Il context salvato in create-order è recuperabile in capture-order
    // → il vero client_id è conservato tra le due invocazioni HTTP.
  });

  it('leggiPayPalGa4Context ritorna null se non salvato', async () => {
    const { leggiPayPalGa4Context } = await import('../../src/lib/storage');
    expect(await leggiPayPalGa4Context('MAI-VISTO')).toBeNull();
  });
});

describe('R4-TEST-1..6: PayPal-Request-Id UUID v5 (max 38 char)', () => {
  it('R4-TEST-1: lunghezza <= 38 (limite PayPal)', async () => {
    const { paypalRequestId } = await import('../../src/lib/paypal');
    const id = await paypalRequestId('ORDER-XYZ', 'capture');
    expect(id.length).toBeLessThanOrEqual(38);
    // UUID v5 canonico = 36 char esatti
    expect(id).toHaveLength(36);
  });

  it('R4-TEST-2: stesso input → stesso valore (deterministico)', async () => {
    const { paypalRequestId } = await import('../../src/lib/paypal');
    const a = await paypalRequestId('ORDER-DET-1', 'capture');
    const b = await paypalRequestId('ORDER-DET-1', 'capture');
    const c = await paypalRequestId('ORDER-DET-1', 'capture');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('R4-TEST-3: operation diversa → valore diverso', async () => {
    const { paypalRequestId } = await import('../../src/lib/paypal');
    const capture = await paypalRequestId('ORDER-OP', 'capture');
    const create = await paypalRequestId('ORDER-OP', 'create');
    const refund = await paypalRequestId('ORDER-OP', 'refund');
    expect(capture).not.toBe(create);
    expect(capture).not.toBe(refund);
    expect(create).not.toBe(refund);
  });

  it('R4-TEST-4: orderId diverso → valore diverso', async () => {
    const { paypalRequestId } = await import('../../src/lib/paypal');
    const a = await paypalRequestId('ORDER-A', 'capture');
    const b = await paypalRequestId('ORDER-B', 'capture');
    expect(a).not.toBe(b);
  });

  it('R4-TEST-5: formato UUID canonico accettabile da PayPal', async () => {
    const { paypalRequestId } = await import('../../src/lib/paypal');
    const id = await paypalRequestId('ORDER-FMT', 'capture');
    // Regex UUID v5: 8-4-4-4-12 con byte 6 = 5x, byte 8 = 8/9/a/b
    // (variant RFC 4122). Formato universalmente accettato da PayPal-Request-Id.
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))
      .toBe(true);
  });

  it('R4-TEST-6: retry della capture con lo stesso header', async () => {
    const { paypalRequestId } = await import('../../src/lib/paypal');
    // Simulazione retry: 5 chiamate successive con stesso (orderId, operazione)
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await paypalRequestId('ORDER-RETRY', 'capture'));
    }
    // Tutti identici — PayPal idempotency guarantee sfruttata correttamente
    expect(new Set(ids).size).toBe(1);
  });
});

