export type CommercialStatus =
  | 'reale'
  | 'test'
  | 'rimborsato'
  | 'incompleto'
  | 'amministratore';

export type PaymentEnvironment = 'production' | 'sandbox' | 'test' | 'unknown';

export type CommercialMetadata = {
  commercialStatus: CommercialStatus;
  commercialStatusUpdatedAt?: string;
  commercialStatusReason: string;
  paymentEnvironment: PaymentEnvironment;
  refundedAt?: string;
};

type PartialCommercialMetadata = Partial<CommercialMetadata>;

export function normalizeCommercialMetadata(
  record: PartialCommercialMetadata,
): CommercialMetadata {
  if (!record.commercialStatus) {
    return {
      commercialStatus: 'test',
      commercialStatusReason: 'legacy_unclassified',
      paymentEnvironment: 'unknown',
    };
  }
  return {
    commercialStatus: record.commercialStatus,
    commercialStatusReason: record.commercialStatusReason ?? 'status_persisted',
    paymentEnvironment: record.paymentEnvironment ?? 'unknown',
    ...(record.commercialStatusUpdatedAt
      ? { commercialStatusUpdatedAt: record.commercialStatusUpdatedAt }
      : {}),
    ...(record.refundedAt ? { refundedAt: record.refundedAt } : {}),
  };
}

export function isRealPurchase(record: PartialCommercialMetadata): boolean {
  return normalizeCommercialMetadata(record).commercialStatus === 'reale';
}

const ALLOWED: Record<CommercialStatus, readonly CommercialStatus[]> = {
  incompleto: ['incompleto', 'reale', 'test'],
  reale: ['reale', 'rimborsato'],
  test: ['test'],
  rimborsato: ['rimborsato'],
  amministratore: ['amministratore'],
};

export function transitionCommercialStatus(
  current: CommercialStatus,
  next: CommercialStatus,
  reason: string,
  now = new Date().toISOString(),
): Pick<CommercialMetadata, 'commercialStatus' | 'commercialStatusReason' | 'commercialStatusUpdatedAt' | 'refundedAt'> {
  if (!ALLOWED[current].includes(next)) {
    throw new Error(`Transizione commerciale non consentita: ${current} -> ${next}`);
  }
  return {
    commercialStatus: next,
    commercialStatusReason: reason,
    commercialStatusUpdatedAt: now,
    ...(next === 'rimborsato' ? { refundedAt: now } : {}),
  };
}
