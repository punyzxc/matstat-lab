import { test, expect } from '@playwright/test';

// #88: a law typed by the student: validated inline, typeset, previewed (pmf/pdf and CDF), and used as a source.
test('LLN: a typed discrete law is validated, typeset and drives the running means', async ({ page }) => {
  await page.goto('/#station/lln?seed=4&law=5&N=2000');
  const dock = page.getByTestId('station-dock');
  const field = dock.getByRole('textbox', { name: /^Your law/ });
  await expect(field).toHaveValue('0 1 2 | 0.2 0.5 0.3');
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula.locator('.katex').first()).toBeVisible();
  // The preview: the pmf as stems and the CDF as steps.
  await expect(dock.locator('.chart-series--pmf').first()).toBeVisible();
  await expect(dock.locator('.chart-series--ecdf').first()).toBeVisible();
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  await expect(readouts.getByRole('row', { name: /^Running mean/ })).toContainText('1.1');

  // An invalid law is explained inline while the last valid one keeps playing.
  await field.fill('0 1 2 | 0.2 0.5 0.2');
  await field.press('Enter');
  await expect(dock.getByRole('alert')).toContainText('The probabilities add up to 0.9, not 1.');
  await field.fill('2x on [0, 1]');
  await field.press('Enter');
  await expect(dock.getByRole('alert')).toHaveCount(0);
  await expect(readouts.getByRole('row', { name: /^Running mean/ })).toContainText('0.66667');
  await expect(dock.locator('.chart-series--pdf').first()).toBeVisible();
  await expect(page).toHaveURL(/custom=2x/);
});

test('CLT: the typed law is a source of the histogram view and of the 3D ridge', async ({ page }) => {
  await page.goto('/#station/clt?seed=4&law=4&n=20&custom=3x%5E2%20on%20%5B0%2C%201%5D');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByRole('textbox', { name: /^Your law/ })).toHaveValue('3x^2 on [0, 1]');
  await expect(dock.getByRole('group', { name: 'Live formula' }).locator('.katex').first()).toBeVisible();
  await expect(dock.locator('.chart-series--hist').first()).toBeVisible();
  await page.goto('about:blank');
  await page.goto('/#station/clt?seed=4&view=3&source=5&nmax=12&custom=0%201%20%7C%200.9%200.1');
  await expect(dock.locator('svg.surface-svg')).toBeVisible();
  await expect(dock.getByText(/^Typed law/).first()).toBeVisible();
  await expect(dock.getByRole('textbox', { name: /^Your law/ })).toHaveValue('0 1 | 0.9 0.1');
});

test('a typed law is hidden where it does not apply', async ({ page }) => {
  await page.goto('/#station/lln?seed=4&law=1');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByRole('radio', { name: 'typed' })).toBeVisible();
  await expect(dock.getByRole('textbox', { name: /^Your law/ })).toHaveCount(0);
  await dock.getByRole('radio', { name: 'typed' }).click();
  await expect(dock.getByRole('textbox', { name: /^Your law/ })).toBeVisible();
});
