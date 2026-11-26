import { expect, test } from '@playwright/test';

// #194: a lecture figure stops its animation loop when paused, behind a portal, in a hidden tab or off screen,
// and draws exactly one fresh frame when something changes while it is still. Every figure canvas counts the
// frames it draws in a plain property, `canvas.__frames`.
const stage = (page) => page.locator('.story-figure canvas.figure-canvas');
const frames = (canvas) => canvas.evaluate((el) => el.__frames ?? 0);
const pause = (page) => page.locator('.story-stage').getByRole('button', { name: 'Pause' });
const play = (page) => page.locator('.story-stage').getByRole('button', { name: 'Play' });

/** Frames drawn over `ms` milliseconds, after `settle` ms for the frame in flight. */
async function drawnOver(page, canvas, ms, settle = 300) {
  await page.waitForTimeout(settle);
  const a = await frames(canvas);
  await page.waitForTimeout(ms);
  return (await frames(canvas)) - a;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 860 });
});

test('Pause stops the figure loop; Play starts it again', async ({ page }) => {
  await page.goto('/#lecture/8/1');
  const canvas = stage(page);
  await expect(canvas).toBeVisible();
  await expect.poll(() => frames(canvas)).toBeGreaterThan(10);
  await pause(page).click();
  expect(await drawnOver(page, canvas, 1000)).toBe(0);
  await play(page).click();
  expect(await drawnOver(page, canvas, 1000, 100)).toBeGreaterThan(2);
});

test('a portal stops the figure under it, which resumes on close with the same simulation state', async ({ page }) => {
  await page.goto('/#lecture/11/4');
  const canvas = stage(page);
  const result = page.locator('[data-step="4"]').getByTestId('live-formula').locator('[data-role="res"]').first();
  await expect.poll(() => frames(canvas)).toBeGreaterThan(10);
  await page.locator('[data-step="4"]').getByTestId('story-portal').click();
  await expect(page.getByTestId('story-portal-view')).toBeVisible();
  // the portal's own figure runs; the one under it does not
  const portalCanvas = page.getByTestId('story-portal-view').locator('canvas');
  await expect.poll(() => frames(portalCanvas)).toBeGreaterThan(10);
  await page.waitForTimeout(300);
  const before = await result.textContent();
  expect(await drawnOver(page, canvas, 1000, 0)).toBe(0);
  expect(await result.textContent()).toBe(before);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('story-portal-view')).toHaveCount(0);
  // no restart: the figure goes on from where it stood
  expect(await drawnOver(page, canvas, 1000, 0)).toBeGreaterThan(2);
  const after = Number((await result.textContent()).replace(/[^\d.]/g, ''));
  expect(after).toBeGreaterThanOrEqual(Number(before.replace(/[^\d.]/g, '')));
});

test('a hidden tab or a figure out of the viewport draws no frames', async ({ page }) => {
  await page.goto('/#lecture/7/1');
  const canvas = stage(page);
  await expect.poll(() => frames(canvas)).toBeGreaterThan(10);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await drawnOver(page, canvas, 2000)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await drawnOver(page, canvas, 1000, 100)).toBeGreaterThan(2);

  // out of the viewport (same size, moved away)
  await canvas.evaluate((el) => { el.style.transform = 'translateY(-5000px)'; });
  expect(await drawnOver(page, canvas, 2000)).toBe(0);
  await canvas.evaluate((el) => { el.style.transform = ''; });
  expect(await drawnOver(page, canvas, 1000, 100)).toBeGreaterThan(2);
});

test('while paused, a param change or a resize draws exactly one fresh frame, and no unchanged results are reported', async ({ page }) => {
  await page.goto('/#lecture/8/4');
  const canvas = stage(page);
  await expect.poll(() => frames(canvas)).toBeGreaterThan(10);
  await pause(page).click();
  await page.waitForTimeout(300);

  // no results are reported again while nothing moves
  const changes = await page.evaluate(() => new Promise((done) => {
    let n = 0;
    const mo = new MutationObserver((list) => { n += list.length; });
    for (const el of document.querySelectorAll('[data-role="res"]')) mo.observe(el, { childList: true, characterData: true, subtree: true });
    setTimeout(() => { mo.disconnect(); done(n); }, 1000);
  }));
  expect(changes).toBe(0);

  // a value typed into the formula: one fresh frame when it is committed, then still
  const formula = page.locator('[data-step="4"]').getByTestId('live-formula');
  await formula.locator('[data-v="n"][data-role="edit"]').first().focus();
  await page.keyboard.press('Enter');
  const input = formula.getByRole('textbox');
  await input.fill('40');
  await page.waitForTimeout(300);
  let a = await frames(canvas);
  await input.press('Enter');
  await expect(formula.locator('[data-v="n"][data-role="edit"]').first()).toHaveText('40');
  await page.waitForTimeout(500);
  expect(await frames(canvas) - a).toBe(1);
  expect(await drawnOver(page, canvas, 1000, 0)).toBe(0);

  // a resize: one fresh frame, then still
  a = await frames(canvas);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  expect(await frames(canvas) - a).toBe(1);
  expect(await drawnOver(page, canvas, 1000, 0)).toBe(0);
});
