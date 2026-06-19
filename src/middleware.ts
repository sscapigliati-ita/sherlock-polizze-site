import { defineMiddleware } from 'astro:middleware';
import { verificaCookie } from './lib/auth-admin';

const ROTTE_PROTETTE = ['/admin', '/api/admin'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const pathname = ctx.url.pathname;
  const richiedeAuth = ROTTE_PROTETTE.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!richiedeAuth) return next();

  const cookie = ctx.request.headers.get('cookie');
  const payload = verificaCookie(cookie);

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Non autenticato' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Pagina: redirect al flow OAuth
    return ctx.redirect(`/api/auth/google?next=${encodeURIComponent(pathname)}`);
  }

  ctx.locals.adminEmail = payload.email;
  return next();
});
