import { expect, test } from '@playwright/test';

// #121: unit vectors e^{itx_j} on the complex plane; their mean is the empirical φ(t), next to the exact φ(t).
test('Characteristic function: the mean arrow sits near the exact φ, t sweeps, and dragging a strip sets t', async ({ page }) => {
  await page.goto('/#station/charfn?seed=4&law=4&motion=1&t=1&n=2000');
  const dock = page.getByTestId('station-dock');
  const ph = dock.getByRole('region', { name: 'Characteristic function on the complex plane' });
  await expect(ph.locator('.ph-vectors line')).toHaveCount(240);
  const dot = ph.locator('.ph-mean-dot').first();
  // Normal N(0, 1): φ(1) = e^{-1/2} ≈ 0.6065 with Im φ = 0.
  await expect.poll(async () => Number(await dot.getAttribute('data-re'))).toBeGreaterThan(0.6065 - 0.09);
  expect(Number(await dot.getAttribute('data-re'))).toBeLessThan(0.6065 + 0.09);
  expect(Math.abs(Number(await dot.getAttribute('data-im')))).toBeLessThan(0.09);
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('0.6065');

  // The sweep: t moves by itself.
  await dock.getByRole('radio', { name: /sweeps by itself/ }).click();
  await expect(ph).toHaveAttribute('data-sweep', 'true');
  const t0 = await ph.locator('.ph-t').getAttribute('data-t');
  await expect.poll(async () => ph.locator('.ph-t').getAttribute('data-t')).not.toBe(t0);

  // Dragging along the Re strip stops the sweep and types t into the URL.
  const hit = ph.locator('.ph-strip[data-part="re"] .ph-hit');
  const box = await hit.boundingBox();
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect(ph).not.toHaveAttribute('data-sweep', 'true');
  await expect(page).toHaveURL(/motion=1/, { timeout: 5000 });
  await expect(page).toHaveURL(/[?&]t=3(\.|&|$)/, { timeout: 5000 }); // 3/4 of [-6, 6]
});

test('Characteristic function: a typed t, φ(0) = 1, and the lecture 9 link opens it on the scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/charfn?seed=2&law=0&motion=1&t=0&n=300&p=0.3');
  const ph = page.getByTestId('station-dock').getByRole('region', { name: 'Characteristic function on the complex plane' });
  await expect(ph.locator('.ph-mean-dot').first()).toHaveAttribute('data-re', '1.0000');
  const typed = page.getByTestId('station-dock').getByLabel(/Value of t, typed value/);
  await typed.fill('3.14');
  await typed.press('Enter');
  // Bernoulli(0.3) at t = π: φ = 1 - 2p = 0.4.
  await expect(page.getByTestId('station-dock').getByRole('group', { name: 'Live formula' })).toContainText('0.4');
  await expect(ph.locator('.ph-t')).toHaveAttribute('data-t', '3.140');

  await page.goto('/#lecture/9/1');
  await page.getByRole('link', { name: /Spin the unit vectors/ }).first().click();
  await expect(page).toHaveURL(/#station\/charfn\?seed=121&/);
  await expect(page.getByTestId('station-dock').getByRole('heading', { name: 'Characteristic function', exact: true })).toBeVisible();
});

// #122: the sums X + Y; their empirical φ lands on the product φ_X φ_Y, and one t is marked on every curve.
test('Sum view: histogram of X + Y, factor arrows, and the product matches the simulated sums', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/charfn?seed=5&view=1&law=5&law2=3&motion=1&t=1&n=3000&lambda=1&a2=0&s2=1');
  const dock = page.getByTestId('station-dock');
  const ph = dock.getByRole('region', { name: 'Characteristic function on the complex plane' });
  await expect(ph.locator('.ph-factor-arrow')).toHaveCount(2);
  await expect(ph.locator('.ph-strip-part')).toHaveCount(4);
  await expect(ph.locator('.ph-factor[data-part="X"]')).toContainText('0.500 + 0.500i'); // 1/(1 - i)
  await expect(ph.locator('.ph-factor[data-part="Y"]')).toContainText('0.841 + 0i'); // sin 1
  // Product (0.5 + 0.5i) · 0.8415 = 0.4207 + 0.4207i; the mean of the sums' vectors is within 4/√n.
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('0.4207');
  const dot = ph.locator('.ph-mean-dot').first();
  await expect.poll(async () => Number(await dot.getAttribute('data-re'))).toBeGreaterThan(0.4207 - 0.073);
  expect(Number(await dot.getAttribute('data-re'))).toBeLessThan(0.4207 + 0.073);
  expect(Math.abs(Number(await dot.getAttribute('data-im')) - 0.4207)).toBeLessThan(0.073);
  await expect(dock.locator('.chart-series--hist')).toHaveCount(1);

  // A drag on the Im strip moves the one shared cursor on all strips.
  const hit = ph.locator('.ph-strip[data-part="im"] .ph-hit');
  await hit.scrollIntoViewIfNeeded();
  const box = await hit.boundingBox();
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  await expect(page).toHaveURL(/[?&]t=-3(\.|&|$)/, { timeout: 5000 });
  const xs = await ph.locator('.ph-cursor').evaluateAll((ls) => ls.map((l) => l.getAttribute('x1')));
  expect(xs).toHaveLength(2);
  expect(xs[0]).toBe(xs[1]);

  await page.goto('/#lecture/9/2');
  await page.getByRole('link', { name: /Multiply two characteristic functions/ }).first().click();
  await expect(page).toHaveURL(/#station\/charfn\?seed=122&/);
  await expect(page).toHaveURL(/view=1/);
});
