import { defineMiddleware } from 'astro:middleware';
import { verificaCookie } from './lib/auth-admin';
import { applySecurityHeaders } from './lib/security-headers';
import { checkRateLimit, rateLimitResponse } from './lib/rate-limit';

const ROTTE_PROTETTE = ['/admin', '/api/admin'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const pathname = ctx.url.pathname;
  const aiRoutes = ['/api/analizza', '/api/compara', '/api/lettera'];
  const paymentRoutes = ['/api/paypal/create-order', '/api/paypal/capture-order', '/api/play-billing/verify'];
  const namespace = aiRoutes.includes(pathname) ? 'ai' : paymentRoutes.includes(pathname) ? 'payment' : null;
  if (namespace) {
    const rawIdentity = ctx.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? ctx.request.headers.get('x-real-ip')?.trim()
      ?? 'unknown';
    const defaultLimit = namespace === 'ai' ? 10 : 30;
    const defaultWindow = namespace === 'ai' ? 3600 : 900;
    const limit = Number(process.env[`RATE_LIMIT_${namespace.toUpperCase()}_MAX`] ?? defaultLimit);
    const windowSeconds = Number(process.env[`RATE_LIMIT_${namespace.toUpperCase()}_WINDOW_SECONDS`] ?? defaultWindow);
    const result = await checkRateLimit({ namespace, identity: rawIdentity, limit, windowSeconds });
    if (!result.allowed) return applySecurityHeaders(rateLimitResponse(result));
  }
  const richiedeAuth = ROTTE_PROTETTE.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!richiedeAuth) return applySecurityHeaders(await next());

  const cookie = ctx.request.headers.get('cookie');
  const payload = verificaCookie(cookie);

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return applySecurityHeaders(new Response(JSON.stringify({ error: 'Non autenticato' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    // Pagina: redirect al flow OAuth
    return applySecurityHeaders(ctx.redirect(`/api/auth/google?next=${encodeURIComponent(pathname)}`));
  }

  ctx.locals.adminEmail = payload.email;
  return applySecurityHeaders(await next());
});
