import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/lib/play', () => ({
  accessToken: vi.fn().mockResolvedValue('fake-bearer-token'),
}));

describe('play-billing wrapper', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('verifyInappPurchase ritorna il purchase parsato su 200', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        purchaseState: 0,
        consumptionState: 0,
        acknowledgementState: 0,
        purchaseTimeMillis: '1720000000000',
        orderId: 'GPA.1234-5678',
        productId: 'founder_lifetime',
        regionCode: 'IT',
      }),
    });
    const { verifyInappPurchase } = await import('../../src/lib/play-billing');
    const r = await verifyInappPurchase('founder_lifetime', 'opaque-token');
    expect('errore' in r).toBe(false);
    if (!('errore' in r)) {
      expect(r.purchaseState).toBe(0);
      expect(r.orderId).toBe('GPA.1234-5678');
      expect(r.purchaseToken).toBe('opaque-token');
    }
  });

  it('verifyInappPurchase ritorna errore con status su 410 INVALID_TOKEN', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({ error: { message: 'Purchase token is no longer valid' } }),
    });
    const { verifyInappPurchase } = await import('../../src/lib/play-billing');
    const r = await verifyInappPurchase('founder_lifetime', 'expired-token');
    expect('errore' in r).toBe(true);
    if ('errore' in r) expect(r.status).toBe(410);
  });

  it('acknowledgePurchase ritorna ok:true su 204', async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: true, status: 204 });
    const { acknowledgePurchase } = await import('../../src/lib/play-billing');
    const r = await acknowledgePurchase('founder_lifetime', 'opaque-token');
    expect(r.ok).toBe(true);
  });

  it('acknowledgePurchase ritorna ok:false su 400', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'bad request' } }),
    });
    const { acknowledgePurchase } = await import('../../src/lib/play-billing');
    const r = await acknowledgePurchase('founder_lifetime', 'opaque-token');
    expect(r.ok).toBe(false);
  });
});
