import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const privacy = readFileSync('src/pages/privacy.astro', 'utf8');
const transparency = readFileSync('src/pages/trasparenza.astro', 'utf8');
const combined = `${privacy}\n${transparency}`;

describe('privacy coerente col comportamento', () => {
  it('non chiama anonimi eventi con identificatori persistenti', () => {
    expect(combined).not.toMatch(/eventi\s+anonimi/i);
    expect(combined).toContain('pseudonimizz');
  });

  it('non garantisce distruzione presso tutti i fornitori', () => {
    expect(combined).not.toMatch(/non viene inviato a nessun altro fornitore/i);
    expect(combined).not.toMatch(/distrutt[oi]\s+a\s+fine\s+richiesta\s*\(entro\s+30\s+secondi\)/i);
  });

  it('dichiara che cancellazione ed esportazione server richiedono supporto', () => {
    expect(combined).toContain('scaplab@sherlockpolizze.it');
    expect(combined).toMatch(/richiesta\s+di\s+cancellazione/i);
  });
});
