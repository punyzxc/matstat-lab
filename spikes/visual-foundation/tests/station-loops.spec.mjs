import { expect, test } from '@playwright/test';

// #196: the rotating 3D surface, the cube, the phasor sweep and the beam animate without a React render per frame
// and stop their loops when there is nothing to animate. The surface counts its paints and React commits in plain
// properties (`svg.__paints`, `svg.__commits`), the beam its frames (`svg.__frames`).
const prop = (loc, key) => loc.evaluate((el, k) => el[k] ?? 0, key);
const hide = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 860 });
});

test('the 3D surface (exact Bernoulli field) turns for 5 s without a single React commit', async ({ page }) => {
  await page.goto('/#station/bernoulli?seed=3&view=2&pf=0.3&N=24&approx=1');
  const svg = page.locator('svg.surface-svg');
  await expect(svg).toBeVisible();
  await expect.poll(() => prop(svg, '__paints')).toBeGreaterThan(10);
  // the station grows the field N = 1 … 24 by itself for about 6 s; after that the surface data stays the same
  await page.waitForTimeout(7000);
  const [c0, p0, yaw0] = [await prop(svg, '__commits'), await prop(svg, '__paints'), Number(await svg.getAttribute('data-yaw'))];
  await page.waitForTimeout(5000);
  expect(await prop(svg, '__commits')).toBe(c0);
  expect(await prop(svg, '__paints') - p0).toBeGreaterThan(30);
  expect(Number(await svg.getAttribute('data-yaw'))).toBeGreaterThan(yaw0 + 0.5);
  // the painted geometry is complete: the bars of the field and the axis ticks
  expect(await svg.locator('.surface-bar3d path, path.surface-quad').count()).toBeGreaterThan(100);
  expect(await svg.locator('.surface-axis text').count()).toBeGreaterThan(4);
});

test('the 3D surface stops in a hidden tab and off screen, and turns again when back', async ({ page }) => {
  await page.goto('/#station/bernoulli?seed=3&view=2&pf=0.3&N=24&approx=1');
  const svg = page.locator('svg.surface-svg');
  await expect.poll(() => prop(svg, '__paints')).toBeGreaterThan(10);
  await page.waitForTimeout(7000); // the field has finished growing
  await hide(page, true);
  await page.waitForTimeout(200);
  let p = await prop(svg, '__paints');
  await page.waitForTimeout(2000);
  expect(await prop(svg, '__paints')).toBe(p);
  await hide(page, false);
  await expect.poll(() => prop(svg, '__paints')).toBeGreaterThan(p + 5);

  await svg.evaluate((el) => { el.style.transform = 'translateY(-5000px)'; });
  await page.waitForTimeout(200);
  p = await prop(svg, '__paints');
  await page.waitForTimeout(2000);
  expect(await prop(svg, '__paints')).toBe(p);
  await svg.evaluate((el) => { el.style.transform = ''; });
  await expect.poll(() => prop(svg, '__paints')).toBeGreaterThan(p + 5);
});

test('the cube stops turning in a hidden tab and off screen', async ({ page }) => {
  await page.goto('/#station/darts?seed=3&view=4&dim=3&N=8000');
  const svg = page.getByTestId('station-dock').locator('figure.board--cube svg');
  await expect(svg.locator('.cube-dot')).toHaveCount(1200, { timeout: 15000 });
  const yaw = () => svg.getAttribute('data-yaw');
  await hide(page, true);
  await page.waitForTimeout(200);
  let y = await yaw();
  await page.waitForTimeout(2000);
  expect(await yaw()).toBe(y);
  await hide(page, false);
  await expect.poll(yaw).not.toBe(y);

  await svg.evaluate((el) => { el.style.transform = 'translateY(-5000px)'; });
  await page.waitForTimeout(200);
  y = await yaw();
  await page.waitForTimeout(2000);
  expect(await yaw()).toBe(y);
});

test('the phasor sweep renders at most 30 times a second', async ({ page }) => {
  await page.goto('/#station/charfn?seed=4&law=4&motion=1&t=1&n=2000');
  const t = page.locator('.phasor .ph-t');
  await expect(t).toBeVisible();
  await page.getByTestId('station-dock').getByRole('radio', { name: /sweeps by itself/ }).click();
  await expect(page.locator('section.phasor')).toHaveAttribute('data-sweep', 'true');
  await page.waitForTimeout(500);
  const renders = await t.evaluate((el) => new Promise((done) => {
    let n = 0;
    const mo = new MutationObserver((list) => { n += list.filter((m) => m.attributeName === 'data-t').length; });
    mo.observe(el, { attributes: true });
    setTimeout(() => { mo.disconnect(); done(n); }, 2000);
  }));
  expect(renders).toBeGreaterThan(20);
  expect(renders).toBeLessThanOrEqual(62);
});

test('the beam stops its loop once it has settled, and a new mean starts it again', async ({ page }) => {
  await page.goto('/#station/balance?seed=4&x1=-3&p1=0.2&x2=-1&p2=0.3&x3=1.5&p3=0.4&x4=4&p4=0.1');
  const svg = page.locator('section.beam svg');
  await expect(svg).toBeVisible();
  await page.waitForTimeout(1500);
  const f = await prop(svg, '__frames');
  await page.waitForTimeout(1000);
  expect(await prop(svg, '__frames')).toBe(f);

  await svg.locator('[data-weight="4"] circle').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => prop(svg, '__frames')).toBeGreaterThan(f + 5);
  await page.waitForTimeout(2500);
  const g = await prop(svg, '__frames');
  await page.waitForTimeout(1000);
  expect(await prop(svg, '__frames')).toBe(g);
  await expect(svg.locator('polygon.beam-fulcrum')).toHaveAttribute('data-mean', /.+/);
});
