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
      codice: 'PLAY-ABCDEF12',
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
