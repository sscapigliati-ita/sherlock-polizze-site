import type { APIRoute } from 'astro';
import { getAnthropicKey, getModel, valutaCodice } from '../../lib/auth';
import { estraiIp, loggaEvento, nuovoRequestId, type EventoAPI } from '../../lib/log';
import { marcaCodiceUsato } from '../../lib/storage';
import { AI_UNTRUSTED_DATA_RULES, buildLetterEvidence } from '../../lib/ai-safety';

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
  return `\n\nWrite the draft in ${LANG_NAMES[lang]}. Keep official Italian legal citations in their original form and do not invent translations or references.`;
}

const LSYS = {
  reclamo:
    'Prepara una bozza prudente di reclamo assicurativo. Usa segnaposto per dati mancanti e cita norme soltanto se presenti nelle evidenze e pertinenti.',
  ivass:
    "Prepara una bozza prudente di esposto all'IVASS. Non descrivere IVASS come giudice della controversia e non inventare violazioni.",
  diffida:
    'Prepara una bozza prudente di comunicazione formale. Non fissare termini, conseguenze o iniziative giudiziarie se non supportati dalle evidenze; usa segnaposto da verificare.',
} as const;
type LetterType = keyof typeof LSYS;

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
  if (!(tipo in LSYS)) {
    await traccia('bloccato', 'invalid_letter_type');
    return json({ error: 'INVALID_LETTER_TYPE' }, 400);
  }
  const letterType = tipo as LetterType;
  const ctx = buildLetterEvidence(analisi as Record<string, unknown>, letterType, extra);
  const system = `${LSYS[letterType]}\n${AI_UNTRUSTED_DATA_RULES}${istruzioneLingua(lingua)}\nReturn a draft, not legal advice. Put uncertainties and checks in avvertenze.`;

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
      tools: [{
        name: 'genera_bozza_lettera',
        description: 'Restituisce la bozza e le verifiche necessarie.',
        input_schema: {
          type: 'object',
          required: ['lettera', 'avvertenze'],
          properties: {
            lettera: { type: 'string', minLength: 1 },
            avvertenze: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          },
        },
      }],
      tool_choice: { type: 'tool', name: 'genera_bozza_lettera' },
      messages: [{ role: 'user', content: ctx }],
    }),
  });

  const data = await upstream.json();
  if (data?.error) {
    await traccia('errore', 'anthropic_error');
    return json({ error: 'AI_PROVIDER_ERROR' }, 502);
  }

  const toolUse = Array.isArray(data?.content)
    ? data.content.find((block: any) => block?.type === 'tool_use' && block?.name === 'genera_bozza_lettera')
    : undefined;
  const testo = typeof toolUse?.input?.lettera === 'string' ? toolUse.input.lettera.trim() : '';
  const avvertenze = Array.isArray(toolUse?.input?.avvertenze)
    ? toolUse.input.avvertenze.filter((item: unknown): item is string => typeof item === 'string').slice(0, 10)
    : [];
  if (!testo) {
    await traccia('errore', 'ai_output_invalid');
    return json({ error: 'AI_OUTPUT_INVALID' }, 502);
  }

  // Codice singolo: una volta generata la lettera, lo marco come consumato.
  if (esito.tipo === 'singolo' && esito.record) {
    await marcaCodiceUsato(esito.record.codice);
  }

  await traccia('ok');
  return json({ lettera: testo, avvertenze });
};
