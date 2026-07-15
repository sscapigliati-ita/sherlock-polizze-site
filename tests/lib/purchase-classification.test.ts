import { describe, expect, it } from 'vitest';
import {
  isRealPurchase,
  normalizeCommercialMetadata,
  transitionCommercialStatus,
} from '../../src/lib/purchase-classification';

describe('purchase classification', () => {
  it('classifica un record legacy come test', () => {
    expect(normalizeCommercialMetadata({})).toMatchObject({
      commercialStatus: 'test',
      commercialStatusReason: 'legacy_unclassified',
      paymentEnvironment: 'unknown',
    });
  });

  it('considera commerciale soltanto reale', () => {
    expect(isRealPurchase({ commercialStatus: 'reale' })).toBe(true);
    for (const commercialStatus of ['test', 'rimborsato', 'incompleto', 'amministratore'] as const) {
      expect(isRealPurchase({ commercialStatus })).toBe(false);
    }
  });

  it('consente reale -> rimborsato e vieta rimborsato -> reale', () => {
    expect(
      transitionCommercialStatus(
        'reale',
        'rimborsato',
        'provider_refund',
        '2026-07-14T12:00:00.000Z',
      ),
    ).toMatchObject({
      commercialStatus: 'rimborsato',
      commercialStatusReason: 'provider_refund',
      commercialStatusUpdatedAt: '2026-07-14T12:00:00.000Z',
      refundedAt: '2026-07-14T12:00:00.000Z',
    });
    expect(() =>
      transitionCommercialStatus('rimborsato', 'reale', 'automatic_retry'),
    ).toThrow('Transizione commerciale non consentita');
  });

  it('rende idempotente una transizione allo stesso stato', () => {
    expect(transitionCommercialStatus('test', 'test', 'sandbox_verified')).toMatchObject({
      commercialStatus: 'test',
      commercialStatusReason: 'sandbox_verified',
    });
  });
});
