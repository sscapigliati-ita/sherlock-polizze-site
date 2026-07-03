import { Resend } from 'resend';

function getEnv(name: string): string | undefined {
  return (import.meta.env[name] ?? process.env[name]) as string | undefined;
}

export async function inviaMailCodice(opts: {
  email: string;
  codice: string;
  piano: string;
  dataScadenza: string;
  tipo?: 'pro' | 'singolo';
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey) {
    console.warn('[mail] RESEND_API_KEY mancante: mail non inviata. Codice:', opts.codice);
    return { ok: false, error: 'Provider mail non configurato' };
  }

  const from = getEnv('MAIL_FROM') ?? 'Sherlock <onboarding@resend.dev>';
  const replyTo = getEnv('MAIL_REPLY_TO') ?? 'scaplab@sherlockpolizze.it';

  const dataLeggibile = new Date(opts.dataScadenza).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isSingolo = opts.tipo === 'singolo';
  const subject = isSingolo ? 'Il tuo codice lettera Sherlock' : 'Il tuo codice Sherlock Pro';
  const titolo = isSingolo ? 'Hai 1 lettera Sherlock' : 'Benvenuto in Sherlock Pro';
  const intro = isSingolo
    ? `Grazie per l'acquisto. Questo codice è valido per <strong>1 generazione di lettera</strong> (PEC, esposto IVASS o diffida — sceglierai tu dall'app).`
    : `Grazie per esserti abbonato al piano <strong>${opts.piano}</strong>.`;
  const validitàLine = isSingolo
    ? `Da consumare entro il <strong>${dataLeggibile}</strong>. Una volta generata la lettera il codice si esaurisce.`
    : `Validità: fino al <strong>${dataLeggibile}</strong>.`;

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from,
      to: opts.email,
      replyTo,
      subject,
      html: `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
          <h1 style="color: #c8a44a;">${titolo}</h1>
          <p>${intro}</p>
          <p>Il tuo codice di attivazione:</p>
          <div style="background: #0f172a; color: #c8a44a; font-family: monospace; font-size: 1.5rem; padding: 16px; border-radius: 8px; text-align: center; letter-spacing: 0.12em; margin: 16px 0;">
            ${opts.codice}
          </div>
          <p>Inseriscilo in Sherlock: <strong>Impostazioni → Inserisci codice</strong>.</p>
          <p style="color: #666; font-size: 0.9rem;">${validitàLine}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="font-size: 0.85rem; color: #888;">Per assistenza: <a href="mailto:${replyTo}">${replyTo}</a></p>
        </div>
      `,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Errore invio mail' };
  }
}
