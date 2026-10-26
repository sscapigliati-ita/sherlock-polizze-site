import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORDER = 'ORDER123';

function risposta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const ordineCompletato = {
  status: 'COMPLETED',
  purchase_units: [
    {
      reference_id: 'annuale',
      custom_id: 'cliente@example.com',
      payments: { captures: [{ id: 'CAP1' }] },
    },
  ],
};

describe('evasione ordine PayPal', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PAYPAL_CLIENT_ID = 'id';
    process.env.PAYPAL_SECRET = 'secret';
    process.env.PAYPAL_MODE = 'sandbox';
    delete process.env.RESEND_API_KEY;
    delete process.env.KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ORDER_ALREADY_CAPTURED: legge l’ordine invece di fallire', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/oauth2/token')) return risposta(200, { access_token: 't', expires_in: 3000 });
      if (url.endsWith('/capture')) {
        return risposta(422, { details: [{ issue: 'ORDER_ALREADY_CAPTURED' }], message: 'gia' });
      }
      if (init?.method !== 'POST' && url.includes(`/orders/${ORDER}`)) return risposta(200, ordineCompletato);
      return risposta(404, {});
    });
    vi.stubGlobal('fetch', fetchMock);
    const { catturaOrdinePayPal } = await import('../../src/lib/paypal');
    const r = await catturaOrdinePayPal(ORDER);
    expect(r.status).toBe('COMPLETED');
    expect(r.piano).toBe('annuale');
    expect(r.email).toBe('cliente@example.com');
    expect(r.captureId).toBe('CAP1');
  });

  it('capture fallita → ordine retry-abile con Request-Id nuovo', async () => {
    const ids: string[] = [];
    let primaVolta = true;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/oauth2/token')) return risposta(200, { access_token: 't', expires_in: 3000 });
      if (url.endsWith('/capture')) {
        ids.push((init!.headers as Record<string, string>)['PayPal-Request-Id']);
        if (primaVolta) {
          primaVolta = false;
          return risposta(422, { details: [{ issue: 'INSTRUMENT_DECLINED' }], message: 'rifiutata' });
        }
        return risposta(201, ordineCompletato);
      }
      return risposta(404, {});
    });
    vi.stubGlobal('fetch', fetchMock);
    const { evadiOrdinePayPal } = await import('../../src/lib/paypal-fulfill');

    const primo = await evadiOrdinePayPal(ORDER);
    expect(primo.status).toBe(502);

    const secondo = await evadiOrdinePayPal(ORDER);
    expect(secondo.status).toBe(200);
    expect(typeof secondo.body.codice).toBe('string');
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('seconda chiamata su ordine completato è idempotente (stesso codice)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/oauth2/token')) return risposta(200, { access_token: 't', expires_in: 3000 });
      if (url.endsWith('/capture')) return risposta(201, ordineCompletato);
      return risposta(404, {});
    });
    vi.stubGlobal('fetch', fetchMock);
    const { evadiOrdinePayPal } = await import('../../src/lib/paypal-fulfill');
    const a = await evadiOrdinePayPal(ORDER);
    const b = await evadiOrdinePayPal(ORDER);
    expect(a.status).toBe(200);
    expect(b.body.codice).toBe(a.body.codice);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/capture'))).toHaveLength(1);
  });
});
