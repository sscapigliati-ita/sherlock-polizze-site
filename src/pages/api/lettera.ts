import type { APIRoute } from 'astro';
import { getAnthropicKey, getModel, validaCodicePro } from '../../lib/auth';

export const prerender = false;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    return json({ error: 'Backend non configurato (ANTHROPIC_API_KEY mancante)' }, 500);
  }

  const codicePro = request.headers.get('x-pro-code') ?? '';
  if (!(await validaCodicePro(codicePro))) {
    return json({ error: 'Codice Pro non valido' }, 401);
  }

  let payload: { analisi?: any; tipo?: string; extra?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const { analisi, tipo, extra } = payload;
  if (!analisi || !tipo) {
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

  const system = LSYS[tipo] ?? LSYS.reclamo;

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
    return json({ error: data.error.message ?? 'Errore Anthropic' }, 502);
  }

  const testo: string = data?.content?.[0]?.text ?? '';
  return json({ lettera: testo });
};
