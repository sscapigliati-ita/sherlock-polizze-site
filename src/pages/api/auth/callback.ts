import type { APIRoute } from 'astro';
import {
  creaCookie,
  emailAutorizzata,
  scambiaCodicePerEmail,
  statePulito,
  verificaState,
} from '../../../lib/auth-admin';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const code = url.searchParams.get('code');
  const stateRicevuto = url.searchParams.get('state');
  const errore = url.searchParams.get('error');

  if (errore) {
    return new Response(`Login Google rifiutato: ${errore}`, { status: 400 });
  }
  if (!code || !stateRicevuto) {
    return new Response('Parametri OAuth mancanti', { status: 400 });
  }

  const [stateOriginale, nextEncoded] = stateRicevuto.split(':');
  const cookieHeader = request.headers.get('cookie');
  if (!verificaState(cookieHeader, stateOriginale)) {
    return new Response('State OAuth non valido', { status: 400 });
  }

  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  let email: string;
  try {
    email = await scambiaCodicePerEmail(code, redirectUri);
  } catch (e: any) {
    return new Response(`Errore OAuth: ${e?.message ?? e}`, { status: 502 });
  }

  if (!emailAutorizzata(email)) {
    return new Response(`Email ${email} non autorizzata`, { status: 403 });
  }

  const next = nextEncoded ? decodeURIComponent(nextEncoded) : '/admin';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/admin';

  const headers = new Headers({ Location: safeNext });
  headers.append('Set-Cookie', creaCookie(email));
  headers.append('Set-Cookie', statePulito());

  return new Response(null, { status: 302, headers });
};
