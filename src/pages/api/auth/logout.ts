import type { APIRoute } from 'astro';
import { cookieScadenza } from '../../../lib/auth-admin';

export const prerender = false;

export const GET: APIRoute = () => {
  return new Response(null, {
    status: 302,
    headers: { Location: '/', 'Set-Cookie': cookieScadenza() },
  });
};
