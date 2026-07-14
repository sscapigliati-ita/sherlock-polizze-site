import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://www.sherlockpolizze.it',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-small', use: { viewport: { width: 320, height: 568 } } },
    { name: 'android', use: { viewport: { width: 412, height: 915 } } },
    { name: 'tablet-landscape', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
