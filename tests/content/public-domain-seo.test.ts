import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const roots = ['src', 'public'];
const allowedTechnicalFiles = new Set(['src/layouts/BaseLayout.astro']);
const extensions = new Set(['.astro', '.md', '.html', '.xml', '.txt', '.json', '.js', '.ts']);

function files(path: string, out: string[] = []): string[] {
  for (const name of readdirSync(path)) {
    const full = join(path, name).replace(/\\/g, '/');
    const stat = statSync(full);
    if (stat.isDirectory()) files(full, out);
    else if (extensions.has(extname(full))) out.push(full);
  }
  return out;
}

describe('dominio pubblico canonico', () => {
  it('non espone destinazioni vercel.app', () => {
    const hits = roots.flatMap((root) => files(root)).filter((file) => {
      if (allowedTechnicalFiles.has(file)) return false;
      return /https?:\/\/[^\s"']+\.vercel\.app/i.test(readFileSync(file, 'utf8'));
    });
    expect(hits).toEqual([]);
  });

  it('configura il sito canonico ufficiale', () => {
    expect(readFileSync('astro.config.mjs', 'utf8')).toContain(
      "site: 'https://www.sherlockpolizze.it'",
    );
  });
});
