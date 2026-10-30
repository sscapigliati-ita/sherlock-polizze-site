import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Un ordine PayPal approvato ma mai catturato non lascia nessun processing
// record: senza questi contatori resta invisibile in /admin.

describe('checkout PayPal avviati', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));
    delete process.env.KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('conta avviati, completati e in corso', async () => {
    const s = await import('../../src/lib/storage');
    await s.salvaCheckoutAvviato('ORD_A', 'annuale');
    await s.salvaCheckoutAvviato('ORD_B', 'mensile');
    await s.iniziaPayPalProcessing('ORD_A', null);
    await s.aggiornaPayPalProcessing('ORD_A', { status: 'completed' });

    const c = await s.contaCheckoutPayPal();
    expect(c.avviati).toBe(2);
    expect(c.completati).toBe(1);
    expect(c.inCorso).toBe(1);
    expect(c.nonCompletati).toBe(0);
  });

  it('dopo 3 ore un checkout senza ordine completato è non completato', async () => {
    const s = await import('../../src/lib/storage');
    await s.salvaCheckoutAvviato('ORD_B', 'mensile');
    vi.setSystemTime(new Date('2026-10-30T13:30:00Z'));

    const c = await s.contaCheckoutPayPal();
    expect(c.inCorso).toBe(0);
    expect(c.nonCompletati).toBe(1);
    expect(c.ultimoNonCompletato?.orderId).toBe('ORD_B');
    expect(c.ultimoNonCompletato?.piano).toBe('mensile');
  });

  it('salvare due volte lo stesso ordine conta una volta sola', async () => {
    const s = await import('../../src/lib/storage');
    await s.salvaCheckoutAvviato('ORD_A', 'annuale');
    await s.salvaCheckoutAvviato('ORD_A', 'annuale');
    expect((await s.contaCheckoutPayPal()).avviati).toBe(1);
  });
});
