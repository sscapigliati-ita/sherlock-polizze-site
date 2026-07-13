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
