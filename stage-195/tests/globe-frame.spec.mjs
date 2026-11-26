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

test('paint() at 1920×1080, DPR 1.75 costs the main thread at most half of main', async ({ page }) => {
  test.setTimeout(120_000); // 240 animation frames of a 6.4 MP canvas, slow on a software rasterizer
  await page.goto('/#about');
  const t = await page.evaluate(async (frame) => {
    const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    // The time of the paint() call itself, one call per animation frame on an on-page canvas, as in the app: what the
    // main thread pays per frame. The raster runs later (on the GPU where there is one); no readback per frame.
    // main and the new painter take turns, three rounds each, so a busy moment hits both alike.
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(frame.width * frame.dpr);
    canvas.height = Math.round(frame.height * frame.dpr);
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px;opacity:0.01;pointer-events:none';
    document.body.append(canvas);
    const painters = {
      before: (await import('/tests/fixtures/globe-main/globe.tsx')).earthPlate(canvas),
      after: (await import('/src/globe.tsx')).earthPlate(canvas),
    };
    const times = { before: [], after: [] };
    const round = (key) => new Promise((done) => {
      let i = 0;
      const tick = () => {
        const t0 = performance.now();
        painters[key].draw({ ...frame, time: i * 0.033 });
        if (i >= 10) times[key].push(performance.now() - t0);
        if (++i < 50) requestAnimationFrame(tick); else done();
      };
      requestAnimationFrame(tick);
    });
    for (let r = 0; r < 3; r++) { await round('before'); await round('after'); }
    canvas.remove();
    return { before: median(times.before), after: median(times.after) };
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
      // compared as the eye sees it: each channel premultiplied (as composited) and averaged over 4×4 pixel blocks,
      // then the largest difference of the four channel means. An edge anti-aliased a little differently (one path
      // per tone instead of one fillRect each, GPU or CPU raster) does not count; a moved, missing or recoloured
      // feature does.
      const B = 4, W = 1280, H = 720;
      let off = 0, blocks = 0;
      for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B) {
        const sa = [0, 0, 0, 0], sb = [0, 0, 0, 0];
        for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) {
          const i = (y * W + x) * 4;
          for (let k = 0; k < 3; k++) { sa[k] += (a[i + k] * a[i + 3]) / 255; sb[k] += (b[i + k] * b[i + 3]) / 255; }
          sa[3] += a[i + 3];
          sb[3] += b[i + 3];
        }
        blocks++;
        if (Math.max(...sa.map((v, k) => Math.abs(v - sb[k]))) / (B * B) > 12) off++;
      }
      const share = off / blocks;
      worst = Math.max(worst, share);
    }
    return worst;
  });
  console.log(`globe look: ${(diff * 100).toFixed(3)}% of 4x4 blocks differ`);
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
