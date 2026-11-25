import { expect, test } from '@playwright/test';

// #132: the expectation as a centre of mass, and the gamma/beta shape lab with a live formula.
test('Centre of mass: typing or dragging a weight moves the fulcrum to Σ x_i p_i', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/balance?seed=4&x1=-3&p1=0.2&x2=-1&p2=0.3&x3=1.5&p3=0.4&x4=4&p4=0.1');
  const dock = page.getByTestId('station-dock');
  const beam = dock.getByRole('region', { name: 'Centre of mass' });
  const fulcrum = beam.locator('.beam-fulcrum');
  await expect(fulcrum).toHaveAttribute('data-mean', '0.1');
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('=0.1');
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  await expect(readouts.getByRole('row', { name: /Torque about the fulcrum/ })).toBeVisible();

  // Typed: x4 = 2 moves the fulcrum by (2 − 4) · 0.1 = −0.2.
  const x4 = dock.getByLabel(/Value x₄, typed value/);
  await x4.fill('2');
  await x4.press('Enter');
  await expect(fulcrum).toHaveAttribute('data-mean', '-0.1');
  await expect(page).toHaveURL(/x4=2(&|$)/);

  // Keyboard on the weight itself: one step right is +0.1 on x3 (p3 = 0.4), so +0.04.
  const w3 = beam.getByRole('slider', { name: /Weight 3/ });
  await w3.focus();
  await page.keyboard.press('ArrowRight');
  await expect(fulcrum).toHaveAttribute('data-mean', '-0.06');
  await expect(page).toHaveURL(/x3=1\.6/);

  // Dragging weight 1 to the right end of the beam.
  const box = await beam.locator('svg').boundingBox();
  const c = await beam.locator('[data-weight="1"] circle').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, c.y + c.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await fulcrum.getAttribute('data-mean'))).toBeGreaterThan(0.3);
});

test('Shape lab: typed gamma and beta parameters update the moments in the live formula', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/moments?seed=2&law=6&a=2&b=3');
  const dock = page.getByTestId('station-dock');
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('=6');
  await expect(formula).toContainText('=18');
  const a = dock.getByLabel(/Shape: k \(law 6\).*typed value/);
  await a.fill('4');
  await a.press('Enter');
  await expect(formula).toContainText('=12');
  await expect(formula).toContainText('=1.5'); // Ek = 6/k
  await dock.getByRole('radio', { name: 'Beta' }).click();
  await expect(page).toHaveURL(/law=7/);
  await expect(dock.getByRole('table', { name: 'Readouts' }).getByRole('row', { name: /Skewness/ })).toBeVisible();
  await expect(formula).toContainText('=0.571429'); // α/(α + β) = 4/7
});
