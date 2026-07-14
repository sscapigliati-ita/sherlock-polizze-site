import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  'public/app/index.html',
  'android/app/src/main/assets/www/index.html',
];

describe.each(files)('%s', (file) => {
  const html = readFileSync(file, 'utf8');

  it('espone una navigazione interna utilizzabile dal tasto Android Indietro', () => {
    expect(html).toContain('window.SherlockNavigation');
    expect(html).toContain('canGoBack:function');
    expect(html).toContain('goBack:function');
  });

  it('rispetta accessibilità touch, focus e movimento ridotto', () => {
    expect(html).toContain('min-height:48px');
    expect(html).toContain(':focus-visible');
    expect(html).toContain('prefers-reduced-motion:reduce');
    expect(html).toMatch(/id="btn-home-gear"[^>]+aria-label="Impostazioni"/);
  });

  it('ha feedback accessibile per gli errori operativi', () => {
    expect(html).toContain('id="app-feedback"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('function showFeedback');
    expect(html).toContain('function withUiTimeout');
    expect(html).toContain('function setBusy');
  });
});

it('mantiene gli stessi controlli principali nelle due PWA', () => {
  const web = readFileSync(files[0], 'utf8');
  const android = readFileSync(files[1], 'utf8');
  const ids = ['btn-home-gear', 'btn-pdf', 'btn-photo', 'btn-gen-lt', 'btn-share-lt', 'btn-activate'];
  for (const id of ids) {
    expect(web).toContain(`id="${id}"`);
    expect(android).toContain(`id="${id}"`);
  }
});
