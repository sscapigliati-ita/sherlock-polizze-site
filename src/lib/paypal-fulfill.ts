import { catturaOrdinePayPal, calcolaScadenza, PIANI, type CaptureResult } from './paypal';
import { generaCodicePro } from './codici';
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
} from './storage';
import { inviaMailCodice } from './mail';
import { ga4TrackServer } from './ga4';
import { isRealPurchase } from './purchase-classification';

// Evasione di un ordine PayPal (capture + codice Pro + email). Condivisa da:
//  - /api/paypal/capture-order (ritorno del cliente sulla pagina di conferma)
//  - /api/paypal/webhook (recupero se il cliente non torna sul sito)
// Idempotente: ogni side effect ha un checkpoint nel PayPalProcessingRecord.

export type EvasioneEsito = { status: number; body: Record<string, unknown> };

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
  const paymentEnvironment = cattura?.paymentEnvironment ?? corrente.paymentEnvironment;
  const commercialStatus = paymentEnvironment === 'production' ? 'reale' : paymentEnvironment === 'sandbox' ? 'test' : corrente.commercialStatus;
  if (commercialStatus !== corrente.commercialStatus || paymentEnvironment !== corrente.paymentEnvironment) {
    corrente = (await aggiornaPayPalProcessing(orderId, {
      commercialStatus,
      commercialStatusReason: commercialStatus === 'reale' ? 'paypal_capture_production' : 'paypal_capture_sandbox',
      commercialStatusUpdatedAt: new Date().toISOString(),
      paymentEnvironment,
    })) ?? corrente;
  }
  const realPurchase = isRealPurchase(corrente);

  // Checkpoint 1: salva codice Pro
  if (!corrente.codeSaved) {
    await salvaCodicePro({
      codice,
      email,
      piano: piano as any,
      dataEmissione,
      dataScadenza,
      paypalOrderId: orderId,
      commercialStatus: corrente.commercialStatus,
      commercialStatusReason: corrente.commercialStatusReason,
      commercialStatusUpdatedAt: corrente.commercialStatusUpdatedAt,
      paymentEnvironment: corrente.paymentEnvironment,
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
  if (piano === 'founder' && realPurchase && !corrente.founderCounterUpdated) {
    await incrementaFounderVenduti().catch(() => undefined);
    corrente = (await aggiornaPayPalProcessing(orderId, {
      founderCounterUpdated: true,
    })) ?? corrente;
  } else if (!corrente.founderCounterUpdated) {
    // Non-founder: nessun counter da aggiornare, ma marchiamo il checkpoint
    // per uniformità (evita di rientrare in questo ramo su retry).
    corrente = (await aggiornaPayPalProcessing(orderId, {
      founderCounterUpdated: true,
    })) ?? corrente;
  }

  // Referral (idempotente sull'orderId via SADD in storage.ts)
  if (realPurchase && cattura?.ref && cattura.ref !== codice) {
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
  if (!corrente.emailSent) {
    if (!email) {
      console.error(`[paypal-fulfill] ordine ${orderId}: email cliente assente, mail non inviata`);
    } else {
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
      } else {
        console.error(`[paypal-fulfill] ordine ${orderId}: invio mail fallito: ${mail.error}`);
      }
    }
  }

  // Checkpoint 4: GA4 purchase (server-side, solo se context valido e consenso)
  if (!corrente.analyticsSent && realPurchase) {
    // Legge il context Analytics salvato in create-order. Se assente o senza
    // consenso, ga4TrackServer è no-op silenziosa.
    const ga4Ctx =
      corrente.ga4Context ?? (await leggiPayPalGa4Context(orderId).catch(() => null));
    const transactionId = corrente.captureId ?? cattura?.captureId ?? orderId;
    const valorePiano = Number(PIANI[piano as keyof typeof PIANI]?.prezzo) || 0;
    const items: Parameters<typeof ga4TrackServer>[3] = [
      {
        item_id: piano,
        item_name: PIANI[piano as keyof typeof PIANI]?.nome || piano,
        item_category: piano === 'singolo' ? 'consulenza' : 'abbonamento',
        price: valorePiano,
        quantity: 1,
        currency: 'EUR',
      },
    ];
    // `purchase`: nome canonico GA4 ecommerce (deduplicabile via transaction_id
    // sulla proprietà Ads).
    void ga4TrackServer(
      'purchase',
      ga4Ctx,
      { transaction_id: transactionId, value: valorePiano, currency: 'EUR', piano },
      items,
    );
    // `purchase_completed`: alias richiesto per il funnel di brand — stesso
    // transaction_id, per evitare doppio conteggio in eventuali join.
    void ga4TrackServer(
      'purchase_completed',
      ga4Ctx,
      { transaction_id: transactionId, value: valorePiano, currency: 'EUR', piano },
      items,
    );
    corrente = (await aggiornaPayPalProcessing(orderId, { analyticsSent: true })) ?? corrente;
  } else if (!corrente.analyticsSent) {
    corrente = (await aggiornaPayPalProcessing(orderId, { analyticsSent: true })) ?? corrente;
  }

  // Marca record come completed
  corrente = (await aggiornaPayPalProcessing(orderId, { status: 'completed' })) ?? corrente;

  return { record: corrente, codice, mailInviata };
}

export async function evadiOrdinePayPal(orderIdRaw: string): Promise<EvasioneEsito> {
  const orderId = orderIdRaw.trim();
  if (!orderId) return { status: 400, body: { error: 'orderId richiesto' } };

  // ==== Recovery/idempotenza basata su PayPalProcessingRecord ====
  // Se un record esiste già, gestiamo tutti i casi (completed/processing/failed)
  // SENZA rifare capture, generare nuovi codici, o duplicare side effect.
  let esistente = await leggiPayPalProcessing(orderId).catch(() => null);
  if (esistente) {
    if (esistente.status === 'completed' && esistente.code) {
      // Fast path: transazione già andata a buon fine, ritorna il codice esistente.
      return { status: 200, body: respostaSuccesso(esistente, esistente.emailSent) };
    }
    let retry: string | undefined;
    if (esistente.status === 'failed') {
      // Una capture fallita senza captureId non ha incassato nulla (es. carta
      // rifiutata, errore transitorio PayPal): il cliente può riprovare dallo
      // stesso ordine. Con captureId il pagamento è stato tentato: si ferma.
      if (esistente.captureId) {
        return { status: 402, body: { error: esistente.errorReason ?? 'Ordine fallito in precedenza' } };
      }
      retry = String(Date.now());
      esistente = (await aggiornaPayPalProcessing(orderId, {
        status: 'processing',
        errorReason: undefined,
      })) ?? esistente;
    }
    // status === 'processing': crash recovery. Ritentiamo il capture PayPal
    // (idempotente lato PayPal grazie a PayPal-Request-Id stabile) e completiamo
    // gli effetti mancanti secondo i checkpoint.
    let cattura: CaptureResult;
    try {
      cattura = await catturaOrdinePayPal(orderId, { retry });
    } catch (e: any) {
      // Se il capture non riesce, restituiamo 202 "processing" — il client
      // dovrebbe riprovare senza generare stato inconsistente.
      if (retry) {
        await aggiornaPayPalProcessing(orderId, {
          status: 'failed',
          errorReason: String(e?.message || 'capture_failed').slice(0, 200),
        });
      }
      return {
        status: 202,
        body: {
          status: 'processing',
          error: `Recupero in corso: ${String(e?.message || 'capture retry failed').slice(0, 100)}`,
        },
      };
    }
    if (cattura.status !== 'COMPLETED' && cattura.status !== 'APPROVED') {
      await aggiornaPayPalProcessing(orderId, { status: 'failed', errorReason: 'status_' + cattura.status });
      return { status: 402, body: { error: `Pagamento non completato (status: ${cattura.status})` } };
    }
    if (cattura.captureId && !esistente.captureId) {
      await aggiornaPayPalProcessing(orderId, { captureId: cattura.captureId });
    }
    const completato = await completaEffetti(orderId, esistente, cattura);
    return { status: 200, body: respostaSuccesso(completato.record, completato.mailInviata) };
  }

  // Legacy path: se esiste solo il vecchio indice paypal_order:<id> ma non il
  // nuovo processing record, restituisci il codice esistente in modo
  // retrocompatibile (record pre-migrazione).
  const legacy = await cercaPerPayPalOrderId(orderId).catch(() => null);
  if (legacy) {
    return {
      status: 200,
      body: {
        codice: legacy.codice,
        piano: legacy.piano,
        email: legacy.email,
        dataScadenza: legacy.dataScadenza,
        mailInviata: true,
        idempotent: true,
      },
    };
  }

  // ==== Nuovo ordine: crea record processing atomicamente ====
  const ga4Ctx =
    (await leggiPayPalGa4Context(orderId).catch(() => null)) ?? null;
  const { record: rec, created } = await iniziaPayPalProcessing(orderId, ga4Ctx);
  if (!created) {
    // Race condition: un'altra invocazione ha creato il record tra la nostra
    // lettura e la scrittura. Rientriamo nel path recovery.
    if (rec.status === 'completed' && rec.code) {
      return { status: 200, body: respostaSuccesso(rec, rec.emailSent) };
    }
    // Per non duplicare capture su race, ritorna 202 al client per retry.
    return { status: 202, body: { status: 'processing', message: 'Recupero in corso' } };
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
    return { status: 502, body: { error: e?.message ?? 'Errore cattura PayPal' } };
  }

  if (cattura.status !== 'COMPLETED' && cattura.status !== 'APPROVED') {
    await aggiornaPayPalProcessing(orderId, {
      status: 'failed',
      errorReason: 'status_' + cattura.status,
      captureId: cattura.captureId,
    });
    void ga4TrackServer('paypal_cancel', ga4Ctx, { reason: 'status_' + cattura.status });
    return { status: 402, body: { error: `Pagamento non completato (status: ${cattura.status})` } };
  }

  // Registra il captureId sul record prima di eseguire i side effect
  if (cattura.captureId) {
    await aggiornaPayPalProcessing(orderId, { captureId: cattura.captureId });
  }

  const completato = await completaEffetti(orderId, rec, cattura);
  return {
    status: 200,
    body: {
      codice: completato.codice,
      piano: cattura.piano,
      email: cattura.email,
      dataScadenza: calcolaScadenza(cattura.piano, new Date(rec.createdAt)),
      mailInviata: completato.mailInviata,
      referralApplicato: cattura.ref ? true : false,
    },
  };
}
