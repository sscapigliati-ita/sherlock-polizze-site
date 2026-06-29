import type { APIRoute } from 'astro';
import { getAnthropicKey, getModel, valutaCodice } from '../../lib/auth';
import { estraiIp, loggaEvento, nuovoRequestId, type EventoAPI } from '../../lib/log';

export const prerender = false;
// Cap massimo Hobby+Fluid Compute. Il modello Haiku 4.5 normalmente sta sotto
// i 60 secondi per 2 PDF, ma teniamo il margine massimo per PDF molto grossi.
export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_PDF_BYTES = 20 * 1024 * 1024;       // 20 MB per file
const MAX_BODY_BYTES = 35 * 1024 * 1024;      // 35 MB totale

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

// Valida che la stringa base64 decodificata inizi col magic byte di un PDF.
function isValidPdfB64(b64: string): boolean {
  try {
    const head = Buffer.from(b64.slice(0, 16), 'base64').toString('ascii');
    return head.startsWith('%PDF-');
  } catch { return false; }
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

  // Stima dimensione decodificata: base64 = ~1.33× il binario.
  const sizeA = Math.floor(polizzaA.length * 0.75);
  const sizeB = Math.floor(polizzaB.length * 0.75);
  if (sizeA > MAX_PDF_BYTES || sizeB > MAX_PDF_BYTES) {
    await traccia('bloccato', 'pdf_too_large');
    return new Response(JSON.stringify({ errore: 'PDF troppo grande (max 20 MB per file)' }), {
      status: 413, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidPdfB64(polizzaA) || !isValidPdfB64(polizzaB)) {
    await traccia('bloccato', 'invalid_pdf');
    return new Response(JSON.stringify({ errore: 'Uno dei file caricati non è un PDF valido' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
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

  // --- TODO Task 3: chiamata Anthropic + tool_use ---
  // Per ora rispondiamo 501 così possiamo testare la validazione in isolamento.
  return new Response(JSON.stringify({ errore: 'Implementazione AI in arrivo' }), {
    status: 501, headers: { 'Content-Type': 'application/json' },
  });
};
