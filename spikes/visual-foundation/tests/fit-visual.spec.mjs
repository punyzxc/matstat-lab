import { expect, test } from '@playwright/test';

// #127: Kolmogorov's largest gap as a bar between Fₙ* and F; Pearson's χ² as one bar per cell.
test('Fit: the D_n bar, then Pearson cell by cell; typed n and a wrong H0 update the statistics', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/fit?seed=7&view=0&law=0&h0=0&n=200&reps=0');
  const dock = page.getByTestId('station-dock');
  const formula = dock.getByRole('group', { name: 'Live formula' });
  const kernel = async (q) => page.evaluate(async (q) => {
    const K = await import('/@fs' + q.root + '/spikes/lecture-sampling-goodness-of-fit/kernel.mjs');
    return K.run(q.params, { seed: 7, station: 'fit' });
  }, q);
  const root = process.cwd().replace(/\/spikes\/visual-foundation$/, '');
  const exact0 = await kernel({ root, params: { view: 0, law: 0, h0: 0, n: 200, reps: 0 } });
  const dn = exact0.readouts.find((r) => r.key === 'dn').observed;
  await expect(formula).toContainText(String(Number(dn.toFixed(4))));
  await expect(dock.locator('.chart-key').filter({ hasText: /D\s*n\s*=/ })).toHaveCount(1);

  // Pearson: one bar per cell, and the formula's χ² is the readout's.
  await dock.getByRole('radio', { name: /Pearson: cell by cell/ }).click();
  const exact1 = await kernel({ root, params: { view: 1, law: 0, h0: 0, n: 200, reps: 0 } });
  const chi2 = exact1.readouts.find((r) => r.key === 'chi2').observed;
  await expect(formula).toContainText(String(Number(chi2.toFixed(3))));
  await expect(dock.locator('.chart-series--hist.tone-default rect')).toHaveCount(exact1.series[0].y.length);

  // A typed n and a mismatched H0 (sample uniform, H0 normal): the χ² and p-value follow the kernel.
  await page.goto('/#station/fit?seed=7&view=1&law=1&h0=0&n=200&reps=0');
  await expect(formula).toContainText('\\chi^2');
  const n = dock.getByLabel(/Sample size n, typed value/);
  await n.fill('600');
  await n.press('Enter');
  await expect(page).toHaveURL(/[?&]n=600(&|$)/, { timeout: 5000 });
  const exact2 = await kernel({ root, params: { view: 1, law: 1, h0: 0, n: 600, reps: 0 } });
  const chi2b = exact2.readouts.find((r) => r.key === 'chi2').observed;
  await expect(formula).toContainText(String(Number(chi2b.toFixed(3))));
  await expect(formula).toContainText('reject');
});
