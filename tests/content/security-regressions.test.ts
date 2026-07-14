import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Regressioni sicurezza contenuti e log', () => {
  it('non scrive il codice di attivazione nei log email', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/mail.ts'), 'utf8');
    expect(source).not.toMatch(/console\.(?:warn|log|error)[^;]*opts\.codice/s);
  });

  it('le API AI marcano documenti e testo utente come dati non attendibili', () => {
    for (const file of ['analizza.ts', 'compara.ts']) {
      const source = readFileSync(join(process.cwd(), 'src/pages/api', file), 'utf8');
      expect(source).toContain('AI_UNTRUSTED_DATA_RULES');
    }
  });

  it('analizza non interpola direttamente il sinistro nel comando', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/api/analizza.ts'), 'utf8');
    expect(source).not.toContain('L\'utente ha descritto questo sinistro: "${sinistroTesto}"');
    expect(source).toContain('<untrusted_incident_json>');
  });
});
