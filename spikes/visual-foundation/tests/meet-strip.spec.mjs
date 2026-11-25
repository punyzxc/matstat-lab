import { expect, test } from '@playwright/test';

// #128: exact, approximate and simulated values side by side, with their gaps; hovering one lights its curve.
test('Meeting strip: Bernoulli shows all three, hovering the approximation lights the normal curve', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/bernoulli?seed=3&view=0&n=100&p=0.3&k=30&lo=20&hi=35&R=4000');
  const dock = page.getByTestId('station-dock');
  const strip = dock.getByRole('region', { name: 'Exact, approximate and simulated values' });
  await expect(strip.locator('.meet-cell')).toHaveCount(3);
  await expect(strip.locator('.meet-cell[data-kind="exact"] .meet-value')).toHaveText('0.875034');
  await expect(strip.locator('.meet-cell[data-kind="approx"] .meet-gap')).toContainText('gap 0.001039');
  const chart = dock.locator('.chart-stage figure.chart').first().locator(':scope > svg');
  await expect(chart).not.toHaveAttribute('data-focus');
  await strip.locator('.meet-cell[data-kind="approx"]').hover();
  await expect(chart).toHaveAttribute('data-focus', 'local');
  await expect(chart.locator('.chart-series--lit')).toHaveCount(1);
  await strip.locator('.meet-cell[data-kind="sim"]').focus();
  await expect(chart).toHaveAttribute('data-focus', 'sim');
  await expect(strip.locator('.meet-mark')).toHaveCount(3);
});

test('Meeting strip: CLT has all three; the LLN and darts only exact and simulated; Cauchy none', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const strip = page.getByTestId('station-dock').getByRole('region', { name: 'Exact, approximate and simulated values' });
  await page.goto('/#station/clt?seed=3&law=1&n=5&R=4000&view=0');
  await expect(strip.locator('.meet-cell')).toHaveCount(3);
  await expect(strip.locator('.meet-cell[data-kind="exact"]')).toContainText('Erlang');
  await page.goto('about:blank');
  await page.goto('/#station/lln?seed=3&law=0&N=2000&view=0');
  await expect(strip.locator('.meet-cell')).toHaveCount(2);
  await expect(strip.locator('.meet-cell[data-kind="approx"]')).toHaveCount(0);
  await page.goto('about:blank');
  await page.goto('/#station/darts?seed=3&view=1&N=4000');
  await expect(strip.locator('.meet-cell')).toHaveCount(2);
  await expect(strip.locator('.meet-cell[data-kind="exact"] .meet-value')).toHaveText('0.785398');
  await page.goto('about:blank');
  await page.goto('/#station/lln?seed=3&law=4&N=2000&view=0');
  await expect(page.getByTestId('station-dock').getByRole('table', { name: 'Readouts' })).toContainText('does not exist');
  await expect(strip).toHaveCount(0);
});
