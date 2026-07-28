import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const buildPath = 'android/app/build.gradle';
const mainPath = 'android/app/src/main/java/it/sherlock/polizze/MainActivity.java';
const appHtmlPath = 'android/app/src/main/assets/www/index.html';

// Floor storico: la 70 è la prima release post-audit sicurezza (dominio canonico
// + niente password incorporate). Ogni bump successivo deve restare >= 70 e
// mantenere lo schema semver 4.6.x — così il test non va aggiornato a ogni
// nuova build ma blocca comunque un downgrade.
const MIN_VERSION_CODE = 70;
const MIN_VERSION_NAME = { major: 4, minor: 6, patch: 12 };

describe('Android release security', () => {
  it('mantiene versione monotonicamente crescente e dominio canonico senza password incorporate', () => {
    expect(existsSync(buildPath)).toBe(true);
    expect(existsSync(mainPath)).toBe(true);

    const build = readFileSync(buildPath, 'utf8');
    const main = readFileSync(mainPath, 'utf8');
    const appHtml = readFileSync(appHtmlPath, 'utf8');

    const codeMatch = build.match(/versionCode\s+(\d+)/);
    expect(codeMatch, 'versionCode non trovato in build.gradle').not.toBeNull();
    const code = Number(codeMatch![1]);
    expect(code).toBeGreaterThanOrEqual(MIN_VERSION_CODE);

    const nameMatch = build.match(/versionName\s+'(\d+)\.(\d+)\.(\d+)'/);
    expect(nameMatch, 'versionName non trovato o non semver in build.gradle').not.toBeNull();
    const [, maj, min, pat] = nameMatch!;
    const parsed = { major: Number(maj), minor: Number(min), patch: Number(pat) };
    // Ordine lessicografico su (major, minor, patch)
    const geq =
      parsed.major > MIN_VERSION_NAME.major ||
      (parsed.major === MIN_VERSION_NAME.major && parsed.minor > MIN_VERSION_NAME.minor) ||
      (parsed.major === MIN_VERSION_NAME.major &&
        parsed.minor === MIN_VERSION_NAME.minor &&
        parsed.patch >= MIN_VERSION_NAME.patch);
    expect(geq, `versionName ${maj}.${min}.${pat} inferiore al floor 4.6.12`).toBe(true);

    expect(build).not.toMatch(/storePassword\s+.*['"][^'"]+['"]/);
    expect(build).not.toMatch(/keyPassword\s+.*['"][^'"]+['"]/);
    expect(main).toContain('https://www.sherlockpolizze.it');
    expect(main).not.toContain('sherlock-polizze-site-five.vercel.app');
    expect(appHtml).not.toContain('sherlock-polizze-site-five.vercel.app');
    expect(appHtml).toContain('https://www.sherlockpolizze.it');
  });
});
