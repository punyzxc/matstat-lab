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
  await expect(page).toHaveURL(/rho=0\.55/);
});

test('Moments curves morph while the σ slider moves, and the link follows without a Run button', async ({ page }) => {
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
  await expect(page).toHaveURL(/sigma=1\.5/);
});

// #96: typed ρ, σ_X, σ_Y; r beside ρ with the typeset regression line; ρ = ±1 collapses to a ridge with a caption.
test('Scatter takes typed rho and both sigmas, shows r beside rho and the regression line, and explains rho = 1', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/scatter?seed=7&rho=0.6&sigma1=2&sigma2=1');
  const dock = page.getByTestId('station-dock');
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  const line = readouts.getByRole('row', { name: /Regression line/ });
  await expect(line.locator('.katex').first()).toBeVisible();
  await expect(line).toContainText('y=0.3x');
  await expect(readouts.getByRole('row', { name: /sample r against ρ/ })).toContainText('0.6');

  const rho = dock.getByLabel(/Correlation ρ \(experiment 0\), typed value/);
  await rho.fill('1');
  await rho.press('Enter');
  await expect(page).toHaveURL(/rho=1(&|$)/);
  await expect(dock.locator('svg.surface-svg')).toHaveAttribute('aria-label', /all probability on the line/);
  await expect(dock.locator('.station-notes')).toContainText('no density in the plane');
  const sx = dock.getByLabel(/of ξ \(experiment 0\), typed value/);
  await sx.fill('1,5');
  await sx.press('Enter');
  await expect(page).toHaveURL(/sigma1=1\.5/);
});
