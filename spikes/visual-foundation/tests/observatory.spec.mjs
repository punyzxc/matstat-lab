import { expect, test } from '@playwright/test';

test('observatory controls rotate, pause and switch the globe display', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Probability atlas' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Trefoil knot/ })).toBeVisible();
  await page.getByRole('button', { name: 'Earth', exact: true }).click();
  const canvas = page.getByRole('img', { name: /Earth point cloud/i });
  await expect(canvas).toBeVisible();
  const frame = () => canvas.evaluate((node) => node.toDataURL());
  const first = await frame();
  await expect.poll(frame).not.toBe(first);
  await page.getByRole('button', { name: 'Pause rotation' }).click();
  const paused = await frame();
  await page.waitForTimeout(180);
  expect(await frame()).toBe(paused);
  await page.getByRole('button', { name: 'Wireframe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wireframe', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(frame).not.toBe(paused);
});

test('module directory is keyboard operable and deep links survive reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Distribution Explorer/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Convergence/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('link', { name: /Open module/ }).click();
  await expect(page).toHaveURL(/#module\/convergence/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Convergence', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Probability atlas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Probability atlas' })).toBeVisible();
});

test('narrow reduced-motion view keeps a stationary trefoil and opens the seeded experiment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.getByRole('img', { name: /Trefoil knot/i });
  await expect(canvas).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const first = await canvas.evaluate((node) => node.toDataURL());
  await page.waitForTimeout(200);
  expect(await canvas.evaluate((node) => node.toDataURL())).toBe(first);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('link', { name: /Open module/ }).click();
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible();
});

test('respects a live motion preference change and restores note-dialog focus', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Reduced motion enabled' })).toBeDisabled();
  await page.getByRole('button', { name: 'Lab notes' }).click();
  await expect(page.getByRole('dialog', { name: 'Lab notes' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lab notes' })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Pause rotation' })).toBeEnabled();
});

test('telemetry follows the completed workspace run and all method previews respond', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#module/distribution');
  await page.getByLabel('Random seed').fill('abc');
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeDisabled();
  await page.getByLabel('Random seed').fill('73');
  await page.getByLabel('Distribution', { exact: true }).selectOption('uniform');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  const mean = await page.getByTestId('sample-mean').textContent();
  await page.getByRole('link', { name: 'Probability atlas', exact: true }).click();
  await expect(page.locator('.session-source')).toContainText('Uniform');
  await expect(page.locator('.session-source')).toContainText('73');
  await expect(page.locator('.metric-list dd').first()).toHaveText(mean);
  for (const name of [
    'Convergence',
    'Estimation',
    'Confidence Intervals',
    'Hypothesis Testing',
    'Randomness',
  ]) {
    await page.getByRole('tab', { name: new RegExp(name) }).click();
    await page.getByRole('link', { name: /Open module/ }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    const slider = page.getByRole('slider');
    await slider.focus();
    await slider.press('Home');
    await expect(slider).toHaveValue('8');
    await expect(page.locator('.method-value strong')).not.toBeEmpty();
    await page.goBack();
    await expect(page.getByRole('tab', { name: new RegExp(name) })).toHaveAttribute('aria-selected', 'true');
  }
});

test('at 320 px the two-column directory follows arrow keys and the ASCII matrix fits', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.getByRole('tab', { name: /Distribution Explorer/ }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: /Estimation/ })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Confidence Intervals/ })).toBeFocused();
  await expect(page.getByRole('tab', { name: /Confidence Intervals/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(
    await page
      .locator('.matrix-wrap pre')
      .first()
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});

test('inspecting a draw and resampling update the CDF and the active sample', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const probe = page.getByRole('button', { name: 'Inspect next draw' });
  await expect(probe).toContainText('F(x) = 0.735');
  await probe.click();
  await expect(probe).toContainText('DRAW 002');
  await expect(probe).toContainText('F(x) = 0.913');
  await page.getByRole('button', { name: 'Resample' }).click();
  await expect(page.locator('.session-source')).toContainText('2049');
  await page.getByLabel('Model', { exact: true }).selectOption('uniform');
  await expect(page.locator('.session-source')).toContainText('Uniform');
  const mean = await page.locator('.metric-list dd').first().textContent();
  await page.getByRole('link', { name: 'Launch experiment' }).click();
  await expect(page.getByLabel('Random seed')).toHaveValue('2049');
  await expect(page.getByTestId('sample-mean')).toHaveText(mean);
});

test('the engraved fallback remains interactive when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === 'webgl2' ? null : getContext.call(this, kind, ...args);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const plate = page.getByRole('img', { name: /Trefoil knot/ });
  await expect(plate).toBeVisible();
  const before = await plate.evaluate((c) => c.toDataURL());
  await page.getByRole('group', { name: /Rotate specimen/ }).press('ArrowRight');
  await expect.poll(() => plate.evaluate((c) => c.toDataURL())).not.toBe(before);
  await page.getByRole('link', { name: 'Launch experiment' }).click();
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible();
});
