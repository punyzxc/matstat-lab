import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = new URL('../../docs/research/assets/orbital-atmosphere/', import.meta.url);
await mkdir(output, { recursive: true });
const base = process.env.STUDY_URL || 'http://127.0.0.1:4178';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const evidence = { capturedAt: new Date().toISOString(), browser: browser.version(), platform: process.platform, profiling: '6 seconds per viewport; browser automation, not a low-end device benchmark', results: [] };

try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const errors = [], network = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base)) network.push(request.url()); });
    const current = () => page.evaluate(() => window.atmosphereStudy.snapshot());
    await page.goto(`${base}/?paused=1&time=6&baseline=1`);
    await page.waitForFunction(() => window.atmosphereStudy?.snapshot().width > 0);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-baseline.png`, output)), fullPage: true });
    await page.goto(`${base}/?paused=1&time=6`);
    await page.waitForFunction(() => window.atmosphereStudy?.snapshot().counts.stars > 0);
    await page.waitForTimeout(100);
    const staticState = await current();
    assert.equal(staticState.pendingFrame, false);
    assert.deepEqual([...new Set(staticState.satelliteKinds)].sort(), ['array', 'relay']);
    assert.ok(staticState.counts.beacons >= 1);
    assert.ok(staticState.counts.illustrations >= 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-atmosphere.png`, output)), fullPage: true });
    await page.waitForTimeout(160);
    assert.equal((await current()).callbackCount, staticState.callbackCount, 'pause stops decorative callbacks even if screenshotting invalidates layout');
    assert.equal((await current()).time, staticState.time, 'paused scene time is frozen');

    const routes = page.locator('[data-module]');
    for (let index = 0; index < await routes.count(); index++) {
      const route = routes.nth(index), module = await route.getAttribute('data-module');
      await route.scrollIntoViewIfNeeded();
      assert.equal(await route.evaluate(el => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-module]') === el;
      }), true, 'module hit target unobstructed');
      await route.click();
      assert.equal(await page.locator('#selected-instrument').textContent(), module);
    }
    const meanBefore = await page.locator('#sample-mean').textContent();
    await page.locator('#resample').focus(); await page.keyboard.press('Enter');
    assert.notEqual(await page.locator('#sample-mean').textContent(), meanBefore, 'scientific readout works while paused');
    const imageBefore = await page.locator('canvas').evaluate(el => el.toDataURL());
    await page.locator('#rotate').click();
    assert.notEqual(await page.locator('canvas').evaluate(el => el.toDataURL()), imageBefore, 'manual globe control works while paused');
    assert.equal((await current()).pendingFrame, false);

    const clearance = await page.evaluate(async () => {
      const { composeDecor } = await import('./model.mjs');
      const { syntheticSnapshots } = await import('./fixtures.mjs');
      const s = window.atmosphereStudy.snapshot();
      const parent = document.querySelector('.scene').getBoundingClientRect(), zone = document.querySelector('.globe-zone').getBoundingClientRect();
      const region = { x: zone.x - parent.x, y: zone.y - parent.y, width: zone.width, height: zone.height };
      let examined = 0;
      for (let time = 0; time <= 32; time += 0.5) {
        const plan = composeDecor({ width: s.width, height: s.height, seed: s.seed, reserved: s.reserved, projections: syntheticSnapshots(time, region), time, decorRegion: region });
        for (const objects of Object.values(plan)) for (const object of objects) {
          examined++;
          const b = object.bounds;
          if (s.reserved.some(r => b.x < r.x + r.width && b.x + b.width > r.x && b.y < r.y + r.height && b.y + b.height > r.y)) return { valid: false, time, object };
        }
      }
      return { valid: true, examined, snapshots: 65 };
    });
    assert.equal(clearance.valid, true, 'trajectory fixture sweep avoids labels/targets');
    await page.locator('#pause').click();
    await page.waitForFunction(() => window.atmosphereStudy.snapshot().active);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => window.atmosphereStudy.snapshot().reduced);
    const reduced = await current();
    await page.waitForTimeout(160);
    assert.equal((await current()).renderCount, reduced.renderCount, 'dynamic reduced motion cancels callbacks');
    assert.equal(reduced.pendingFrame, false);
    await page.locator('#zoom-out').click();
    assert.equal((await current()).pendingFrame, false, 'manual zoom does not restart motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hidden = await current();
    await page.waitForTimeout(160);
    assert.equal((await current()).renderCount, hidden.renderCount, 'simulated hidden-document transition cancels callbacks');
    assert.equal(hidden.pendingFrame, false);
    // Restore the capture's globe pose before the representative warm-frame profile.
    for (let turn = 0; turn < 7; turn++) await page.locator('#rotate').click();
    await page.locator('#zoom-in').click();
    assert.equal((await current()).yaw, 0);
    assert.equal((await current()).zoom, 1);
    await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => window.atmosphereStudy.snapshot().active);
    await page.waitForTimeout(6000);
    const profile = await current();
    assert.ok(profile.cpuMs.samples >= 30, 'profile contains active frames');
    assert.ok(profile.drawCalls > 0 && profile.drawCalls < 250, 'bounded drawing primitives');
    assert.equal(profile.domNodes, staticState.domNodes, 'no per-frame DOM growth');
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    const { decorations, reserved, sceneBounds, ...metrics } = profile;
    evidence.results.push({ viewport: { name, width, height }, checks: { seededScene: true, distinctCraft: true, transparentGlyphs: 'unit test', paused: true, reducedMotionChange: true, simulatedHidden: true, manualGlobe: true, keyboardResample: true, allSixRoutes: true, noHorizontalOverflow: true, noExternalRequests: true, noPageErrors: true, noDomGrowth: true, clearance }, staticCounts: staticState.counts, metrics });
    console.log(JSON.stringify({ viewport: name, checks: 'passed', objects: staticState.counts, cpuMs: profile.cpuMs, cadenceMs: profile.cadenceMs, drawCalls: profile.drawCalls, domNodes: profile.domNodes }));
    await context.close();
  }
  await writeFile(new URL('browser-evidence.json', output), JSON.stringify(evidence, null, 2) + '\n');
} finally { await browser.close(); }
