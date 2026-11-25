import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Edge fallback for this task: crew shots uses uninstalled bundled Chromium.
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Expected before or after');
const directory = new URL('evidence/catalog-lectures/', import.meta.url);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  for (const id of ['fit', 'estimation', 'confidence']) {
    await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4197}/?lang=en#station/${id}`);
    await expect(page.getByTestId('station-dock')).toBeVisible();
    await expect(page.getByTestId('station-dock')).not.toContainText(/Loading the .* kernel|Running the first experiment/);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL(`${id}-${phase}.png`, directory)) });
    console.log(`${phase}: ${id}: ${await page.locator('.dock-lecture').textContent()}`);
  }
} finally { await browser.close(); }
