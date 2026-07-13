import type { APIRoute } from 'astro';
import { getAnthropicKey, getModel } from '../../lib/auth';
import { estraiIp, loggaEvento, nuovoRequestId, type EventoAPI } from '../../lib/log';
import { ga4TrackServer } from '../../lib/ga4';

// Bucket del tempo di processing per non inviare valori grezzi (ridurrebbe la
// cardinalità dei parametri GA4 e potrebbe rivelare pattern di infrastruttura).
function processingBucket(ms: number): string {
  if (ms < 5_000) return '0-5s';
  if (ms < 15_000) return '5-15s';
  if (ms < 30_000) return '15-30s';
  if (ms < 60_000) return '30-60s';
  return '60s+';
}

export const prerender = false;
// Cap massimo Hobby+Fluid Compute. Il modello Haiku 4.5 normalmente sta sotto i
// 30 secondi, ma teniamo il margine massimo per i casi peggiori (PDF di 30+ pagine).
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
  return `\n\nIMPORTANT: Respond entirely in ${LANG_NAMES[lang]}, regardless of the document's original language. All headings, labels, summary text, exclusion descriptions, recommendations, and tool field values must be in ${LANG_NAMES[lang]}.`;
}

const SYS_BASE =
  'Sei Sherlock, esperto analista di polizze assicurative italiane (d.lgs. 209/2005, artt. 1882-1932 c.c., normativa IVASS). ' +
  'Analizza il documento e chiama il tool report_analisi_polizza con tutti i campi dello schema.';

const SYS_CON_SINISTRO =
  SYS_BASE +
  ' L\'utente ha descritto un sinistro: valuta se quel sinistro specifico sarebbe coperto dalla polizza, ' +
  'incrociando le coperture, esclusioni, clausole e termini con i fatti descritti. Compila il campo ' +
  'valutazione_sinistro con esito chiaro, motivazione tecnica, clausole della polizza che decidono il caso, ' +
  'e una indicazione operativa concreta su cosa fare.';

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
    valutazione_sinistro: {
      type: 'object',
      description:
        "Valutazione della copertura del sinistro descritto dall'utente. Compila SOLO se l'utente ha descritto un sinistro nel proprio messaggio. Lascia null altrimenti.",
      properties: {
        esito: {
          type: 'string',
          enum: ['COPERTO', 'NON_COPERTO', 'DUBBIO', 'DA_APPROFONDIRE'],
        },
        motivazione: { type: 'string', description: 'Spiegazione tecnica dell\'esito, citando articoli/clausole della polizza' },
        clausole_rilevanti: {
          type: 'array',
          items: { type: 'string' },
          description: 'Articoli e clausole della polizza che decidono il caso',
        },
        cosa_fare: { type: 'string', description: 'Azione operativa concreta consigliata' },
      },
    },
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
  // NB: awaitare traccia() prima di ritornare la response. Le promise non
  // awaited su Vercel serverless possono essere sospese a metà, lasciando
  // l'evento nel log ma il counter non incrementato.
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
    await traccia('errore', 'ANTHROPIC_API_KEY mancante');
    return json({ error: 'Backend non configurato (ANTHROPIC_API_KEY mancante)' }, 500);
  }

  let payload: { documento_base64?: string; mime?: string; sinistro_testo?: string; lingua?: string };
  try {
    payload = await request.json();
  } catch {
    await traccia('bloccato', 'Body JSON non valido');
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const { documento_base64, mime } = payload;
  const sinistroTesto = (payload.sinistro_testo ?? '').trim().slice(0, 3000);
  const lingua = normalizzaLingua(payload.lingua);
  if (!documento_base64 || !mime) {
    await traccia('bloccato', 'documento_base64 e mime richiesti');
    return json({ error: 'documento_base64 e mime richiesti' }, 400);
  }

  const isPDF = mime === 'application/pdf';
  const promptUtente = sinistroTesto
    ? `Analizza questa polizza chiamando il tool. L'utente ha descritto questo sinistro: "${sinistroTesto}". Compila valutazione_sinistro nel tool.`
    : 'Analizza questa polizza chiamando il tool.';
  const content = isPDF
    ? [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: documento_base64 },
        },
        { type: 'text', text: promptUtente },
      ]
    : [
        { type: 'image', source: { type: 'base64', media_type: mime, data: documento_base64 } },
        { type: 'text', text: promptUtente },
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
      system: (sinistroTesto ? SYS_CON_SINISTRO : SYS_BASE) + istruzioneLingua(lingua),
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
    const msgRaw = String(data.error.message ?? '');
    await traccia('errore', msgRaw);
    // Traduco gli errori più frequenti di Anthropic in italiano user-friendly
    let msg = msgRaw;
    if (/prompt is too long|too many tokens|context length/i.test(msgRaw)) {
      msg =
        'Documento troppo grande per essere analizzato in un\'unica volta. ' +
        'Suggerimento: carica solo le sezioni più importanti — frontespizio, condizioni generali e clausole speciali — invece dell\'intero PDF.';
    } else if (/could not process image|invalid_request_error|unsupported.*media/i.test(msgRaw)) {
      msg = 'Documento non leggibile. Assicurati che la foto sia nitida e ben illuminata, o carica un PDF testuale.';
    } else if (/rate_limit|overloaded/i.test(msgRaw)) {
      msg = 'Servizio AI temporaneamente sovraccarico. Riprova tra qualche minuto.';
    }
    return json({ error: msg }, 502);
  }

  // Con tool_choice forzato, content contiene un blocco di tipo "tool_use" con .input
  // già parsato dal lato Anthropic in oggetto JSON valido.
  const blocchi = (data?.content ?? []) as Array<{ type: string; input?: unknown; text?: string }>;
  const toolUse = blocchi.find((b) => b.type === 'tool_use');

  if (toolUse?.input && typeof toolUse.input === 'object') {
    await traccia('ok');
    // GA4 analysis_complete: scatta SOLO su completamento reale, dopo la risposta
    // AI valida via tool_use. Nessun dato personale nei parametri (no filename,
    // no testo documento, no sinistro_testo, no email). Il request_id è
    // random per invocazione → non tracciabile all'utente.
    void ga4TrackServer('analysis_complete', requestId, {
      analysis_type: sinistroTesto ? 'with_incident' : 'basic',
      document_type: isPDF ? 'pdf' : 'image',
      processing_time_bucket: processingBucket(Date.now() - t0),
      language: lingua,
    });
    return json(toolUse.input);
  }

  // Fallback estremo: a volte il modello restituisce solo testo (es. rifiuto, errore di lettura).
  const testo = blocchi.find((b) => b.type === 'text')?.text ?? '';
  await traccia('errore', `Tool non chiamato. Risposta testuale: ${testo.slice(0, 160)}`);
  return json({ error: 'Risposta AI non valida (tool non chiamato)' }, 502);
};
