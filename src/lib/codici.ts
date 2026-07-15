const ALFA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generaCodicePro(): string {
  while (true) {
    const prefix = Array.from(
      { length: 7 },
      () => ALFA[Math.floor(Math.random() * ALFA.length)],
    ).join('');
    const somma = [...prefix].reduce((s, c) => s + c.charCodeAt(0), 0);
    const ottavo = [...ALFA].find((c) => (somma + c.charCodeAt(0)) % 7 === 0);
    if (!ottavo) continue;
    const payload = prefix + ottavo;
    return `SHK-${payload.slice(0, 4)}-${payload.slice(4)}`;
  }
}

export function checksumValido(codice: string): boolean {
  const pulito = codice.trim().toUpperCase();
  // Retrocompatibilità: codici Play Billing emessi prima del passaggio a SHK-*
  // (formato PLAY-<8 hex>) restano validi — la validazione reale è la presenza
  // del record in KV, non il checksum.
  if (/^PLAY-[A-F0-9]{8}$/.test(pulito)) return true;
  if (!/^SHK-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(pulito)) return false;
  const payload = pulito.replace('SHK-', '').replace('-', '');
  let somma = 0;
  for (let i = 0; i < payload.length; i++) somma += payload.charCodeAt(i);
  return somma % 7 === 0;
}
