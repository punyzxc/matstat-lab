import { expect, test } from '@playwright/test';

// #119: the geometric sandbox. The same typed region on a segment, in the square or in the cube; the measure by
// quadrature next to the running share of hits; the cube turns by itself and by hand.
test('Sandbox: the cube turns by itself, the keys turn it, and the ball fills π/6 of it', async ({ page }) => {
  await page.goto('/#station/darts?seed=3&view=4&dim=3&N=8000');
  const dock = page.getByTestId('station-dock');
  const cube = dock.locator('figure.board--cube');
  await expect(cube.locator('.cube-dot')).toHaveCount(1200, { timeout: 15000 });
  await expect(cube.locator('.cube-edge')).toHaveCount(12);
  const svg = cube.locator('svg');
  const yaw0 = Number(await svg.getAttribute('data-yaw'));
  await expect.poll(async () => Number(await svg.getAttribute('data-yaw'))).not.toBe(yaw0);

  await svg.focus();
  const before = Number(await svg.getAttribute('data-yaw'));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const after = Number(await svg.getAttribute('data-yaw'));
  expect(after - before).toBeGreaterThan(0.2); // two key steps of 0.12, and the auto turn waits while you steer

  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('(x,y,z)∈[0,1]3');
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  await expect(readouts.getByRole('row', { name: /^Volume of/ })).toContainText('0.5236'); // π/6 = 0.52360
  const field = dock.getByRole('textbox', { name: 'Region A in the unit cube', exact: true });
  await expect(field).toHaveValue('x^2 + y^2 + z^2 < 1');
  await dock.getByRole('button', { name: 'x + y + z < 1' }).click();
  await expect(readouts.getByRole('row', { name: /^Volume of/ })).toContainText('0.1666'); // 1/6
});

test('Sandbox: on the segment, x only; the same seed lands the same points', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/darts?seed=5&view=4&dim=1&N=4000');
  const dock = page.getByTestId('station-dock');
  const seg = dock.locator('figure.board--segment');
  await expect(seg.locator('.board-dart')).toHaveCount(400, { timeout: 15000 });
  const stop = dock.getByRole('button', { name: 'Stop the experiment' });
  if (await stop.count()) await stop.click();
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  await expect(readouts.getByRole('row', { name: /^Length of/ })).toContainText('0.7071'); // 1/√2
  const field = dock.getByRole('textbox', { name: /^Region A in the segment/ });
  await field.fill('y < x');
  await field.press('Enter');
  await expect(dock.getByRole('alert')).toContainText('On the segment use x only');
  await field.fill('|x - 0.5| < 0.2');
  await field.press('Enter');
  await expect(readouts.getByRole('row', { name: /^Length of/ })).toContainText('0.4');
  await expect(seg.locator('.board-region')).toHaveCount(1);
  await expect(page).toHaveURL(/region1=%7Cx%20-%200.5%7C/, { timeout: 5000 });
  const count = await seg.locator('.board-count').getAttribute('data-count');
  const link = page.url();
  await page.goto('about:blank');
  await page.goto(link);
  // Compare once the first 400 darts are drawn and the run is held, not mid-growth or after the next draw.
  await expect(seg.locator('.board-dart')).toHaveCount(400, { timeout: 15000 });
  if (await stop.count()) await stop.click();
  await expect(seg.locator('.board-count')).toHaveAttribute('data-count', count);

  // The space switch: the square keeps its own region.
  await dock.getByRole('radio', { name: 'square' }).click();
  await expect(dock.locator('figure.board--region')).toBeVisible();
  await expect(dock.getByRole('textbox', { name: 'Region A in the unit square', exact: true })).toHaveValue('y < x^2');
});
