import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const roots = ['src/pages', 'src/content', 'src/components', 'src/layouts', 'public'];
const extensions = new Set(['.astro', '.md', '.mdx', '.html']);

function walk(path: string, out: string[] = []): string[] {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (extensions.has(extname(full))) out.push(full);
  }
  return out;
}

const publicText = roots
  .flatMap((root) => walk(root))
  .map((file) => ({ file, text: readFileSync(file, 'utf8') }));

function matches(pattern: RegExp) {
  return publicText.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
}

describe('fiducia pubblica verificabile', () => {
  it.each([
    [/oltre\s+30[.,]?000\s*€/i, 'somma recuperata'],
    [/recensioni\s+verificate/i, 'recensioni verificate'],
    [/\b5[,.]0\b[^\n]{0,60}recension/i, 'valutazione recensioni'],
    [/\besempio\s+reale\b/i, 'esempio reale non documentato'],
    [/\b(più\s+scelto|bestseller|ultimi\s+posti)\b/i, 'scarsità o popolarità'],
  ])('rimuove %s', (pattern) => {
    expect(matches(pattern as RegExp)).toEqual([]);
  });
});
