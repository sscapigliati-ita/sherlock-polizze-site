import type { APIRoute } from 'astro';
import { getAnthropicKey, getModel } from '../../lib/auth';
import { estraiIp, loggaEvento, nuovoRequestId, type EventoAPI } from '../../lib/log';

export const prerender = false;
// Hobby+Fluid Compute supporta fino a 300s; Anthropic con un PDF intero impiega
// in media 20-40s, quindi 60s è una soglia confortevole per non andare in timeout
// (default Hobby pre-Fluid era 10s, motivo per cui l'app vedeva "errore" dopo ~10s)
export const maxDuration = 60;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SYS =
  'Sei Sherlock, esperto analista di polizze assicurative italiane (d.lgs. 209/2005, artt. 1882-1932 c.c., normativa IVASS). ' +
  'Analizza il documento e restituisci SOLO un JSON valido. ' +
  'Struttura: {"compagnia":"","tipo_polizza":"","numero_polizza":"","rischio":"BASSO|MEDIO|ALTO|CRITICO","riepilogo":"",' +
  '"coperture":[{"titolo":"","descrizione":"","massimale":""}],' +
  '"esclusioni_critiche":[{"titolo":"","descrizione":"","gravita":"alta|media|bassa","articolo":""}],' +
  '"clausole_rischiose":[{"titolo":"","testo_originale":"","perche_rischiosa":"","gravita":"alta|media|bassa"}],' +
  '"termini_decadenza":[{"evento":"","termine":"","conseguenza":""}],' +
  '"onere_prova":"","base_legale_contestabile":[""],"raccomandazioni":[""],"domande_da_fare":[""]}';

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
        { type: 'text', text: 'Analizza questa polizza.' },
      ]
    : [
        { type: 'image', source: { type: 'base64', media_type: mime, data: documento_base64 } },
        { type: 'text', text: 'Analizza questa polizza.' },
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
      max_tokens: 4096,
      system: SYS,
      messages: [{ role: 'user', content }],
    }),
  });

  const data = await upstream.json();
  if (data?.error) {
    void traccia('errore', data.error.message ?? 'Errore Anthropic');
    return json({ error: data.error.message ?? 'Errore Anthropic' }, 502);
  }

  const testo: string = data?.content?.[0]?.text ?? '';
  const match = testo.match(/\{[\s\S]*\}/);
  if (!match) {
    void traccia('errore', 'Risposta AI non valida');
    return json({ error: 'Risposta AI non valida' }, 502);
  }

  try {
    const analisi = JSON.parse(match[0]);
    void traccia('ok');
    return json(analisi);
  } catch {
    void traccia('errore', 'JSON AI malformato');
    return json({ error: 'JSON AI malformato' }, 502);
  }
};
