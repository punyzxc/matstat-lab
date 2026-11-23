import { expect, test } from '@playwright/test';

test('replays a seed and provides keyboard-accessible ASCII data', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#module/distribution');
  await expect(page.getByRole('heading', { name: 'Distribution Explorer', exact: true })).toBeVisible();
  const firstMean = await page.getByTestId('sample-mean').textContent();
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByRole('status')).toHaveText('512 observations complete');
  await expect(page.getByTestId('sample-mean')).toHaveText(firstMean);
  await page.getByRole('tab', { name: 'Histogram' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'ECDF' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'ASCII' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('ascii-data')).toContainText('@');
  await page.getByText('View bin data').click();
  await expect(page.getByRole('table', { name: 'Histogram bins' })).toBeVisible();
});

test('updates model settings, exports data and fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#module/distribution');
  await page.getByLabel('Distribution', { exact: true }).selectOption('exponential');
  await expect(page.getByText('Parameters changed')).toBeVisible();
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.plot-model')).toContainText('Exponential distribution');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toBe('statum-exponential-2048.csv');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button', { name: 'Projector' }).click();
  await expect(page.getByRole('button', { name: 'Projector' })).toHaveAttribute('aria-pressed', 'true');
});

test('pause holds a partial sample and resume completes the same run', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#module/distribution');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await page.clock.runFor(215);
  await page.getByRole('button', { name: 'Pause simulation' }).click();
  const progress = page.getByRole('progressbar', { name: 'Simulation progress' });
  const partial = await progress.getAttribute('value');
  expect(Number(partial)).toBeGreaterThan(0);
  expect(Number(partial)).toBeLessThan(512);
  await page.clock.runFor(1000);
  await expect(progress).toHaveAttribute('value', partial);
  await page.getByRole('button', { name: 'Resume simulation' }).click();
  await page.clock.runFor(1000);
  await expect(page.getByRole('status')).toHaveText('512 observations complete');
});
