import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const buildPath = 'android/app/build.gradle';
const mainPath = 'android/app/src/main/java/it/sherlock/polizze/MainActivity.java';
const appHtmlPath = 'android/app/src/main/assets/www/index.html';

describe('Android release security', () => {
  it('usa versione 69 e dominio canonico senza password incorporate', () => {
    expect(existsSync(buildPath)).toBe(true);
    expect(existsSync(mainPath)).toBe(true);

    const build = readFileSync(buildPath, 'utf8');
    const main = readFileSync(mainPath, 'utf8');
    const appHtml = readFileSync(appHtmlPath, 'utf8');

    expect(build).toContain('versionCode 69');
    expect(build).toContain("versionName '4.6.11'");
    expect(build).not.toMatch(/storePassword\s+.*['"][^'"]+['"]/);
    expect(build).not.toMatch(/keyPassword\s+.*['"][^'"]+['"]/);
    expect(main).toContain('https://www.sherlockpolizze.it');
    expect(main).not.toContain('sherlock-polizze-site-five.vercel.app');
    expect(appHtml).not.toContain('sherlock-polizze-site-five.vercel.app');
    expect(appHtml).toContain('https://www.sherlockpolizze.it');
  });
});
