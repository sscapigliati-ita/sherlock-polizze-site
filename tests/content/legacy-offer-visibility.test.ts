import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('offerta legacy non pubblica', () => {
  it('header e footer non collegano prezzi legacy', () => {
    const chrome = `${read('src/components/Header.astro')}\n${read('src/components/Footer.astro')}`;
    expect(chrome).not.toContain('href="/abbonati"');
    expect(chrome).not.toContain('Pass Pro');
  });

  it.each([
    'src/pages/abbonati.astro',
    'src/pages/abbonamento/[piano].astro',
    'src/pages/reclamo-singolo.astro',
  ])('%s usa noindex', (file) => {
    expect(read(file)).toMatch(/noindex=\{?true\}?/);
  });

  it('sitemap esclude le route legacy', () => {
    const config = read('astro.config.mjs');
    expect(config).toContain("!page.includes('/abbonati')");
    expect(config).toContain("!page.includes('/abbonamento')");
    expect(config).toContain("!page.includes('/reclamo-singolo')");
  });
});
