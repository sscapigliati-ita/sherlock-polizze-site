import { expect, test } from '@playwright/test';

async function openHome(page: import('@playwright/test').Page) {
  await page.goto('/app/');
  await page.evaluate(() => {
    localStorage.setItem('shk2', JSON.stringify({ onboardingDone: true, freeUsed: 0, analyses: [] }));
    (window as any).goHome();
  });
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('i controlli principali sono nominati e il caricamento accetta documenti supportati', async ({ page }) => {
  await openHome(page);
  await page.locator('#tab-scan').click();
  await expect(page.locator('#screen-scanner')).toHaveClass(/active/);

  for (const button of await page.getByRole('button').all()) {
    if (await button.isVisible()) await expect(button).toHaveAccessibleName(/\S/);
  }

  await expect(page.locator('#file-input')).toHaveAttribute('accept', /application\/pdf/);
  await expect(page.locator('#btn-pdf')).toBeEnabled();
  await expect(page.locator('#btn-photo')).toBeEnabled();
});

test('la navigazione interna consente di tornare indietro', async ({ page }) => {
  await openHome(page);
  await page.locator('#btn-home-gear').click();
  await expect(page.locator('#screen-settings')).toHaveClass(/active/);
  await expect(page.evaluate(() => (window as any).SherlockNavigation.canGoBack())).resolves.toBe(true);
  await page.evaluate(() => (window as any).SherlockNavigation.goBack());
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
});

test('un errore recuperabile offre un retry accessibile', async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => (window as any).showFeedback({
    title: 'Connessione non disponibile',
    message: 'Controlla la rete e riprova.',
    retry: () => (document.body.dataset.retry = 'done'),
  }));
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Connessione non disponibile');
  await alert.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-retry', 'done');
});

test('le viste chiave restano utilizzabili e producono evidenze visive', async ({ page }, testInfo) => {
  test.skip(!['mobile-small', 'android'].includes(testInfo.project.name));
  await openHome(page);
  await page.screenshot({ path: `test-results/google-play/${testInfo.project.name}-home.png`, fullPage: true });
  await page.locator('#tab-scan').click();
  await page.screenshot({ path: `test-results/google-play/${testInfo.project.name}-upload.png`, fullPage: true });
  await page.evaluate(() => (window as any).goPaywall('e2e'));
  await expect(page.locator('#screen-paywall')).toHaveClass(/active/);
  await page.screenshot({ path: `test-results/google-play/${testInfo.project.name}-paywall.png`, fullPage: true });
});
