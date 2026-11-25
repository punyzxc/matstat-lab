import { test, expect } from '@playwright/test';

// #86: the CLT as one shape: a ridge of histograms of S_n* over n with phi on the far wall and D_n per slice.
test('the ridge fills live, carries phi on the wall and reads D_n per slice', async ({ page }) => {
  await page.goto('/#station/clt?seed=3&view=3&source=1&nmax=20');
  const dock = page.getByTestId('station-dock');
  const surface = dock.locator('svg.surface-svg');
  await expect(surface).toBeVisible();
  await expect(dock.locator('g.surface-wall path.surface-wall-curve')).toHaveCount(1);
  await expect(dock.locator('.surface-key-wall')).toContainText(/φ|varphi|far wall|дальней стенке/);
  // Growth: R climbs to its target while the ridge fills.
  await expect(dock.getByText(/Growing the sample|Выборка растёт/)).toBeVisible();
  await expect(dock.getByText(/Growing the sample|Выборка растёт/)).toHaveCount(0, { timeout: 15000 });
  // The D_n chart has one point per slice.
  await expect(dock.locator('.chart-series--points circle').first()).toBeVisible();
  expect(await dock.locator('.chart-series--points').first().locator('circle').count()).toBe(20);
  // Reading a point gives x, n, the height and that slice's Kolmogorov distance.
  await surface.focus();
  await page.keyboard.press('Shift+ArrowUp');
  await expect(dock.locator('.surface-readout')).toContainText(/D/);
});

test('Cauchy does not settle and the caption says why', async ({ page }) => {
  await page.goto('/#station/clt?seed=3&view=3&source=4&nmax=20');
  const dock = page.getByTestId('station-dock');
  await expect(dock.locator('svg.surface-svg')).toBeVisible();
  await expect(dock.getByText(/CLT does not apply|ЦПТ неприменима/).first()).toBeVisible();
});

test('the same params and seed give the same ridge after a reload', async ({ page }) => {
  const url = '/#station/clt?seed=11&view=3&source=2&p=0.4&nmax=12';
  const read = async () => {
    const dock = page.getByTestId('station-dock');
    await expect(dock.getByText(/Growing the sample|Выборка растёт/)).toHaveCount(0, { timeout: 15000 });
    await dock.getByRole('button', { name: /Stop|Стоп|Pause|Пауза/ }).first().click();
    return dock.locator('table.readouts tbody').innerText();
  };
  await page.goto(url);
  const first = await read();
  await page.goto('about:blank');
  await page.goto(url);
  expect(await read()).toBe(first);
});
