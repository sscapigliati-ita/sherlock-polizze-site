import { Resend } from 'resend';

function getEnv(name: string): string | undefined {
  return (import.meta.env[name] ?? process.env[name]) as string | undefined;
}

export async function inviaMailCodice(opts: {
  email: string;
  codice: string;
  piano: string;
  dataScadenza: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey) {
    console.warn('[mail] RESEND_API_KEY mancante: mail non inviata. Codice:', opts.codice);
    return { ok: false, error: 'Provider mail non configurato' };
  }

  const from = getEnv('MAIL_FROM') ?? 'Sherlock <onboarding@resend.dev>';
  const replyTo = getEnv('MAIL_REPLY_TO') ?? 'stefano.scapigliati@gmail.com';

  const dataLeggibile = new Date(opts.dataScadenza).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from,
      to: opts.email,
      replyTo,
      subject: 'Il tuo codice Sherlock Pro',
      html: `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
          <h1 style="color: #c8a44a;">Benvenuto in Sherlock Pro</h1>
          <p>Grazie per esserti abbonato al piano <strong>${opts.piano}</strong>.</p>
          <p>Il tuo codice di attivazione:</p>
          <div style="background: #0f172a; color: #c8a44a; font-family: monospace; font-size: 1.5rem; padding: 16px; border-radius: 8px; text-align: center; letter-spacing: 0.12em; margin: 16px 0;">
            ${opts.codice}
          </div>
          <p>Inseriscilo nell'app Sherlock: Impostazioni → Inserisci codice Pro.</p>
          <p style="color: #666; font-size: 0.9rem;">Validità: fino al <strong>${dataLeggibile}</strong>.</p>
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
