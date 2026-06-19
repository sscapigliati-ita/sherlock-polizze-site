import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'sherlock_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni

function env(name: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name];
  if (!v) throw new Error(`Env var mancante: ${name}`);
  return v;
}

function envOpt(name: string): string | undefined {
  return (
    (import.meta.env as Record<string, string | undefined>)[name] ?? process.env[name] ?? undefined
  );
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

type Payload = { email: string; iat: number };

function firma(payloadJson: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payloadJson).digest());
}

export function creaCookie(email: string): string {
  const payload: Payload = { email, iat: Math.floor(Date.now() / 1000) };
  const payloadJson = JSON.stringify(payload);
  const sig = firma(payloadJson, env('SESSION_SECRET'));
  const valore = `${b64url(payloadJson)}.${sig}`;
  return `${COOKIE_NAME}=${valore}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function cookieScadenza(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function verificaCookie(cookieHeader: string | null): Payload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const [p64, sig] = match[1].split('.');
  if (!p64 || !sig) return null;

  let payloadJson: string;
  try {
    payloadJson = b64urlDecode(p64).toString('utf8');
  } catch {
    return null;
  }

  const secret = envOpt('SESSION_SECRET');
  if (!secret) return null;

  const sigAttesa = firma(payloadJson, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(sigAttesa);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(payloadJson) as Payload;
    const adminEmail = envOpt('ADMIN_EMAIL');
    if (adminEmail && payload.email.toLowerCase() !== adminEmail.toLowerCase()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------------- OAuth Google ---------------- */

const STATE_COOKIE = 'sherlock_oauth_state';

export function nuovoState(): { state: string; cookie: string } {
  const state = b64url(randomBytes(24));
  const cookie = `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  return { state, cookie };
}

export function verificaState(cookieHeader: string | null, ricevuto: string | null): boolean {
  if (!cookieHeader || !ricevuto) return false;
  const m = cookieHeader.match(new RegExp(`${STATE_COOKIE}=([^;]+)`));
  if (!m) return false;
  return m[1] === ricevuto;
}

export function statePulito(): string {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function urlAutorizzazioneGoogle(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function scambiaCodicePerEmail(code: string, redirectUri: string): Promise<string> {
  const tokRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokRes.ok) {
    const t = await tokRes.text();
    throw new Error(`Token exchange fallito: ${t}`);
  }
  const { access_token } = (await tokRes.json()) as { access_token: string };

  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) throw new Error('Recupero userinfo fallito');
  const u = (await userRes.json()) as { email?: string; email_verified?: boolean };

  if (!u.email || u.email_verified === false) throw new Error('Email non verificata');
  return u.email;
}

export function emailAutorizzata(email: string): boolean {
  const admin = envOpt('ADMIN_EMAIL');
  if (!admin) return false;
  return email.toLowerCase() === admin.toLowerCase();
}
