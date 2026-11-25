// Discovery-only acceptance evidence for #20. Servers must belong to PREVIEW_ROOT.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

test('both previews load; a seeded sample replays and survives the observatory round trip', async () => {
  assert.ok(process.env.PREVIEW_ROOT, 'Set PREVIEW_ROOT to the independent clean clone');
  const root = resolve(process.env.PREVIEW_ROOT);
  const require = createRequire(resolve(root, 'spikes/visual-foundation/package.json'));
  const { chromium } = require('@playwright/test');
  const lab = process.env.LAB_URL || 'http://127.0.0.1:4181';
  const study = process.env.STUDY_URL || 'http://127.0.0.1:4178';
  for (const url of [lab, study]) assert.equal((await fetch(url)).status, 200, url);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const external = [];
    page.on('request', request => {
      if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) external.push(request.url());
    });
    await page.goto(lab + '/#module/distribution');
    await page.getByRole('heading', { name: 'Distribution Explorer', exact: true }).waitFor();
    await page.getByLabel('Random seed').fill('312');
    await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '512 observations complete' }).waitFor();
    const mean = await page.getByTestId('sample-mean').textContent();
    async function csv() {
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export CSV' }).click();
      return readFile(await (await downloaded).path(), 'utf8');
    }
    const first = await csv();
    await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '512 observations complete' }).waitFor();
    assert.equal(await csv(), first, 'CSV bytes replay exactly');
    assert.equal(await page.getByTestId('sample-mean').textContent(), mean);
    await page.getByRole('link', { name: 'Orbital laboratory', exact: true }).click();
    const preview = page.locator('a.orbit-preview[data-module="distribution"]');
    assert.equal(await preview.getAttribute('data-saved'), 'true');
    assert.match(await preview.getAttribute('aria-label'), /seed 312, 512 observations/);
    await page.reload();
    assert.equal(await preview.getAttribute('data-saved'), 'true');
    await preview.click();
    assert.equal(await page.getByLabel('Random seed').inputValue(), '312');
    assert.equal(await csv(), first);
    await page.goto(study + '/?paused=1&time=6');
    await page.getByRole('heading', { name: 'Orbital observatory.' }).waitFor();
    assert.equal(await page.locator('a.instrument').count(), 6);
    assert.equal(await page.locator('#atmosphere').evaluate(canvas => canvas.width > 0 && canvas.height > 0), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, [], 'runtime requests stay local');
    console.log(JSON.stringify({ browser: browser.version(), seed: 312, count: 512, mean, csvBytes: Buffer.byteLength(first), externalRequests: external, pageErrors: errors }));
    await context.close();
  } finally { await browser.close(); }
});
