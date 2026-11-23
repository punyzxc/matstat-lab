import { expect, test } from '@playwright/test';

test('globe, module links and preview motion share the pause control', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Orbital laboratory' })).toBeVisible();
  const globe = page.getByRole('img', { name: /Earth point cloud/ });
  await expect(globe).toBeVisible();
  const frame = () => globe.evaluate((node) => node.toDataURL());
  const first = await frame();
  await expect.poll(frame).not.toBe(first);
  await expect(page.locator('.orbit-link-trace')).toHaveCount(6);
  await expect(page.locator('.orbit-link-focal')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pause motion' }).click();
  const paused = await frame();
  await expect(page.locator('.orbit-link-focal')).toHaveCount(0);
  await expect(page.locator('.orbit-preview[data-motion="false"]')).toHaveCount(6);
  await page.waitForTimeout(170);
  expect(await frame()).toBe(paused);
  await page.getByRole('button', { name: 'Wireframe' }).click();
  await expect.poll(frame).not.toBe(paused);
});

test('all six orbital windows are direct entry links and preserve the last opened channel', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const name of [
    'Distribution Explorer',
    'Convergence',
    'Estimation',
    'Confidence Intervals',
    'Hypothesis Testing',
    'Randomness',
  ]) {
    const node = page
      .getByRole('navigation', { name: 'Laboratory modules' })
      .getByRole('link', { name: new RegExp('^' + name) });
    await node.focus();
    await expect(node).toHaveAttribute('data-active', 'true');
    await node.press('Enter');
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Orbital laboratory', exact: true }).click();
    await expect(node).toHaveAccessibleName(/Last opened/);
  }
  await page.reload();
  await expect(page.locator('[data-module="randomness"]')).toHaveAccessibleName(/Last opened/);
});

test('narrow screens keep all connected windows and immediate static previews', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const globe = page.getByRole('img', { name: /Earth point cloud/ });
  await expect(globe).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const before = await globe.evaluate((node) => node.toDataURL());
  await page.waitForTimeout(210);
  expect(await globe.evaluate((node) => node.toDataURL())).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.locator('.orbit-link-trace')).toHaveCount(6);
  await expect(page.locator('.orbit-preview[data-motion="false"]')).toHaveCount(6);
  await page.getByRole('link', { name: /^Distribution Explorer/ }).click();
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible();
});

test('the active sample updates the distribution window and unvisited examples', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const distribution = page.locator('[data-module="distribution"]');
  await expect(distribution).toHaveAttribute('data-saved', 'false');
  await page.getByLabel('Model', { exact: true }).selectOption('uniform');
  await page.getByRole('button', { name: 'Resample' }).click();
  await expect(distribution).toHaveAccessibleName(/Latest result.*Uniform, seed 2049/);
  await expect(page.locator('[data-module="confidence"]')).toHaveAccessibleName(
    /Seeded preview.*Uniform, seed 2049/,
  );
  await distribution.click();
  await expect(page.getByLabel('Random seed')).toHaveValue('2049');
});

test('static preference changes live and the reference dialog restores focus', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Reduced motion enabled' })).toBeDisabled();
  await page.getByRole('button', { name: 'Lab notes' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Lab notes' })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Pause motion' })).toBeEnabled();
});

test('the secondary trefoil study retains a working fallback and CDF readout', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === 'webgl2' ? null : getContext.call(this, kind, ...args);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByText('Geometric study · Trefoil', { exact: true }).click();
  const probe = page.getByRole('button', { name: 'Inspect next draw' });
  await expect(probe).toContainText('F(x) = 0.735');
  await probe.click();
  await expect(probe).toContainText('F(x) = 0.913');
  await expect(page.getByRole('img', { name: /Trefoil knot/ })).toBeVisible();
});
