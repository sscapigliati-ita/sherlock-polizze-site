import { accessToken } from './play';

const PKG = process.env.PLAY_PACKAGE_NAME ?? 'it.sherlock.polizze';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

export type PlayPurchase = {
  purchaseState: 0 | 1 | 2;
  consumptionState: 0 | 1;
  acknowledgementState: 0 | 1;
  purchaseTimeMillis: string;
  orderId?: string;
  productId: string;
  purchaseToken: string;
  regionCode?: string;
};

type ApiError = { errore: string; status?: number };

export async function verifyInappPurchase(
  productId: string,
  purchaseToken: string,
): Promise<PlayPurchase | ApiError> {
  try {
    const token = await accessToken(SCOPE);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as any;
      return { errore: body?.error?.message ?? `HTTP ${r.status}`, status: r.status };
    }
    const data = (await r.json()) as any;
    return {
      purchaseState: data.purchaseState ?? 0,
      consumptionState: data.consumptionState ?? 0,
      acknowledgementState: data.acknowledgementState ?? 0,
      purchaseTimeMillis: String(data.purchaseTimeMillis ?? ''),
      orderId: data.orderId,
      productId,
      purchaseToken,
      regionCode: data.regionCode,
    };
  } catch (e: any) {
    return { errore: e?.message ?? String(e) };
  }
}

export async function acknowledgePurchase(
  productId: string,
  purchaseToken: string,
): Promise<{ ok: true } | { ok: false; errore: string }> {
  try {
    const token = await accessToken(SCOPE);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!r.ok && r.status !== 204) {
      const body = (await r.json().catch(() => ({}))) as any;
      return { ok: false, errore: body?.error?.message ?? `HTTP ${r.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, errore: e?.message ?? String(e) };
  }
}
