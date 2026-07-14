import type { APIRoute } from 'astro';
import { validateBase64Upload } from '../../lib/upload-validation';
import { getAnthropicKey, getModel, valutaCodice } from '../../lib/auth';
import { estraiIp, loggaEvento, nuovoRequestId, type EventoAPI } from '../../lib/log';

export const prerender = false;
// Cap massimo Hobby+Fluid Compute. Il modello Haiku 4.5 normalmente sta sotto
// i 60 secondi per 2 PDF, ma teniamo il margine massimo per PDF molto grossi.
export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_PDF_BYTES = 20 * 1024 * 1024;       // 20 MB per file
const MAX_BODY_BYTES = 35 * 1024 * 1024;      // 35 MB totale

const SYS = (
  'Sei Sherlock, esperto analista di polizze assicurative italiane ' +
  '(d.lgs. 209/2005, artt. 1882-1932 c.c., normativa IVASS). ' +
  'Ti vengono fornite DUE polizze etichettate "Polizza A" e "Polizza B". ' +
  'Confronta condizioni, coperture, esclusioni, massimali, franchigie e clausole, ' +
  'evidenziando solo le differenze rilevanti per la scelta. ' +
  'Compila lo schema report_confronto_polizze in modo esaustivo. ' +
  'Se le polizze sono di tipologie diverse (es. una auto e una casa) ' +
  'imposta avviso_compatibilita e lascia gli altri campi minimi. ' +
  'Sii imparziale: la raccomandazione "dipende" è una conclusione legittima ' +
  'quando i pro/contro si bilanciano in modo dipendente dal profilo utente. ' +
  'Caveat OBBLIGATORIO: scrivi sempre nel campo caveat che la valutazione è ' +
  'algoritmica e non sostituisce un parere professionale.'
);

// Schema JSON forzato — l'output di Anthropic via tool_use è garantito JSON
// valido conforme a questo schema. Stesso pattern di analizza.ts.
const SCHEMA_CONFRONTO = {
  type: 'object',
  required: ['polizze', 'avviso_compatibilita', 'tabella_sintesi', 'differenze_chiave', 'esclusioni_solo_a', 'esclusioni_solo_b', 'coperture_solo_a', 'coperture_solo_b', 'verdetto'],
  properties: {
    polizze: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'object',
        required: ['etichetta', 'compagnia', 'tipo_polizza'],
        properties: {
          etichetta: { type: 'string', enum: ['A', 'B'] },
          compagnia: { type: 'string' },
          tipo_polizza: { type: 'string' },
          numero_polizza: { type: 'string' },
        },
      },
    },
    avviso_compatibilita: { type: ['string', 'null'] },
    tabella_sintesi: {
      type: 'array',
      items: {
        type: 'object',
        required: ['aspetto', 'valore_a', 'valore_b', 'vantaggio'],
        properties: {
          aspetto: { type: 'string' },
          valore_a: { type: 'string' },
          valore_b: { type: 'string' },
          vantaggio: { type: 'string', enum: ['a', 'b', 'pari', 'non_confrontabile'] },
        },
      },
    },
    differenze_chiave: {
      type: 'array',
      items: {
        type: 'object',
        required: ['titolo', 'descrizione', 'impatto', 'vantaggio'],
        properties: {
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          impatto: { type: 'string', enum: ['alto', 'medio', 'basso'] },
          vantaggio: { type: 'string', enum: ['a', 'b'] },
        },
      },
    },
    esclusioni_solo_a: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          gravita: { type: 'string', enum: ['alta', 'media', 'bassa'] },
        },
      },
    },
    esclusioni_solo_b: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titolo: { type: 'string' },
          descrizione: { type: 'string' },
          gravita: { type: 'string', enum: ['alta', 'media', 'bassa'] },
        },
      },
    },
    coperture_solo_a: {
      type: 'array',
      items: {
        type: 'object',
        properties: { titolo: { type: 'string' }, descrizione: { type: 'string' } },
      },
    },
    coperture_solo_b: {
      type: 'array',
      items: {
        type: 'object',
        properties: { titolo: { type: 'string' }, descrizione: { type: 'string' } },
      },
    },
    verdetto: {
      type: 'object',
      required: ['raccomandazione', 'motivazione', 'caveat', 'quando_scegliere_a', 'quando_scegliere_b'],
      properties: {
        raccomandazione: { type: 'string', enum: ['a', 'b', 'dipende'] },
        motivazione: { type: 'string' },
        caveat: { type: 'string' },
        quando_scegliere_a: { type: 'string' },
        quando_scegliere_b: { type: 'string' },
      },
    },
  },
};

// Retry singolo con backoff fisso 5s su errori 5xx Anthropic. Non ritenta su
// errori 4xx (es. invalid_request) né su timeout (li lasciamo bubblare per non
// raddoppiare l'attesa utente che è già 30-40s).
async function chiamaAnthropicConRetry(reqInit: RequestInit): Promise<Response> {
  let r = await fetch(ANTHROPIC_API_URL, reqInit);
  if (r.status >= 500 && r.status < 600) {
    await new Promise((res) => setTimeout(res, 5000));
    r = await fetch(ANTHROPIC_API_URL, reqInit);
  }
  return r;
}

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
  return `\n\nIMPORTANT: Respond entirely in ${LANG_NAMES[lang]}, regardless of the documents' original language. All headings, labels, summary text, exclusion descriptions, table values, and recommendations must be in ${LANG_NAMES[lang]}.`;
}

export const POST: APIRoute = async ({ request }) => {
  const t0 = Date.now();
  const requestId = nuovoRequestId();
  const ip = estraiIp(request);

  // Helper di logging identico a analizza.ts: l'await garantisce che il counter
  // KV venga incrementato anche se l'invocazione serverless viene sospesa subito
  // dopo la response.
  const traccia = (esito: EventoAPI['esito'], errore?: string) =>
    loggaEvento({
      ts: new Date().toISOString(),
      tipo: 'compara',
      esito,
      errore,
      requestId,
      ip,
      ms: Date.now() - t0,
    }).catch(() => undefined);

  // --- Validazione body ---
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    await traccia('bloccato', 'body_too_large');
    return new Response(JSON.stringify({ errore: 'Documenti troppo grandi (max 35 MB totali)' }), {
      status: 413, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    await traccia('bloccato', 'invalid_json');
    return new Response(JSON.stringify({ errore: 'JSON non valido' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const polizzaA = typeof body?.polizzaA === 'string' ? body.polizzaA : '';
  const polizzaB = typeof body?.polizzaB === 'string' ? body.polizzaB : '';
  const codice = typeof body?.codice === 'string' ? body.codice : '';
  const lang = normalizzaLingua(body?.lang);

  if (!polizzaA || !polizzaB || !codice) {
    await traccia('bloccato', 'missing_field');
    return new Response(JSON.stringify({ errore: 'Campi polizzaA, polizzaB e codice obbligatori' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const uploadA = validateBase64Upload({ data: polizzaA, declaredMime: 'application/pdf', maxBytes: MAX_PDF_BYTES });
  const uploadB = validateBase64Upload({ data: polizzaB, declaredMime: 'application/pdf', maxBytes: MAX_PDF_BYTES });
  if (!uploadA.ok || !uploadB.ok) {
    const code = !uploadA.ok ? uploadA.code : !uploadB.ok ? uploadB.code : 'UNSUPPORTED_FILE_SIGNATURE';
    await traccia('bloccato', code.toLowerCase());
    return new Response(JSON.stringify({ errore: code }), {
      status: code === 'FILE_TOO_LARGE' ? 413 : 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Paywall: codice Pro obbligatorio ---
  const esito = await valutaCodice(codice);
  if (!esito.valido || (esito.tipo !== 'pro' && esito.tipo !== 'dev' && esito.tipo !== 'whitelist')) {
    await traccia('bloccato', 'no_pro');
    return new Response(JSON.stringify({ errore: 'Codice Pro richiesto', paywall: true }), {
      status: 402, headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Chiamata Anthropic ---
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    await traccia('errore', 'anthropic_key_missing');
    return new Response(JSON.stringify({ errore: 'Servizio non configurato' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const reqBody = {
    model: getModel(),
    max_tokens: 8000,
    system: SYS + istruzioneLingua(lang),
    tools: [{
      name: 'report_confronto_polizze',
      description: 'Restituisce il confronto strutturato fra le due polizze',
      input_schema: SCHEMA_CONFRONTO,
    }],
    tool_choice: { type: 'tool', name: 'report_confronto_polizze' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Polizza A (file allegato di seguito):' },
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: polizzaA } },
        { type: 'text', text: 'Polizza B (file allegato di seguito):' },
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: polizzaB } },
        { type: 'text', text: "Confronta le due polizze e chiama il tool con l'analisi." },
      ],
    }],
  };

  let r: Response;
  try {
    r = await chiamaAnthropicConRetry({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e: any) {
    await traccia('errore', `fetch_failed: ${e?.message ?? e}`);
    return new Response(JSON.stringify({ errore: 'Rete o timeout verso il servizio AI' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message ?? `anthropic_${r.status}`;
    await traccia('errore', `anthropic_${r.status}: ${String(msg).slice(0, 200)}`);
    return new Response(JSON.stringify({ errore: 'Errore servizio AI', dettaglio: msg }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Anthropic con tool_choice forzato ritorna content come array di blocchi:
  // cerchiamo il primo blocco di tipo 'tool_use' con il nostro tool name.
  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  const toolUse = blocks.find((b) => b?.type === 'tool_use' && b?.name === 'report_confronto_polizze');
  if (!toolUse?.input) {
    await traccia('errore', 'no_tool_use');
    return new Response(JSON.stringify({ errore: "Risposta AI senza tool_use (raro: tool_choice forzato)" }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  await traccia('ok');
  return new Response(JSON.stringify(toolUse.input), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
