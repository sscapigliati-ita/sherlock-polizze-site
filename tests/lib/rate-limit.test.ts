import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, rateLimitResponse, resetRateLimitFallbackForTests } from '../../src/lib/rate-limit';

describe('rate limiter', () => {
  beforeEach(() => resetRateLimitFallbackForTests());

  it('consente fino alla soglia e poi blocca senza esporre identità', async () => {
    const opts = { namespace: 'ai', identity: '203.0.113.5', limit: 2, windowSeconds: 60, nowMs: 1_000 };
    expect((await checkRateLimit(opts)).allowed).toBe(true);
    expect((await checkRateLimit(opts)).allowed).toBe(true);
    const blocked = await checkRateLimit(opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.key).not.toContain(opts.identity);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    const response = rateLimitResponse(blocked);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe(String(blocked.retryAfter));
  });

  it('riapre dopo la finestra', async () => {
    const base = { namespace: 'pay', identity: 'ip', limit: 1, windowSeconds: 10 };
    expect((await checkRateLimit({ ...base, nowMs: 0 })).allowed).toBe(true);
    expect((await checkRateLimit({ ...base, nowMs: 1_000 })).allowed).toBe(false);
    expect((await checkRateLimit({ ...base, nowMs: 11_000 })).allowed).toBe(true);
  });
});
