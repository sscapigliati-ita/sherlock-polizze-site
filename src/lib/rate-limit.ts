import { Redis } from '@upstash/redis';

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number; key: string };
type Options = { namespace: string; identity: string; limit: number; windowSeconds: number; nowMs?: number };
const fallback = new Map<string, { count: number; expiresAt: number }>();

function env(name: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name];
}
async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkRateLimit(opts: Options): Promise<RateLimitResult> {
  const now = opts.nowMs ?? Date.now();
  const windowId = Math.floor(now / (opts.windowSeconds * 1000));
  const key = `ratelimit:${opts.namespace}:${await hash(opts.identity)}:${windowId}`;
  const retryAfter = Math.max(1, Math.ceil(((windowId + 1) * opts.windowSeconds * 1000 - now) / 1000));
  const url = env('UPSTASH_REDIS_REST_URL') ?? env('KV_REST_API_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN') ?? env('KV_REST_API_TOKEN');
  let count: number;
  if (url && token) {
    const redis = new Redis({ url, token });
    count = await redis.incr(key);
    if (count === 1) await redis.expire(key, opts.windowSeconds + 1);
  } else {
    if (process.env.VERCEL_ENV === 'production') {
      return { allowed: false, remaining: 0, retryAfter, key };
    }
    const current = fallback.get(key);
    count = (current?.count ?? 0) + 1;
    fallback.set(key, { count, expiresAt: now + opts.windowSeconds * 1000 });
  }
  return { allowed: count <= opts.limit, remaining: Math.max(0, opts.limit - count), retryAfter, key };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: 'RATE_LIMITED', retryAfter: result.retryAfter }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(result.retryAfter), 'Cache-Control': 'no-store' },
  });
}

export function resetRateLimitFallbackForTests(): void { fallback.clear(); }
