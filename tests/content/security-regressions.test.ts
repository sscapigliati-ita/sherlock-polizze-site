import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Regressioni sicurezza contenuti e log', () => {
  it('non scrive il codice di attivazione nei log email', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/mail.ts'), 'utf8');
    expect(source).not.toMatch(/console\.(?:warn|log|error)[^;]*opts\.codice/s);
  });
});
