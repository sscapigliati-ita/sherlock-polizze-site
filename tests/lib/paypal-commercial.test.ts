import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PayPal commercial environment', () => {
  afterEach(() => {
    delete process.env.PAYPAL_MODE;
    vi.resetModules();
  });

  it('classifica sandbox dalla configurazione server', async () => {
    process.env.PAYPAL_MODE = 'sandbox';
    const { paypalEnvironment } = await import('../../src/lib/paypal');
    expect(paypalEnvironment()).toBe('sandbox');
  });

  it('usa production come default prudente compatibile con il flusso esistente', async () => {
    delete process.env.PAYPAL_MODE;
    const { paypalEnvironment } = await import('../../src/lib/paypal');
    expect(paypalEnvironment()).toBe('production');
  });
});
