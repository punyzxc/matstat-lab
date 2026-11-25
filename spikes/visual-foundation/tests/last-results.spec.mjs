import { expect, test } from '@playwright/test';

const historyPrefix = 'statum-lab:v1:';

test('the completed simulation and each method prefix survive reload independently', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#module/distribution');
  await expect(page.getByLabel('Random seed')).toHaveValue('2048');
  const saved = await page.evaluate((key) => localStorage.getItem(key), historyPrefix + 'distribution');
  expect(saved).toBeNull();

  await page.getByLabel('Random seed').fill('312');
  await expect(page.getByRole('status')).toHaveText('512 observations complete');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), historyPrefix + 'distribution')).toContain('"seed":312');
  await page.reload();
  await expect(page.getByLabel('Random seed')).toHaveValue('312');

  await page.goto('/#module/convergence');
  const slider = page.getByRole('slider', { name: 'Observations' });
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveValue('8');
  const result = await page.locator('.method-value strong').textContent();
  await page.reload();
  await expect(slider).toHaveValue('8');
  await expect(page.locator('.method-value strong')).toHaveText(result);

  await page.goto('/#module/distribution');
  await page.getByLabel('Random seed').fill('703');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), historyPrefix + 'distribution')).toContain('"seed":703');
  await page.goto('/#module/convergence');
  await expect(page.locator('.method-desk .session-source')).toContainText('seed 312');
  await page.getByRole('button', { name: 'Use active sample' }).click();
  await expect(slider).toHaveValue('512');
  await expect(page.locator('.method-desk .session-source')).toContainText('seed 703');
  await page.goto('/#observatory');
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), historyPrefix + 'last-visited'))
    .toBe('convergence');
});

test('invalid stored settings and interrupted runs leave a valid baseline', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      '{"settings":{"distribution":"constructor","scale":1,"count":512,"seed":6},"size":512}',
    );
  }, historyPrefix + 'distribution');
  await page.goto('/#module/distribution');
  await expect(page.getByLabel('Random seed')).toHaveValue('2048');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('Random seed').fill('184');
  await page.clock.runFor(260);
  await page.getByRole('button', { name: 'Stop the experiment' }).click();
  await expect(page.getByRole('status')).toHaveText('Simulation paused');
  await page.reload();
  await expect(page.getByLabel('Random seed')).toHaveValue('2048');
});
