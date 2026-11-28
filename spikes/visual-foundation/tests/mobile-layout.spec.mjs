import { expect, test } from '@playwright/test';

const stationPaths = [
  '/#station/darts?view=4',
  '/#station/distribution',
  '/#station/clt',
  '/#station/sample',
];

const box = async (locator) => {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds;
};

async function expectPageToFit(page) {
  const { viewport, width } = await page.evaluate(() => ({
    viewport: window.innerWidth,
    width: document.scrollingElement.scrollWidth,
  }));
  expect(width).toBeLessThanOrEqual(viewport);
}

async function expectTapTarget(locator) {
  const { width, height } = await box(locator);
  expect(width).toBeGreaterThanOrEqual(43.5);
  expect(height).toBeGreaterThanOrEqual(43.5);
}

async function swipe(page, target, dx, dy) {
  const { x, y, width, height } = await box(target);
  const client = await page.context().newCDPSession(page);
  const viewport = page.viewportSize();
  const from = {
    x: Math.round(Math.min(viewport.width - 50, Math.max(50, x + width / 2))),
    y: Math.round(Math.min(viewport.height - 70, Math.max(155, y + height / 2))),
  };
  try {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let i = 1; i <= 10; i++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: Math.round(from.x + dx * i / 10), y: Math.round(from.y + dy * i / 10) }],
      });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await client.detach();
  }
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('the scene and one live station per orbit fit and offer reachable touch targets', async ({ page }) => {
  await page.goto('/#orbit/probability');
  const stations = page.locator('.orbit-preview');
  await expect(stations.first()).toBeVisible();
  await expectPageToFit(page);
  for (const station of await stations.all()) await expectTapTarget(station);

  for (const path of stationPaths) {
    await page.goto(path);
    const dock = page.getByTestId('station-dock');
    const close = dock.getByRole('button', { name: /^Close/ });
    await expect(close).toBeInViewport();
    await expectTapTarget(close);
    await expect(dock.getByRole('table', { name: 'Readouts' })).toBeVisible();
    await expectPageToFit(page);
    const scrollBody = dock.locator('.scene-dock-body');
    expect(await scrollBody.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const slider = dock.getByRole('slider').first();
    if (await slider.count()) await expectTapTarget(slider);
  }
});

test('the phone dock fills the viewport and keeps a focused control in view during resize', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(viewport.width > 500, 'A full-screen station overlay is the phone layout.');
  await page.goto('/#station/sample?seed=193');
  const dock = page.getByTestId('station-dock');
  const bounds = await box(dock);
  expect(bounds.x).toBe(0);
  expect(bounds.y).toBe(0);
  expect(bounds.width).toBe(viewport.width);
  expect(bounds.height).toBe(viewport.height);
  const seed = dock.getByRole('textbox', { name: /Random seed/ });
  await seed.focus();
  await page.setViewportSize({ width: viewport.width, height: 405 });
  await expect(seed).toBeInViewport({ ratio: 1 });
  await expect(dock.getByRole('button', { name: /^Close/ })).toBeInViewport();
  await expect(page).toHaveURL(/seed=193/);
});

test('a phone lecture stacks its live figure above the text', async ({ page }) => {
  await page.goto('/#lecture/8/1');
  const story = page.locator('.story');
  const text = await box(story.locator('.story-text'));
  const figure = await box(story.locator('.story-figure'));
  if (page.viewportSize().width <= 500) {
    expect(figure.height).toBeGreaterThanOrEqual(240);
    expect(figure.y + figure.height).toBeLessThanOrEqual(text.y + 1);
  }
  const body = page.getByTestId('lecture-dock').locator('.scene-dock-body');
  expect(await body.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  for (const control of await story.locator('.story-tools :is(button, a), .story-foot button').all()) {
    const { x, width } = await box(control);
    expect(x + width).toBeLessThanOrEqual(page.viewportSize().width);
    await expectTapTarget(control);
  }
  await expectPageToFit(page);
});

test('vertical touch on the globe scrolls without grabbing the horizontal drag', async ({ page }) => {
  await page.goto('/#orbit/probability');
  const globe = page.locator('.orbital-disc .plate-canvas');
  await expect(globe).toBeVisible();
  await expect(globe).toHaveCSS('touch-action', 'pan-y');
  if (page.viewportSize().width <= 500) {
    await swipe(page, globe, 4, -125);
    await expect.poll(() => page.locator('.orbital-field').evaluate((el) => el.scrollTop)).toBeGreaterThan(15);
  }
});

test('the 3D surface and cube allow vertical scrolling and horizontal rotation', async ({ page }) => {
  for (const [path, selector] of [
    ['/#station/scatter?seed=7&rho=0.6', '.surface-svg'],
    ['/#station/darts?seed=3&view=4&dim=3&N=8000', '.board--cube svg'],
  ]) {
    await page.goto(path);
    const body = page.getByTestId('station-dock').locator('.scene-dock-body');
    const target = body.locator(selector).first();
    await target.scrollIntoViewIfNeeded();
    await expect(target).toHaveCSS('touch-action', 'pan-y');
    const yaw = await target.getAttribute('data-yaw');
    const scroll = await body.evaluate((el) => el.scrollTop);
    await swipe(page, target, 4, -85);
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(scroll + 10);
    await expect(target).toHaveAttribute('data-yaw', yaw);
    await target.scrollIntoViewIfNeeded();
    await swipe(page, target, 65, 4);
    await expect(target).not.toHaveAttribute('data-yaw', yaw);
  }
});

test('a station keeps its route and resizes the Earth canvas on device rotation', async ({ page }) => {
  const viewport = page.viewportSize();
  await page.goto('/#station/sample?seed=317');
  await expect(page.getByTestId('station-dock').getByRole('table', { name: 'Readouts' })).toBeVisible();
  const globe = page.locator('.orbital-disc canvas');
  const before = await globe.evaluate((canvas) => [canvas.width, canvas.height]);
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expect.poll(() => globe.evaluate((canvas) => [canvas.width, canvas.height])).not.toEqual(before);
  await expect(page).toHaveURL(/#station\/sample\?seed=317/);
  await expectPageToFit(page);
});
