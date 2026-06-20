import type { APIRoute } from 'astro';
import { getAnthropicKey, getModel } from '../../lib/auth';
import { estraiIp, loggaEvento, nuovoRequestId, type EventoAPI } from '../../lib/log';

export const prerender = false;
// Hobby+Fluid Compute supporta fino a 300s. Polizze grandi (PDF condizioni generali
// + frontespizio) possono richiedere 60-100s ad Anthropic. Tengo 120s come margine
// — sotto questo valore l'app Android (readTimeout 120s) vedeva "read timed out"
// perché la function veniva killed mentre Claude stava ancora lavorando.
export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SYS =
  'Sei Sherlock, esperto analista di polizze assicurative italiane (d.lgs. 209/2005, artt. 1882-1932 c.c., normativa IVASS). ' +
  'Analizza il documento e chiama il tool report_analisi_polizza con tutti i campi dello schema.';

// Schema JSON forzato — l'output di Anthropic via tool_use È garantito JSON valido
// conforme a questo schema, evitando completamente l'errore "JSON AI malformato".
const SCHEMA_REPORT = {
  type: 'object',
  required: ['compagnia', 'tipo_polizza', 'rischio', 'riepilogo'],
  properties: {
    compagnia: { type: 'string' },
    tipo_polizza: { type: 'string' },
    numero_polizza: { type: 'string' },
    rischio: { type: 'string', enum: ['BASSO', 'MEDIO', 'ALTO', 'CRITICO'] },
    riepilogo: { type: 'string' },
    coperture: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          massimale: { type: 'string' },
        },
      },
    },
    esclusioni_critiche: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          gravita: { type: 'string', enum: ['alta', 'media', 'bassa'] },
          articolo: { type: 'string' },
        },
      },
    },
    clausole_rischiose: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          testo_originale: { type: 'string' },
          perche_rischiosa: { type: 'string' },
          gravita: { type: 'string', enum: ['alta', 'media', 'bassa'] },
        },
      },
    },
    termini_decadenza: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          evento: { type: 'string' },
          termine: { type: 'string' },
          conseguenza: { type: 'string' },
        },
      },
    },
    onere_prova: { type: 'string' },
    base_legale_contestabile: { type: 'array', items: { type: 'string' } },
    raccomandazioni: { type: 'array', items: { type: 'string' } },
    domande_da_fare: { type: 'array', items: { type: 'string' } },
  },
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
      tipo: 'analizza',
      esito,
      errore,
      requestId,
      ip,
      ms: Date.now() - t0,
    }).catch(() => undefined);

  const apiKey = getAnthropicKey();
  if (!apiKey) {
    void traccia('errore', 'ANTHROPIC_API_KEY mancante');
    return json({ error: 'Backend non configurato (ANTHROPIC_API_KEY mancante)' }, 500);
  }

  let payload: { documento_base64?: string; mime?: string };
  try {
    payload = await request.json();
  } catch {
    void traccia('bloccato', 'Body JSON non valido');
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const { documento_base64, mime } = payload;
  if (!documento_base64 || !mime) {
    void traccia('bloccato', 'documento_base64 e mime richiesti');
    return json({ error: 'documento_base64 e mime richiesti' }, 400);
  }

  const isPDF = mime === 'application/pdf';
  const content = isPDF
    ? [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: documento_base64 },
        },
        { type: 'text', text: 'Analizza questa polizza chiamando il tool.' },
      ]
    : [
        { type: 'image', source: { type: 'base64', media_type: mime, data: documento_base64 } },
        { type: 'text', text: 'Analizza questa polizza chiamando il tool.' },
      ];

  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: 8192,
      system: SYS,
      tools: [
        {
          name: 'report_analisi_polizza',
          description:
            'Restituisci il report completo dell\'analisi di una polizza assicurativa italiana.',
          input_schema: SCHEMA_REPORT,
        },
      ],
      tool_choice: { type: 'tool', name: 'report_analisi_polizza' },
      messages: [{ role: 'user', content }],
    }),
  });

  const data = await upstream.json();
  if (data?.error) {
    void traccia('errore', data.error.message ?? 'Errore Anthropic');
    return json({ error: data.error.message ?? 'Errore Anthropic' }, 502);
  }

  // Con tool_choice forzato, content contiene un blocco di tipo "tool_use" con .input
  // già parsato dal lato Anthropic in oggetto JSON valido.
  const blocchi = (data?.content ?? []) as Array<{ type: string; input?: unknown; text?: string }>;
  const toolUse = blocchi.find((b) => b.type === 'tool_use');

  if (toolUse?.input && typeof toolUse.input === 'object') {
    void traccia('ok');
    return json(toolUse.input);
  }

  // Fallback estremo: a volte il modello restituisce solo testo (es. rifiuto, errore di lettura).
  const testo = blocchi.find((b) => b.type === 'text')?.text ?? '';
  void traccia('errore', `Tool non chiamato. Risposta testuale: ${testo.slice(0, 160)}`);
  return json({ error: 'Risposta AI non valida (tool non chiamato)' }, 502);
};
