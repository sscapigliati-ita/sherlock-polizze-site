export const PUBLIC_OFFER = Object.freeze({
  legacyProductsVisible: false,
  primaryCta: Object.freeze({ label: 'Fai il triage gratuito', href: '/app/' }),
  secondaryCta: Object.freeze({
    label: 'Guarda una simulazione di analisi',
    href: '/esempio-report',
  }),
  legacyRoutes: Object.freeze(['/abbonati', '/abbonamento', '/reclamo-singolo']),
  legacyProductIds: Object.freeze(['mensile', 'semestrale', 'annuale', 'singolo', 'founder']),
});

export function isLegacyPublicRoute(pathname: string): boolean {
  const normalized = `/${pathname}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  return PUBLIC_OFFER.legacyRoutes.some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}

export function isPubliclyMarketedProduct(productId: string): boolean {
  return PUBLIC_OFFER.legacyProductsVisible
    ? !PUBLIC_OFFER.legacyProductIds.includes(productId)
    : false;
}
