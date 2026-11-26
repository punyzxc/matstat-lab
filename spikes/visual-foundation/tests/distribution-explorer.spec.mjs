import { test, expect } from '@playwright/test';
import { run } from '../../lecture-distribution-explorer/kernel.mjs';

// #91: the Distribution Explorer is a kernel station in the scene: a histogram against f(x), the empirical CDF against
// F(x), x̄ and s² beside MX and DX in the live formula, for built-in and typed laws, reproducible from the seed.
const settled = async (dock) => expect(dock.locator('.autoplay-status')).toContainText(/Live · draw/, { timeout: 15000 });

test('a built-in law: histogram and density, ECDF and CDF, x̄ and s² beside MX and DX', async ({ page }) => {
  await page.goto('/#station/distribution?seed=12&law=0&a=2&sigma=1.5&n=2000');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByRole('heading', { name: 'Distribution Explorer', exact: true })).toBeVisible();
  await settled(dock);
  await expect(dock.locator('.chart-series--hist').first()).toBeVisible();
  await expect(dock.locator('.chart-series--pdf').first()).toBeVisible();
  await expect(dock.locator('.chart-series--ecdf').first()).toBeVisible();
  await expect(dock.locator('.chart-series--cdf').first()).toBeVisible();
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula.locator('.katex').first()).toBeVisible();
  await expect(formula).toContainText('MX = 2');
  await expect(formula).toContainText('DX = 2.25');
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  await expect(readouts.getByRole('row', { name: /^Sample mean/ })).toBeVisible();
  await expect(readouts.getByRole('row', { name: /^Kolmogorov distance/ })).toBeVisible();
});

test('a discrete law shows masses; a typed law is a source', async ({ page }) => {
  await page.goto('/#station/distribution?seed=5&law=4&lambda=3&n=1000');
  const dock = page.getByTestId('station-dock');
  await settled(dock);
  await expect(dock.locator('.chart-series--points').first()).toBeVisible();
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('MX = 3');
  await page.goto('about:blank');
  await page.goto('/#station/distribution?seed=5&law=5&n=1000&custom=2x%20on%20%5B0%2C%201%5D');
  await expect(dock.getByRole('textbox', { name: /^Your law/ })).toHaveValue('2x on [0, 1]');
  await settled(dock);
  await expect(dock.getByRole('table', { name: 'Readouts' }).getByRole('row', { name: /^Sample mean/ })).toContainText('0.66667');
  await expect(dock.locator('.chart-series--pdf').first()).toBeVisible();
});

test('the readouts match the kernel for the seed on show; the old lecture link still opens its experiment', async ({ page }) => {
  await page.goto('/#station/distribution?seed=21&law=2&lambda=0.5&n=800');
  const dock = page.getByTestId('station-dock');
  await settled(dock);
  await dock.getByRole('button', { name: 'Stop the experiment' }).click();
  await expect(dock.getByRole('button', { name: 'Play the experiment' })).toBeVisible();
  const seed = Number(await dock.locator('#station-seed').inputValue());
  const r = run({ law: 2, lambda: 0.5, n: 800 }, { seed });
  const mean = r.readouts.find((x) => x.key === 'mean').observed;
  await expect(dock.getByRole('table', { name: 'Readouts' }).getByRole('row', { name: /^Sample mean/ })).toContainText(String(Number(mean.toPrecision(5))));
  await expect(page).toHaveURL(new RegExp(`seed=${seed}`));

  // `dist` and `scale` were the old Explorer's knobs: dist=2, scale=1 is the exponential law with mean 1.
  await page.goto('about:blank');
  await page.goto('/#station/distribution?seed=506&dist=2&n=1024&scale=1');
  await expect(dock.getByRole('radio', { name: 'exponential' })).toHaveAttribute('aria-checked', 'true');
  await expect(dock.locator('#p-n')).toHaveValue('1024');
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('MX = 1');
});
