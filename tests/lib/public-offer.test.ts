import { describe, expect, it } from 'vitest';
import {
  PUBLIC_OFFER,
  isLegacyPublicRoute,
  isPubliclyMarketedProduct,
} from '../../src/config/public-offer';

describe('offerta pubblica durante la transizione', () => {
  it('espone soltanto triage ed esempio dimostrativo', () => {
    expect(PUBLIC_OFFER.primaryCta).toEqual({
      label: 'Fai il triage gratuito',
      href: '/app/',
    });
    expect(PUBLIC_OFFER.secondaryCta).toEqual({
      label: 'Guarda una simulazione di analisi',
      href: '/esempio-report',
    });
  });

  it.each(['/abbonati', '/abbonamento/mensile', '/reclamo-singolo'])(
    '%s è una route legacy',
    (path) => {
      expect(isLegacyPublicRoute(path)).toBe(true);
    },
  );

  it.each(['mensile', 'semestrale', 'annuale', 'singolo', 'founder'])(
    '%s non è commercializzato',
    (id) => {
      expect(isPubliclyMarketedProduct(id)).toBe(false);
    },
  );
});
