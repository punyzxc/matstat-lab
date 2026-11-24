import { expect, test } from '@playwright/test';

// #44: the L6 stations run the lecture-random-vectors kernel live inside the scene.
test('Scatter shows a rotatable joint-density surface that follows ρ', async ({ page }) => {
  await page.goto('/#station/scatter?seed=7&rho=0.6');
  const surface = page.locator('svg.surface-svg');
  await expect(surface).toBeVisible();
  await expect(surface).toHaveAttribute('aria-label', /ρ = 0\.6/);
  const meshBefore = await surface.innerHTML();
  await surface.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => surface.innerHTML()).not.toBe(meshBefore);
  const rho = page.locator('#p-rho');
  await rho.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(surface).toHaveAttribute('aria-label', /ρ = 0\.55/);
  await expect(page.getByText('Live preview')).toBeVisible();
  await expect(page).toHaveURL(/rho=0\.6/);
});

test('Moments curves morph while the σ slider moves, and the link updates only on Run', async ({ page }) => {
  await page.goto('/#station/moments?seed=3');
  const curve = page.locator('.chart-series--pdf').first();
  // Width at half height of the drawn bell, in screen pixels: a real change of shape, not path noise.
  const halfWidth = () => curve.evaluate((path) => {
    const pts = [...path.getAttribute('d').matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
    const top = Math.min(...pts.map((p) => p[1])), base = Math.max(...pts.map((p) => p[1]));
    const above = pts.filter((p) => p[1] < (top + base) / 2).map((p) => p[0]);
    return Math.max(...above) - Math.min(...above);
  });
  const before = await halfWidth();
  await page.locator('#p-sigma').focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(halfWidth).toBeGreaterThan(before + 20);
  await page.getByRole('button', { name: /Run With These Parameters/ }).click();
  await expect(page).toHaveURL(/sigma=1\.5/);
});
