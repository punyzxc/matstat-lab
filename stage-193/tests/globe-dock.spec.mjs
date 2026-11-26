import { expect, test } from '@playwright/test';

// #193: behind an open station, lecture or drawer the Earth still turns, at no more than 10 frames a second, and the
// dock is frosted by a static treatment instead of a live backdrop blur over the turning globe. The globe canvas
// counts the frames it draws in a plain property, `canvas.__frames`.
const globe = (page) => page.locator('.orbital-disc canvas');
const frames = (page) => globe(page).evaluate((el) => el.__frames ?? 0);
async function drawnOver(page, ms) {
  const a = await frames(page);
  await page.waitForTimeout(ms);
  return (await frames(page)) - a;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 860 });
});

test('the globe turns at most 10 frames a second behind a station, and back at full rate after it closes', async ({ page }) => {
  await page.goto('/');
  await expect(globe(page)).toBeVisible();
  await expect.poll(() => frames(page)).toBeGreaterThan(10);
  const free = (await drawnOver(page, 2000)) / 2; // frames a second with nothing over the scene
  expect(free).toBeGreaterThan(12);

  await page.goto('/#station/bernoulli?seed=3&view=0');
  await expect(page.getByTestId('station-dock')).toBeVisible();
  await page.waitForTimeout(500);
  const covered = await drawnOver(page, 5000);
  expect(covered).toBeGreaterThan(10); // the globe still turns
  expect(covered).toBeLessThanOrEqual(51);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('station-dock')).toHaveCount(0);
  // back to the scene's own rate right away (the first frame is drawn on close)
  const back = await drawnOver(page, 1000);
  expect(back).toBeGreaterThan(Math.max(10, 0.6 * free));
});

test('a lecture over the scene caps the globe too', async ({ page }) => {
  await page.goto('/#lecture/8/1');
  await expect(page.getByTestId('lecture-dock')).toBeVisible();
  await page.waitForTimeout(500);
  const covered = await drawnOver(page, 3000);
  expect(covered).toBeGreaterThan(5);
  expect(covered).toBeLessThanOrEqual(31);
});

test('the dock has no live backdrop blur and still reads as dark glass', async ({ page }) => {
  await page.goto('/#station/bernoulli?seed=3&view=0');
  const dock = page.getByTestId('station-dock');
  await expect(dock).toBeVisible();
  const style = await dock.evaluate((el) => {
    const s = getComputedStyle(el);
    return { blur: s.backdropFilter, image: s.backgroundImage };
  });
  expect(style.blur).toBe('none');
  expect(style.image).toMatch(/gradient/);
});

test('under reduced motion the globe stays still whether the dock is open or closed', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 860 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(globe(page)).toBeVisible();
  await page.waitForTimeout(800);
  expect(await drawnOver(page, 1500)).toBeLessThanOrEqual(1);
  await page.goto('/#station/bernoulli?seed=3&view=0');
  await expect(page.getByTestId('station-dock')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await drawnOver(page, 1500)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(await drawnOver(page, 1500)).toBeLessThanOrEqual(1);
  await context.close();
});
