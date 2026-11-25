import { expect, test } from '@playwright/test';

// #131: outcomes of two dice map to values X(ω); the area left of a typed x is F(x) on the linked CDF.
test('Distribution function: a typed mapping relights the outcomes, the staircase is right-continuous', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/cdf?seed=3&source=0&map=0&x=7');
  const dock = page.getByTestId('station-dock');
  const flight = dock.getByRole('region', { name: 'Outcomes to values' });
  const svg = flight.locator('svg');
  await expect(svg).toHaveAttribute('data-lit', '21');
  await expect(flight.locator('.of-cell')).toHaveCount(36);
  await expect(flight.locator('.of-dot')).toHaveCount(36);
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('2136');
  // The CDF jumps at each value: filled dots (F includes the jump) and open dots (the limit from the left).
  await expect(dock.locator('.chart-marker--dot circle')).toHaveCount(11);
  await expect(dock.locator('.chart-marker--open circle')).toHaveCount(11);

  const x = dock.getByLabel(/Bound x in F\(x\).*typed value/);
  await x.fill('7,5');
  await x.press('Enter');
  await expect(svg).toHaveAttribute('data-lit', '21'); // nothing changes between two values
  await x.fill('8');
  await x.press('Enter');
  await expect(svg).toHaveAttribute('data-lit', '26');

  // Mapping 4 with typed coefficients: X = 2ω₁ − ω₂.
  await dock.getByRole('radio', { name: /^linear/ }).click();
  await expect(page).toHaveURL(/map=4/);
  await expect(formula).toContainText('2ω1−ω2');
  const b = dock.getByLabel(/Coefficient b .*typed value/);
  await b.fill('1');
  await b.press('Enter');
  await expect(formula).toContainText('2ω1+ω2');
});

test('Distribution function: the shaded area under the normal density equals F(x) on the linked curve', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/cdf?seed=3&source=3&x=1');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByRole('region', { name: 'Outcomes to values' })).toHaveCount(0);
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  const area = readouts.getByRole('row', { name: /Shaded area/ });
  await expect(area).toContainText('0.84135');
  await expect(dock.locator('.chart')).toHaveCount(2);
  await expect(dock.locator('.chart').first()).toHaveAccessibleName(/Area to the left of x\s*: F \( x \) = 0\.841345/);
  const x = dock.getByLabel(/Bound x in F\(x\).*typed value/);
  await x.fill('-1');
  await x.press('Enter');
  await expect(area).toContainText('0.15866');
  await expect(page).toHaveURL(/x=-1(&|$)/);
});
