import type { APIRoute } from 'astro';
import { catturaOrdinePayPal, calcolaScadenza, PIANI, type CaptureResult } from '../../../lib/paypal';
import { generaCodicePro } from '../../../lib/codici';
import {
  salvaCodicePro,
  incrementaFounderVenduti,
  leggiCodicePro,
  registraReferralAcquisto,
  estendiScadenza,
  cercaPerPayPalOrderId,
  registraPayPalOrderId,
  iniziaPayPalProcessing,
  leggiPayPalProcessing,
  aggiornaPayPalProcessing,
  leggiPayPalGa4Context,
  type PayPalProcessingRecord,
} from '../../../lib/storage';
import { inviaMailCodice } from '../../../lib/mail';
import { ga4TrackServer } from '../../../lib/ga4';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function respostaSuccesso(rec: PayPalProcessingRecord, mailInviata: boolean) {
  return {
    codice: rec.code ?? '',
    piano: rec.plan ?? '',
    // Email non è nel record (per privacy): il client già la conosce dal form.
    dataScadenza: rec.plan
      ? calcolaScadenza(rec.plan as any, new Date(rec.createdAt))
      : undefined,
    mailInviata,
    idempotent: true,
  };
}

// Esegue solo i side effect non ancora completati (checkpoints). Idempotente:
// se il record è già completed, ritorna direttamente il codice.
async function completaEffetti(
  orderId: string,
  rec: PayPalProcessingRecord,
  cattura: CaptureResult | null,
): Promise<{ record: PayPalProcessingRecord; codice: string; mailInviata: boolean }> {
  let corrente = rec;
  const codice = corrente.code ?? generaCodicePro();
  const piano = corrente.plan ?? cattura?.piano;
  const email = cattura?.email ?? '';
  if (!piano) {
    throw new Error('Piano indisponibile per completamento processing record');
  }
  const dataEmissione = corrente.createdAt;
  const dataScadenza = calcolaScadenza(piano as any, new Date(dataEmissione));
  const isSingolo = piano === 'singolo';

  // Checkpoint 1: salva codice Pro
  if (!corrente.codeSaved) {
    await salvaCodicePro({
      codice,
      email,
      piano: piano as any,
      dataEmissione,
      dataScadenza,
      paypalOrderId: orderId,
      ...(isSingolo ? { usato: false } : {}),
    });
    await registraPayPalOrderId(orderId, codice).catch(() => undefined);
    corrente = (await aggiornaPayPalProcessing(orderId, {
      code: codice,
      plan: piano,
      codeSaved: true,
    })) ?? corrente;
  }

  // Checkpoint 2: contatore Founder
  if (piano === 'founder' && !corrente.founderCounterUpdated) {
    await incrementaFounderVenduti().catch(() => undefined);
    corrente = (await aggiornaPayPalProcessing(orderId, {
      founderCounterUpdated: true,
    })) ?? corrente;
  } else if (piano !== 'founder' && !corrente.founderCounterUpdated) {
    // Non-founder: nessun counter da aggiornare, ma marchiamo il checkpoint
    // per uniformità (evita di rientrare in questo ramo su retry).
    corrente = (await aggiornaPayPalProcessing(orderId, {
      founderCounterUpdated: true,
    })) ?? corrente;
  }

  // Referral (idempotente sull'orderId via SADD in storage.ts)
  if (cattura?.ref && cattura.ref !== codice) {
    try {
      const referrer = await leggiCodicePro(cattura.ref);
      const validoReferrer =
        referrer &&
        referrer.piano !== 'singolo' &&
        referrer.email.toLowerCase() !== email.toLowerCase();
      if (validoReferrer) {
        const primo = await registraReferralAcquisto(cattura.ref, orderId);
        if (primo) {
          await estendiScadenza(cattura.ref, 1).catch(() => undefined);
        }
      }
    } catch {
      /* referral best-effort */
    }
  }

  // Checkpoint 3: invio email
  let mailInviata = corrente.emailSent;
  if (!corrente.emailSent && email) {
    const mail = await inviaMailCodice({
      email,
      codice,
      piano: PIANI[piano as keyof typeof PIANI].nome,
      dataScadenza,
      tipo: PIANI[piano as keyof typeof PIANI].tipo,
    });
    if (mail.ok) {
      mailInviata = true;
      corrente = (await aggiornaPayPalProcessing(orderId, { emailSent: true })) ?? corrente;
    }
  }

  // Checkpoint 4: GA4 purchase (server-side, solo se context valido e consenso)
  if (!corrente.analyticsSent) {
    // Legge il context Analytics salvato in create-order. Se assente o senza
    // consenso, ga4TrackServer è no-op silenziosa.
    const ga4Ctx =
      corrente.ga4Context ?? (await leggiPayPalGa4Context(orderId).catch(() => null));
    void ga4TrackServer(
      'purchase',
      ga4Ctx,
      {
        // transaction_id = captureId se disponibile (più stabile per idempotenza
        // GA4), fallback a orderId.
        transaction_id: corrente.captureId ?? cattura?.captureId ?? orderId,
        value: Number(PIANI[piano as keyof typeof PIANI]?.prezzo) || 0,
        currency: 'EUR',
        piano,
      },
      [
        {
          item_id: piano,
          item_name: PIANI[piano as keyof typeof PIANI]?.nome || piano,
          item_category: piano === 'singolo' ? 'consulenza' : 'abbonamento',
          price: Number(PIANI[piano as keyof typeof PIANI]?.prezzo) || 0,
          quantity: 1,
          currency: 'EUR',
        },
      ],
    );
    corrente = (await aggiornaPayPalProcessing(orderId, { analyticsSent: true })) ?? corrente;
  }

  // Marca record come completed
  corrente = (await aggiornaPayPalProcessing(orderId, { status: 'completed' })) ?? corrente;

  return { record: corrente, codice, mailInviata };
}

export const POST: APIRoute = async ({ request }) => {
  let payload: { orderId?: string; _ga4Context?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body JSON non valido' }, 400);
  }

  const orderId = (payload.orderId ?? '').trim();
  if (!orderId) {
    return json({ error: 'orderId richiesto' }, 400);
  }

  // ==== Recovery/idempotenza basata su PayPalProcessingRecord ====
  // Se un record esiste già, gestiamo tutti i casi (completed/processing/failed)
  // SENZA rifare capture, generare nuovi codici, o duplicare side effect.
  const esistente = await leggiPayPalProcessing(orderId).catch(() => null);
  if (esistente) {
    if (esistente.status === 'completed' && esistente.code) {
      // Fast path: transazione già andata a buon fine, ritorna il codice esistente.
      return json(respostaSuccesso(esistente, esistente.emailSent));
    }
    if (esistente.status === 'failed') {
      return json({ error: esistente.errorReason ?? 'Ordine fallito in precedenza' }, 402);
    }
    // status === 'processing': crash recovery. Ritentiamo il capture PayPal
    // (idempotente lato PayPal grazie a PayPal-Request-Id stabile) e completiamo
    // gli effetti mancanti secondo i checkpoint.
    let cattura: CaptureResult | null = null;
    try {
      cattura = await catturaOrdinePayPal(orderId);
    } catch (e: any) {
      // Se il capture non riesce, restituiamo 202 "processing" — il client
      // dovrebbe riprovare senza generare stato inconsistente.
      return json(
        {
          status: 'processing',
          error: `Recupero in corso: ${String(e?.message || 'capture retry failed').slice(0, 100)}`,
        },
        202,
      );
    }
    if (cattura.captureId && !esistente.captureId) {
      await aggiornaPayPalProcessing(orderId, { captureId: cattura.captureId });
    }
    const completato = await completaEffetti(orderId, esistente, cattura);
    return json(respostaSuccesso(completato.record, completato.mailInviata));
  }

  // Legacy path: se esiste solo il vecchio indice paypal_order:<id> ma non il
  // nuovo processing record, restituisci il codice esistente in modo
  // retrocompatibile (record pre-migrazione).
  const legacy = await cercaPerPayPalOrderId(orderId).catch(() => null);
  if (legacy) {
    return json({
      codice: legacy.codice,
      piano: legacy.piano,
      email: legacy.email,
      dataScadenza: legacy.dataScadenza,
      mailInviata: true,
      idempotent: true,
    });
  }

  // ==== Nuovo ordine: crea record processing atomicamente ====
  const ga4Ctx =
    (await leggiPayPalGa4Context(orderId).catch(() => null)) ?? null;
  const { record: rec, created } = await iniziaPayPalProcessing(orderId, ga4Ctx);
  if (!created) {
    // Race condition: un'altra invocazione ha creato il record tra la nostra
    // lettura e la scrittura. Rientriamo nel path recovery.
    if (rec.status === 'completed' && rec.code) {
      return json(respostaSuccesso(rec, rec.emailSent));
    }
    // Per non duplicare capture su race, ritorna 202 al client per retry.
    return json({ status: 'processing', message: 'Recupero in corso' }, 202);
  }

  // Chiama PayPal capture (idempotente via PayPal-Request-Id)
  let cattura: CaptureResult;
  try {
    cattura = await catturaOrdinePayPal(orderId);
  } catch (e: any) {
    await aggiornaPayPalProcessing(orderId, {
      status: 'failed',
      errorReason: String(e?.message || 'capture_failed').slice(0, 200),
    });
    void ga4TrackServer('paypal_cancel', ga4Ctx, {
      reason: String(e?.message || 'capture_failed').slice(0, 100),
    });
    return json({ error: e?.message ?? 'Errore cattura PayPal' }, 502);
  }

  if (cattura.status !== 'COMPLETED' && cattura.status !== 'APPROVED') {
    await aggiornaPayPalProcessing(orderId, {
      status: 'failed',
      errorReason: 'status_' + cattura.status,
      captureId: cattura.captureId,
    });
    void ga4TrackServer('paypal_cancel', ga4Ctx, { reason: 'status_' + cattura.status });
    return json({ error: `Pagamento non completato (status: ${cattura.status})` }, 402);
  }

  // Registra il captureId sul record prima di eseguire i side effect
  if (cattura.captureId) {
    await aggiornaPayPalProcessing(orderId, { captureId: cattura.captureId });
  }

  const completato = await completaEffetti(orderId, rec, cattura);
  return json({
    codice: completato.codice,
    piano: cattura.piano,
    email: cattura.email,
    dataScadenza: calcolaScadenza(cattura.piano, new Date(rec.createdAt)),
    mailInviata: completato.mailInviata,
    referralApplicato: cattura.ref ? true : false,
  });
};
