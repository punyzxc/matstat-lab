import { expect, test } from '@playwright/test';

// #39: the Bernoulli station runs on its own kernel: exact law, approximations with their errors, frequency design.
test('Bernoulli: L3 ex. 2 shows the exact 0.0566 and 0.5375 next to every approximation and its error', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/bernoulli?seed=3&n=5000&p=0.01&k=50&lo=0&hi=50');
  const dock = page.getByTestId('station-dock');
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('0.05661');
  await expect(formula).toContainText('0.5375');
  await expect(dock).toContainText('CDF from');
  await expect(dock.locator('.chart-series--pmf')).toHaveCount(1);
  await expect(dock.locator('.chart-series--points')).toHaveCount(1);
  await expect(dock).not.toContainText('No kernel');

  // L9's defects example: exact 0.952 against the lecture's normal answer 0.92135, and a typed k.
  await page.goto('/#station/bernoulli?seed=3&n=50&p=0.2&k=10&lo=6&hi=50');
  await expect(formula).toContainText('0.952');
  await expect(formula).toContainText('0.9214');
  const k = dock.getByLabel(/Number of successes k for Pₙ\(k\), typed value/);
  await k.fill('12');
  await k.press('Enter');
  await expect(page).toHaveURL(/[?&]k=12(&|$)/, { timeout: 5000 });
  await expect(formula).toContainText('P50(12)');
});

test('Bernoulli: the frequency view gives 13 530 trials with the exact quantile, beside Chebyshev', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/bernoulli?seed=4&view=1&p=0.5&eps=0.01&gamma=0.98');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('13530');
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('125000');
  await expect(dock.getByLabel(/Number of successes k/)).toHaveCount(0); // only the frequency inputs in this view
});

test('Bernoulli opens with the lecture numbers from lectures 3 and 9', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#lecture/3/3');
  await page.getByRole('link', { name: /Open experiment Bernoulli/ }).first().click();
  await expect(page).toHaveURL(/#station\/bernoulli\?seed=5000&/);
  await expect(page.getByTestId('station-dock').getByRole('group', { name: 'Live formula' })).toContainText('0.5375');
});
