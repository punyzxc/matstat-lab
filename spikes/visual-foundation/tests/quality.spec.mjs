import { expect, test } from '@playwright/test';

const globe = (page) => page.locator('.orbital-disc canvas');
const figure = (page) => page.locator('.story-figure canvas.figure-canvas');
const measureDpr = (canvas) => canvas.evaluate((el) => el.width / el.getBoundingClientRect().width);

test('a forced quality survives reload and limits visible canvas resolution and backdrop blur', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto('/?quality=low');
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
    await expect(globe(page)).toBeVisible();
    await expect.poll(() => measureDpr(globe(page))).toBeLessThanOrEqual(1.01);
    await page.goto('/#lecture/8/1');
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
    await expect(figure(page)).toBeVisible();
    await expect.poll(() => measureDpr(figure(page))).toBeLessThanOrEqual(1.01);
    const painted = () => figure(page).evaluate((el) => el.__frames ?? 0);
    const globePainted = () => globe(page).evaluate((el) => el.__frames ?? 0);
    await expect.poll(painted).toBeGreaterThan(3);
    const initialPaints = await painted();
    const initialGlobePaints = await globePainted();
    await page.waitForTimeout(1000);
    const frames = (await painted()) - initialPaints;
    const globeFrames = (await globePainted()) - initialGlobePaints;
    expect(frames).toBeGreaterThan(2);
    expect(frames).toBeLessThanOrEqual(31);
    expect(globeFrames).toBeGreaterThan(0);
    expect(globeFrames).toBeLessThanOrEqual(6);
    expect(await page.locator('.scene-dock--story').evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none');
    await page.goto('/?quality=high');
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'high');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'high');
  } finally {
    await context.close();
  }
});

test('poor automatic frame cadence lowers a desktop profile once', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
    Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => request((now) => callback(now * 3));
  });
  const messages = [];
  page.on('console', (entry) => { if (entry.text().includes('STATUM LAB quality:')) messages.push(entry.text()); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'medium');
  // Over two additional simulated windows the profile must stay at medium.
  await page.waitForTimeout(2200);
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'medium');
  expect(messages).toHaveLength(1);
});
