import type { APIRoute } from 'astro';
import { nuovoState, urlAutorizzazioneGoogle } from '../../../lib/auth-admin';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/callback`;
  const next = url.searchParams.get('next') ?? '/admin';
  const { state, cookie } = nuovoState();

  // Includo "next" come parte dello state (encoded), lo recupero al callback
  const stateConNext = `${state}:${encodeURIComponent(next)}`;
  const target = urlAutorizzazioneGoogle(redirectUri, stateConNext);

  return new Response(null, {
    status: 302,
    headers: { Location: target, 'Set-Cookie': cookie },
  });
};
