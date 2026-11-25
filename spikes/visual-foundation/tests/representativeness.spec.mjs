import { expect, test } from '@playwright/test';

// #126: a random sampler and a biased one (only from [x₁, x₂]) side by side; the biased mean settles at the
// conditional mean, and its error does not fall with n while the random one does.
test('Representativeness: typed bounds move the biased sample, the error curve parts the two samplers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/sample?seed=3&view=2&law=1&n=500&lo=0&hi=2&reps=100');
  const dock = page.getByTestId('station-dock');
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  // Uniform U(1 − √3, 1 + √3) cut to [0, 2]: conditional mean 1 (no bias), variance 1/3.
  await expect(readouts.getByRole('row', { name: /^Biased sample: variance/ })).toContainText('0.3333');
  const charts = dock.locator('.chart-stage .chart');
  await expect(charts).toHaveCount(2);
  await expect(charts.nth(0).locator('.chart-series--band.tone-muted')).toHaveCount(1);
  await expect(charts.nth(0).locator('.chart-series--hist')).toHaveCount(1);
  await expect(charts.nth(0).locator('.chart-series--line.tone-accent')).toHaveCount(1);
  await expect(charts.nth(1).locator('.chart-series--points circle')).toHaveCount(14);

  const lo = dock.getByLabel(/left end .*typed value/);
  await lo.fill('1.5');
  await lo.press('Enter');
  const hi = dock.getByLabel(/right end .*typed value/);
  await hi.fill('2.7');
  await hi.press('Enter');
  await expect(page).toHaveURL(/lo=1\.5/, { timeout: 5000 });
  // Uniform on [1.5, 2.7] given the window: conditional mean 2.1, bias 1.1; the biased x̄ sits near it, far from a = 1.
  await expect(readouts.getByRole('row', { name: /^Biased sample: mean/ })).toContainText('2.7)=2.1 instead');
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('M(ξ∣1.5≤ξ≤2.7)=2.1');
  await expect(readouts.getByRole('row', { name: /^Biased: mean error/ })).toContainText('1.1');
});
