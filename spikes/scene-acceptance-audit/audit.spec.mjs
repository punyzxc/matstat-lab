import { test, expect } from '../visual-foundation/node_modules/@playwright/test/index.mjs';

// Independent explicit inventory: do not import the host's router, kernels or tests.
const groups = {
  probability: ['urn', 'frequency', 'darts', 'bayes', 'bernoulli'],
  variables: ['distribution', 'moments', 'transform', 'scatter'],
  limits: ['convolution', 'convergence', 'lln', 'clt'],
  statistics: ['sample', 'fit', 'estimation', 'confidence', 'testing', 'homogeneity'],
};
const hidden = ['randomness', 'contract-fixture'];
const routes = [
  ...Object.keys(groups).map(id => `#orbit/${id}`),
  ...[...Object.values(groups).flat(), ...hidden].map(id => `#station/${id}`), '#notes', '#record',
];
const orbitNav = page => page.getByRole('navigation', { name: 'Lecture orbits' });

test.beforeAll(async ({ browser }, info) => {
  await info.attach('runtime.json', { body: JSON.stringify({ browser: browser.version(), node: process.version,
    platform: process.platform, channel: process.env.AUDIT_BROWSER ?? 'msedge', port: process.env.PORT ?? '4196' }), contentType: 'application/json' });
});

async function ready(page, route) {
  await page.goto('/' + route);
  await expect(orbitNav(page)).toBeVisible();
  if (route.startsWith('#station/')) {
    await expect(page.getByTestId('station-dock')).toBeVisible();
    await expect(page.getByTestId('station-dock')).not.toContainText(/Loading the .* kernel|Running the first experiment/);
  }
  if (route === '#notes' || route === '#record')
    await expect(page.getByTestId(`drawer-${route.slice(1)}`)).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); });
}

for (const [width, height] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
  test(`all 27 routes fit and preserve scene at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const observations = [];
    for (const route of routes) {
      await ready(page, route);
      await expect.soft(page.getByRole('img', { name: /Earth point cloud/ }), route).toBeVisible();
      const geometry = await page.evaluate(() => {
        const root = document.scrollingElement;
        const overflow = [];
        for (const el of document.body.querySelectorAll('*')) {
          if (!(el instanceof HTMLElement) || el.closest('svg, .katex-mathml, [aria-hidden="true"]')) continue;
          const style = getComputedStyle(el), box = el.getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || !box.width || !box.height) continue;
          // Clip to intentional internal panels, but not html/body: root overflow:hidden
          // must not conceal a layout defect from this audit.
          let left = box.left, right = box.right, top = box.top, bottom = box.bottom;
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const ps = getComputedStyle(p), pb = p.getBoundingClientRect();
            if (/hidden|clip|auto|scroll/.test(ps.overflowX)) { left = Math.max(left, pb.left); right = Math.min(right, pb.right); }
            if (/hidden|clip|auto|scroll/.test(ps.overflowY)) { top = Math.max(top, pb.top); bottom = Math.min(bottom, pb.bottom); }
          }
          if (right > left && bottom > top && (left < -1 || right > innerWidth + 1))
            overflow.push({ tag: el.tagName, id: el.id, class: String(el.className).slice(0, 100), left, right });
        }
        window.scrollTo(100, 100);
        return { width: innerWidth, height: innerHeight, scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight,
          scrollX, scrollY, overflow };
      });
      observations.push({ route, ...geometry,
        pendingKernel: await page.locator('.station-pending').count(),
        stationAlerts: await page.getByTestId('station-dock').getByRole('alert').allTextContents(),
      });
      if (route === '#station/contract-fixture' && width === 1280)
        await info.attach('fixture-at-1280.png', { body: await page.screenshot(), contentType: 'image/png' });
      expect.soft(geometry.scrollHeight, route).toBeLessThanOrEqual(height);
      expect.soft(geometry.scrollWidth, route).toBeLessThanOrEqual(width);
      expect.soft([geometry.scrollX, geometry.scrollY], route).toEqual([0, 0]);
      expect.soft(geometry.overflow, route).toEqual([]);
    }
    await info.attach('geometry.json', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
  });
}

for (const [orbit, ids] of Object.entries(groups)) {
  test(`keyboard opens every visible station of ${orbit} and returns to its opener`, async ({ page }) => {
    await ready(page, `#orbit/${orbit}`);
    const links = page.locator('.orbital-nodes a[href*="#station/"]');
    await expect(links).toHaveCount(ids.length);
    for (const id of ids) {
      const card = page.locator(`.orbital-nodes a[href="#station/${id}"]`);
      await expect(card).toHaveCount(1);
      // Reach the real opener with Tab, never focus() or mouse input.
      for (let n = 0; n < 100 && !(await card.evaluate(el => el === document.activeElement)); n++)
        await page.keyboard.press('Tab');
      await expect(card).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('station-dock')).toBeVisible();
      await expect.soft(page.locator('#dock-title'), id).toBeFocused();
      await expect.soft(page.locator('.orbital-nodes'), id).toHaveAttribute('inert', '');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('station-dock')).toHaveCount(0);
      await expect.soft(card, id).toBeFocused();
    }
  });
}

for (const id of hidden) test(`hidden ${id} deep link has a focused dock and closes with Escape`, async ({ page }) => {
  await ready(page, `#station/${id}`);
  await expect(page.locator('#dock-title')).toBeFocused();
  await expect(page.locator('.orbital-nodes')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('station-dock')).toHaveCount(0);
  await expect(orbitNav(page)).toBeVisible();
});

for (const [seed, n, p] of [[0, 100, 0], [17, 2000, 0.3], [4294967295, 5000, 1]]) {
  test(`fresh isolated context replays fixture seed=${seed} n=${n} p=${p}`, async ({ page, browser, baseURL }, info) => {
    const route = `#station/contract-fixture?seed=${seed}&n=${n}&p=${p}`;
    await ready(page, route);
    const rows = page.getByTestId('station-dock').getByRole('row');
    await expect(rows.filter({ hasText: 'Relative frequency' })).toHaveCount(1);
    const original = await rows.allTextContents();
    const fresh = await browser.newContext({ baseURL, reducedMotion: 'reduce', storageState: { cookies: [], origins: [
      { origin: baseURL, localStorage: [{ name: 'statum-lab:lang', value: 'en' }] },
    ] } });
    try {
      const other = await fresh.newPage();
      await ready(other, route);
      await expect(other.getByTestId('station-dock').getByRole('row')).toHaveText(original);
      await expect(other.getByLabel('Random seed')).toHaveValue(String(seed));
      await expect(other.getByLabel('Trials n', { exact: true })).toHaveValue(String(n));
      await info.attach('replayed-readouts.json', { body: JSON.stringify({ route, original, replay: await other.getByTestId('station-dock').getByRole('row').allTextContents() }, null, 2), contentType: 'application/json' });
    } finally { await fresh.close(); }
  });
}

test('malformed percent escapes, unknown IDs and invalid seeds do not blank the scene', async ({ page }, info) => {
  const cases = ['#station/%E0%A4%A', '#orbit/no-such-orbit', '#station/no-such-station', '#station/%',
    ...['%E0', '-1', '4294967296', '1.5', '1e3', ''].map(seed => `#station/contract-fixture?seed=${seed}`)];
  const records = [];
  for (const route of cases) {
    const errors = [];
    const handler = err => errors.push(err.message);
    page.on('pageerror', handler);
    await page.goto('/' + route);
    await expect(orbitNav(page)).toBeVisible();
    await expect(page.getByRole('img', { name: /Earth point cloud/ })).toBeVisible();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    page.off('pageerror', handler);
    expect.soft(errors, route).toEqual([]);
    records.push({ input: route, renderedURL: page.url(), uncaughtErrors: errors });
  }
  await info.attach('malformed-routes.json', { body: JSON.stringify(records, null, 2), contentType: 'application/json' });
});
