import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/play-billing', () => ({
  verifyInappPurchase: vi.fn(),
  acknowledgePurchase: vi.fn(),
}));

vi.mock('../../src/lib/storage', () => ({
  cercaPerPurchaseToken: vi.fn(),
  salvaPurchaseTokenIndex: vi.fn(),
  salvaCodicePro: vi.fn(),
}));

vi.mock('../../src/lib/ga4', () => ({
  ga4TrackServer: vi.fn(),
}));

import { POST } from '../../src/pages/api/play-billing/verify';
import * as playBilling from '../../src/lib/play-billing';
import * as storage from '../../src/lib/storage';

function makeReq(body: any): any {
  return { json: async () => body, headers: new Headers() };
}

describe('POST /api/play-billing/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400 EMAIL_REQUIRED se email assente', async () => {
    const r = await (POST as any)({ request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime' }) });
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toBe('EMAIL_REQUIRED');
  });

  it('400 INVALID_PRODUCT se productId non in whitelist', async () => {
    const r = await (POST as any)({
      request: makeReq({ purchaseToken: 't', productId: 'monthly', email: 'a@b.it' }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('INVALID_PRODUCT');
  });

  it('400 TOKEN_REQUIRED se purchaseToken vuoto', async () => {
    const r = await (POST as any)({
      request: makeReq({ purchaseToken: '', productId: 'founder_lifetime', email: 'a@b.it' }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('TOKEN_REQUIRED');
  });

  it('200 ritorna codice esistente se purchaseToken già registrato (idempotenza)', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue({
      codice: 'PLAY-DEADBEEF',
      piano: 'founder',
      dataScadenza: '2099-12-31T23:59:59Z',
    });
    const r = await (POST as any)({
      request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }),
    });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.codice).toBe('PLAY-DEADBEEF');
    expect(playBilling.verifyInappPurchase).not.toHaveBeenCalled();
  });

  it('200 verify + acknowledge + emette nuovo codice PLAY-* sul happy path', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue(null);
    (playBilling.verifyInappPurchase as any).mockResolvedValue({
      purchaseState: 0,
      consumptionState: 0,
      acknowledgementState: 0,
      purchaseTimeMillis: '1720000000000',
      orderId: 'GPA.X',
      productId: 'founder_lifetime',
      purchaseToken: 't',
    });
    (playBilling.acknowledgePurchase as any).mockResolvedValue({ ok: true });
    (storage.salvaCodicePro as any).mockResolvedValue(undefined);
    (storage.salvaPurchaseTokenIndex as any).mockResolvedValue(undefined);

    const r = await (POST as any)({
      request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }),
    });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.codice).toMatch(/^PLAY-[0-9A-F]{8}$/);
    expect(playBilling.acknowledgePurchase).toHaveBeenCalledOnce();
    expect(storage.salvaPurchaseTokenIndex).toHaveBeenCalledWith('t', j.codice);
  });

  it('skip acknowledge se purchase già acknowledged (acknowledgementState=1)', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue(null);
    (playBilling.verifyInappPurchase as any).mockResolvedValue({
      purchaseState: 0,
      consumptionState: 0,
      acknowledgementState: 1,
      purchaseTimeMillis: '1720000000000',
      productId: 'founder_lifetime',
      purchaseToken: 't',
    });
    (storage.salvaCodicePro as any).mockResolvedValue(undefined);
    (storage.salvaPurchaseTokenIndex as any).mockResolvedValue(undefined);

    const r = await (POST as any)({
      request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }),
    });
    expect(r.status).toBe(200);
    expect(playBilling.acknowledgePurchase).not.toHaveBeenCalled();
  });

  it('502 PLAY_API_ERROR se verify ritorna 5xx', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue(null);
    (playBilling.verifyInappPurchase as any).mockResolvedValue({
      errore: 'internal',
      status: 503,
    });
    const r = await (POST as any)({
      request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }),
    });
    expect(r.status).toBe(502);
    expect((await r.json()).error).toBe('PLAY_API_ERROR');
  });

  it('400 INVALID_TOKEN se verify ritorna 410', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue(null);
    (playBilling.verifyInappPurchase as any).mockResolvedValue({
      errore: 'expired',
      status: 410,
    });
    const r = await (POST as any)({
      request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('INVALID_TOKEN');
  });

  it('400 TOKEN_NOT_PURCHASED se purchaseState != 0', async () => {
    (storage.cercaPerPurchaseToken as any).mockResolvedValue(null);
    (playBilling.verifyInappPurchase as any).mockResolvedValue({
      purchaseState: 1,
      consumptionState: 0,
      acknowledgementState: 0,
      purchaseTimeMillis: '1720000000000',
      productId: 'founder_lifetime',
      purchaseToken: 't',
    });
    const r = await (POST as any)({
      request: makeReq({ purchaseToken: 't', productId: 'founder_lifetime', email: 'a@b.it' }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('TOKEN_NOT_PURCHASED');
  });
});
