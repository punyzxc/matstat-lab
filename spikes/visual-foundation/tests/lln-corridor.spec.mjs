import { expect, test } from '@playwright/test';

// #116: many running means and the Chebyshev corridor, with typed M and ε.
test('LLN corridor: typed paths and ε, the bundle, the share outside next to the Chebyshev bound', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/lln?seed=4&law=2&view=0&N=2000');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByLabel(/Paths M, typed value/)).toHaveCount(0);
  await dock.getByRole('radio', { name: 'corridor of many paths', exact: true }).click();
  const m = dock.getByLabel(/Paths M, typed value/);
  await m.fill('150');
  await m.press('Enter');
  const eps = dock.getByLabel(/Corridor half-width ε, typed value/);
  await eps.fill('0.05');
  await eps.press('Enter');
  await expect(page).toHaveURL(/M=150/, { timeout: 5000 });
  await expect(page).toHaveURL(/eps=0\.05/);
  const chart = dock.locator('.chart-stage figure').first();
  await expect(chart.locator('.chart-series--thin')).toHaveCount(150);
  await expect(dock.locator('.chart-stage figure')).toHaveCount(2); // the bundle, and the share outside under it
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('σ2nε2'); // σ²/(nε²)
  const table = dock.getByRole('table', { name: 'Readouts' });
  await expect(table).toContainText('Share of paths outside');
  await expect(table).toContainText('of 150 paths');
  await expect(dock.getByLabel(/Deviation k/)).toHaveCount(0);
});
