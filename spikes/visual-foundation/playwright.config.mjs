import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 4175);
const mobileSpec = '**/mobile-layout.spec.mjs';
const touchViewports = [
  ['phone-360', 360, 800],
  ['phone-390', 390, 844],
  ['tablet-portrait', 768, 1024],
  ['tablet-landscape', 1024, 768],
];

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.mjs',
  projects: [
    { name: 'desktop', testIgnore: mobileSpec },
    ...touchViewports.map(([name, width, height]) => ({
      name,
      testMatch: mobileSpec,
      use: { viewport: { width, height }, isMobile: true, hasTouch: true },
    })),
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices['Desktop Chrome'],
    channel: process.env.PW_CHROMIUM ? undefined : 'chrome',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
    // The lab opens in Russian; the specs read the English UI (tests/i18n.spec.mjs covers Russian and the switch).
    storageState: { cookies: [], origins: [{ origin: `http://127.0.0.1:${port}`, localStorage: [{ name: 'statum-lab:lang', value: 'en' }] }] },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
