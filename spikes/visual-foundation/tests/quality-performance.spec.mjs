import { expect, test } from '@playwright/test';

test('low quality keeps the median frame at or below 33 ms with an autoplaying station at 6× CPU slowdown', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  try {
    await page.goto('/?quality=low#station/bayes?seed=17');
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'low', { timeout: 20_000 });
    const dock = page.getByTestId('station-dock');
    await expect(dock.getByRole('table', { name: 'Readouts' })).toBeVisible({ timeout: 20_000 });
    await expect(dock.getByRole('button', { name: 'Stop the experiment' })).toBeVisible();
    const frameGaps = await page.evaluate(() => new Promise((resolve) => {
      const gaps = [];
      let start;
      let previous;
      function sample(now) {
        start ??= now;
        if (previous !== undefined) gaps.push(now - previous);
        previous = now;
        if (now - start < 10_000) requestAnimationFrame(sample);
        else resolve(gaps.sort((a, b) => a - b));
      }
      requestAnimationFrame(sample);
    }));
    expect(frameGaps.length, 'the browser must collect frame samples').toBeGreaterThan(0);
    const middle = Math.floor(frameGaps.length / 2);
    const median = frameGaps.length % 2 ? frameGaps[middle] : (frameGaps[middle - 1] + frameGaps[middle]) / 2;
    await test.info().attach('frame-timing.json', {
      body: JSON.stringify({ station: 'bayes', cpuThrottlingRate: 6, viewport: page.viewportSize(), frameGaps, median }),
      contentType: 'application/json',
    });
    expect(median, `median frame gap across ${frameGaps.length} samples`).toBeLessThanOrEqual(33);
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
});
