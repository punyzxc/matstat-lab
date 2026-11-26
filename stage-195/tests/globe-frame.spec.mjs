import { expect, test } from '@playwright/test';

// #195: a cheaper Earth frame. `tests/fixtures/globe-main/` is a frozen copy of the painter from main before this
// change; both are loaded through the dev server and drawn on the same canvas sizes.
const FRAME = { width: 1920, height: 1080, dpr: 1.75, yaw: 0, mesh: false, cue: 0 };

test('static layers make no gradients after the first frame', async ({ page }) => {
  await page.goto('/#about');
  const calls = await page.evaluate(async (frame) => {
    const { earthPlate } = await import('/src/globe.tsx');
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(frame.width * frame.dpr);
    canvas.height = Math.round(frame.height * frame.dpr);
    const plate = earthPlate(canvas);
    // every 2D context counts, the painter's own and any offscreen sprite it makes
    let n = 0;
    for (const name of ['createRadialGradient', 'createLinearGradient', 'createConicGradient']) {
      const f = CanvasRenderingContext2D.prototype[name];
      CanvasRenderingContext2D.prototype[name] = function (...a) { n++; return f.apply(this, a); };
    }
    plate.draw({ ...frame, time: 0 });
    const first = n;
    for (let i = 1; i <= 20; i++) plate.draw({ ...frame, time: i * 0.033 });
    return { first, later: n - first };
  }, FRAME);
  expect(calls.later).toBe(0);
  expect(calls.first).toBeGreaterThan(0);
});

test('one frame at 1920×1080, DPR 1.75 takes at most half the time of main', async ({ page }) => {
  await page.goto('/#about');
  const t = await page.evaluate(async (frame) => {
    const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const bench = async (path) => {
      const { earthPlate } = await import(path);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(frame.width * frame.dpr);
      canvas.height = Math.round(frame.height * frame.dpr);
      const plate = earthPlate(canvas);
      const ctx = canvas.getContext('2d');
      const times = [];
      for (let i = 0; i < 45; i++) {
        const t0 = performance.now();
        plate.draw({ ...frame, time: i * 0.033 });
        ctx.getImageData(0, 0, 1, 1); // wait for the drawing to finish
        if (i >= 5) times.push(performance.now() - t0);
      }
      return median(times);
    };
    const before = await bench('/tests/fixtures/globe-main/globe.tsx');
    const after = await bench('/src/globe.tsx');
    return { before, after };
  }, FRAME);
  console.log(`globe paint() median at 1920x1080 DPR 1.75: main ${t.before.toFixed(2)} ms, now ${t.after.toFixed(2)} ms`);
  expect(t.after).toBeLessThanOrEqual(0.5 * t.before);
});

test('the globe looks the same as on main', async ({ page }) => {
  await page.goto('/#about');
  const diff = await page.evaluate(async () => {
    const draw = async (path, time, yaw) => {
      const { earthPlate } = await import(path);
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      earthPlate(canvas).draw({ width: 1280, height: 720, dpr: 1, time, yaw, mesh: false, cue: 0 });
      return canvas.getContext('2d').getImageData(0, 0, 1280, 720).data;
    };
    let worst = 0;
    for (const [time, yaw] of [[0, 0], [7.3, 1.1], [19, -2.4]]) {
      const a = await draw('/tests/fixtures/globe-main/globe.tsx', time, yaw);
      const b = await draw('/src/globe.tsx', time, yaw);
      // compared premultiplied, as the pixels are composited: the colour of a nearly transparent pixel does not show
      let off = 0;
      for (let i = 0; i < a.length; i += 4) {
        let d = Math.abs(a[i + 3] - b[i + 3]);
        for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs((a[i + k] * a[i + 3]) / 255 - (b[i + k] * b[i + 3]) / 255));
        if (d > 24) off++;
      }
      worst = Math.max(worst, off / (a.length / 4));
    }
    return worst;
  });
  // sprites land on whole device pixels: edges may move by half a pixel
  expect(diff).toBeLessThan(0.005);
});

test('the globe backing store stays under 2.5 megapixels on a 1920×1080 screen at DPR 1.75', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.75 });
  const page = await context.newPage();
  await page.goto('/');
  const canvas = page.locator('.orbital-disc canvas');
  await expect(canvas).toBeVisible();
  const size = await canvas.evaluate((el) => ({ w: el.width, h: el.height, css: el.getBoundingClientRect().width }));
  expect(size.w * size.h).toBeLessThanOrEqual(2_500_000);
  expect(size.w / size.css).toBeGreaterThanOrEqual(1); // never below one device pixel per CSS pixel here
  await context.close();
});

test('the trefoil WebGL context does not keep its drawing buffer', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    window.__webgl = [];
    HTMLCanvasElement.prototype.getContext = function (kind, options, ...rest) {
      if (kind === 'webgl2') window.__webgl.push(options ?? {});
      return getContext.call(this, kind, options, ...rest);
    };
  });
  await page.goto('/#record');
  await expect(page.getByText('Geometric study · Trefoil')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__webgl.length)).toBeGreaterThan(0);
  const opts = await page.evaluate(() => window.__webgl);
  for (const o of opts) expect(o.preserveDrawingBuffer ?? false).toBe(false);
});
