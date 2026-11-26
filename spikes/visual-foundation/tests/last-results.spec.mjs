import { expect, test } from '@playwright/test';

const historyPrefix = 'statum-lab:v1:';

// The scene's active sample (its Model and Resample controls) is saved under `distribution`; the Explorer itself is a
// kernel station since #91, whose state lives in its address.
const sampleSeed = (page) => page.locator('.orbit-console .session-source');

test('the active sample and each method prefix survive reload independently', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(sampleSeed(page)).toContainText('2048');
  const saved = await page.evaluate((key) => localStorage.getItem(key), historyPrefix + 'distribution');
  expect(saved).toBeNull();

  await page.getByRole('button', { name: 'Resample' }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), historyPrefix + 'distribution')).toContain('"seed":2049');
  await page.reload();
  await expect(sampleSeed(page)).toContainText('2049');

  await page.goto('/#module/convergence');
  const slider = page.getByRole('slider', { name: 'Observations' });
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveValue('8');
  const result = await page.locator('.method-value strong').textContent();
  await page.reload();
  await expect(slider).toHaveValue('8');
  await expect(page.locator('.method-value strong')).toHaveText(result);

  await page.goto('/#observatory');
  await page.getByRole('button', { name: 'Resample' }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), historyPrefix + 'distribution')).toContain('"seed":2050');
  await page.goto('/#module/convergence');
  await expect(page.locator('.method-desk .session-source')).toContainText('seed 2049');
  await page.getByRole('button', { name: 'Use active sample' }).click();
  await expect(slider).toHaveValue('512');
  await expect(page.locator('.method-desk .session-source')).toContainText('seed 2050');
  await page.goto('/#observatory');
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), historyPrefix + 'last-visited'))
    .toBe('convergence');
});

test('invalid stored settings leave a valid baseline', async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      '{"settings":{"distribution":"constructor","scale":1,"count":512,"seed":6},"size":512}',
    );
  }, historyPrefix + 'distribution');
  await page.goto('/');
  await expect(sampleSeed(page)).toContainText('2048');
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('normal');
});
