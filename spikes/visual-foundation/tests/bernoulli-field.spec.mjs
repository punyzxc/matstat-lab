import { test, expect } from '@playwright/test';

// #85: the Bernoulli field: exact P_n(k) as 3D bars over (k, n), n growing live, an approximation sheet and its error strip.
test('the field grows n live up to N, with bars, the approximation sheet and the formulas', async ({ page }) => {
  await page.goto('/#station/bernoulli?seed=3&view=2&pf=0.3&N=24&approx=1');
  const dock = page.getByTestId('station-dock');
  // Growth runs over N (the hidden R of the other views does not grow here).
  await expect(dock.getByText(/Growing the sample|Выборка растёт/)).toBeVisible();
  await expect(dock.getByText(/Growing the sample|Выборка растёт/)).toHaveCount(0, { timeout: 15000 });
  const surface = dock.locator('svg.surface-svg');
  await expect(surface).toBeVisible();
  expect(await dock.locator('g.surface-bar3d').count()).toBeGreaterThan(100);
  expect(await dock.locator('path.surface-overlay').count()).toBeGreaterThan(100);
  await expect(dock.locator('.surface-key-overlay')).toBeVisible();
  // The error strip: one point per n.
  expect(await dock.locator('.chart-series--points').first().locator('circle').count()).toBe(24);
  // Formulas in textbook notation.
  const formula = dock.locator('.live-formula');
  await expect(formula.locator('.katex').first()).toBeVisible();
  await expect(formula).toContainText(/φ|C/);
});

test('switching to Poisson changes the sheet and the formula; the heights repeat after a reload', async ({ page }) => {
  const url = '/#station/bernoulli?seed=3&view=2&pf=0.05&N=20&approx=0';
  await page.goto(url);
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByText(/Growing the sample|Выборка растёт/)).toHaveCount(0, { timeout: 15000 });
  await expect(dock.locator('.surface-key-overlay')).toContainText(/λ|Poisson|Пуассон/);
  const first = await dock.locator('table.readouts tbody').innerText();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(dock.getByText(/Growing the sample|Выборка растёт/)).toHaveCount(0, { timeout: 15000 });
  expect(await dock.locator('table.readouts tbody').innerText()).toBe(first);
});
