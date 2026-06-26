import type { APIRoute } from 'astro';
import { getAnthropicKey, getModel, valutaCodice } from '../../lib/auth';
import { estraiIp, loggaEvento, nuovoRequestId, type EventoAPI } from '../../lib/log';
import { marcaCodiceUsato } from '../../lib/storage';

export const prerender = false;
export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const LANG_NAMES = {
  it: 'italiano',
  en: 'English',
  es: 'español',
  fr: 'français',
  my: 'Burmese',
  zh: 'Chinese (Simplified)',
} as const;
type LangCode = keyof typeof LANG_NAMES;

function normalizzaLingua(raw: unknown): LangCode {
  return typeof raw === 'string' && raw in LANG_NAMES ? (raw as LangCode) : 'it';
}

function istruzioneLingua(lang: LangCode): string {
  return `\n\nIMPORTANT: Write the entire letter in ${LANG_NAMES[lang]}, including the header ("Città", "Data"), the salutation, body, legal references (translate Italian law article names), and signature line.`;
}

const LSYS: Record<string, string> = {
  reclamo:
    'Sei avvocato specializzato in diritto assicurativo italiano. Genera lettera di reclamo formale completa citando artt. pertinenti (1892 c.c., 1905, 32 C.A.P., normativa IVASS). Includi intestazione [Citta] [Data] e spazio firma. Solo testo piano.',
  ivass:
    "Sei avvocato specializzato in diritto assicurativo italiano. Genera esposto/ricorso IVASS completo. Inizia con All'Istituto per la Vigilanza sulle Assicurazioni (IVASS). Cita normativa violata. Solo testo piano.",
  diffida:
    'Sei avvocato specializzato in diritto assicurativo italiano. Genera diffida formale stragiudiziale. Fissa termine 15 giorni. Minaccia ricorso giudiziario e IVASS. Solo testo piano.',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const t0 = Date.now();
  const requestId = nuovoRequestId();
  const ip = estraiIp(request);
  const traccia = (esito: EventoAPI['esito'], errore?: string) =>
    loggaEvento({
      ts: new Date().toISOString(),
      tipo: 'lettera',
      esito,
      errore,
      requestId,
      ip,
      ms: Date.now() - t0,
    }).catch(() => undefined);

  const apiKey = getAnthropicKey();
  if (!apiKey) {
    await traccia('errore', 'ANTHROPIC_API_KEY mancante');
    return json({ error: 'Backend non configurato (ANTHROPIC_API_KEY mancante)' }, 500);
  }

  const codicePro = request.headers.get('x-pro-code') ?? '';
  const esito = await valutaCodice(codicePro);
  if (!esito.valido) {
    const msg =
      esito.motivo === 'gia_usato'
        ? 'Questo codice di acquisto singolo è già stato usato per generare una lettera. Acquistane uno nuovo o passa a Pro per illimitate.'
        : esito.motivo === 'scaduto'
          ? 'Codice scaduto.'
          : 'Codice non valido.';
    await traccia('bloccato', `Codice rifiutato (${esito.motivo})`);
    return json({ error: msg }, 401);
  }

  let payload: { analisi?: any; tipo?: string; extra?: string; lingua?: string };
  try {
    payload = await request.json();
  } catch {
    await traccia('bloccato', 'Body JSON non valido');
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const { analisi, tipo, extra } = payload;
  const lingua = normalizzaLingua(payload.lingua);
  if (!analisi || !tipo) {
    await traccia('bloccato', 'analisi e tipo richiesti');
    return json({ error: 'analisi e tipo richiesti' }, 400);
  }

  const esclusioni = (analisi.esclusioni_critiche ?? [])
    .map((e: any) => `- ${e.titolo}: ${e.descrizione}`)
    .join('\n');
  const baseLegale = (analisi.base_legale_contestabile ?? []).join('\n');

  const ctx =
    `Compagnia: ${analisi.compagnia ?? ''}\n` +
    `Tipo: ${analisi.tipo_polizza ?? ''}\n` +
    `Rischio: ${analisi.rischio ?? ''}\n` +
    `Riepilogo: ${analisi.riepilogo ?? ''}\n\n` +
    `Esclusioni:\n${esclusioni}\n\n` +
    `Base legale:\n${baseLegale}` +
    (extra ? `\n\nNote: ${extra}` : '');

  const system = (LSYS[tipo] ?? LSYS.reclamo) + istruzioneLingua(lingua);

  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: ctx }],
    }),
  });

  const data = await upstream.json();
  if (data?.error) {
    await traccia('errore', data.error.message ?? 'Errore Anthropic');
    return json({ error: data.error.message ?? 'Errore Anthropic' }, 502);
  }

  const testo: string = data?.content?.[0]?.text ?? '';

  // Codice singolo: una volta generata la lettera, lo marco come consumato.
  if (esito.tipo === 'singolo' && esito.record) {
    await marcaCodiceUsato(esito.record.codice);
  }

  await traccia('ok');
  return json({ lettera: testo });
};
