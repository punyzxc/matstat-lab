import { test } from '@playwright/test';
test('shot', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/?lang=ru#station/testing?seed=9&sigmaKnown=1&a0=0&mu=0.6&n=16&tail=0&R=400&truth=1');
  await page.waitForTimeout(8000);
  await page.locator('.live-formula').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/claude-0/-home-user/52fef441-667c-50c5-b088-b067bdc78b9e/scratchpad/r1.png' });
  await page.locator('.decision-shares').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/claude-0/-home-user/52fef441-667c-50c5-b088-b067bdc78b9e/scratchpad/r2.png' });
});
