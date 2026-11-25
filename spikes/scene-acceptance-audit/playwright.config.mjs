import { defineConfig } from '../visual-foundation/node_modules/@playwright/test/index.mjs';

const port = Number(process.env.PORT ?? 4196);
export default defineConfig({
  testDir: '.', testMatch: 'audit.spec.mjs', timeout: 180000,
  workers: 2, retries: 0, outputDir: './results',
  reporter: [['list'], ['json', { outputFile: './results/report.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`, channel: process.env.AUDIT_BROWSER ?? 'msedge',
    reducedMotion: 'reduce', viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
    storageState: { cookies: [], origins: [{ origin: `http://127.0.0.1:${port}`, localStorage: [{ name: 'statum-lab:lang', value: 'en' }] }] },
  },
});
