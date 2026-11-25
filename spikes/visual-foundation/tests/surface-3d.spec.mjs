import { test, expect } from '@playwright/test';

// #84: the 3D surface turns by itself, holds after a manual turn, reads a point and stays still under reduced motion.
test('the surface auto-rotates, holds after a manual turn and reads a point', async ({ page }) => {
  await page.goto('/#station/scatter?seed=7&rho=0.6');
  const surface = page.locator('svg.surface-svg');
  await expect(surface).toBeVisible();
  const yaw0 = Number(await surface.getAttribute('data-yaw'));
  await expect.poll(async () => Number(await surface.getAttribute('data-yaw')), { timeout: 5000 }).not.toBe(yaw0);

  await surface.focus();
  await page.keyboard.press('ArrowRight');
  const held = await surface.getAttribute('data-yaw');
  await page.waitForTimeout(1200);
  expect(await surface.getAttribute('data-yaw')).toBe(held);

  await page.keyboard.press('Shift+ArrowRight');
  const readout = page.locator('.surface-readout');
  await expect(readout).toHaveText(/=.*=.*=/);
  await expect(page.locator('g.surface-cursor')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('g.surface-cursor')).toHaveCount(0);
});

test('under reduced motion the surface does not turn by itself', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/#station/scatter?seed=7&rho=0.6');
  const surface = page.locator('svg.surface-svg');
  await expect(surface).toBeVisible();
  const yaw = await surface.getAttribute('data-yaw');
  await page.waitForTimeout(1500);
  expect(await surface.getAttribute('data-yaw')).toBe(yaw);
  await context.close();
});
