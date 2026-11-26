// #195 variant benchmark (not part of any PR). Copy A.tsx, B.tsx, C.tsx into spikes/visual-foundation/tests/fixtures/globe-variants/,
// start the dev server of the #195 worktree on PORT, then from spikes/visual-foundation: node bench-195.cjs 4175
const { chromium } = require('@playwright/test');
const port = process.argv[2] || '4175';
const variants = { main: '/tests/fixtures/globe-main/globe.tsx', A_gradients: '/tests/fixtures/globe-variants/A.tsx', B_batched: '/tests/fixtures/globe-variants/B.tsx', C_sprites: '/tests/fixtures/globe-variants/C.tsx' };
(async () => {
  for (const headless of [true, false]) {
    const b = await chromium.launch({ channel: 'chrome', headless });
    const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${port}/#about`);
    const res = await page.evaluate(async (variants) => {
      const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
      const gpu = (() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; })();
      const out = { gpu };
      for (const [name, path] of Object.entries(variants)) {
        const { earthPlate } = await import(path);
        // a fresh canvas per mode, so a readback in one mode cannot demote the canvas of the other
        const make = () => { const c = document.createElement('canvas'); c.width = 3360; c.height = 1890; document.body.append(c); c.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px;opacity:0.01;pointer-events:none'; return c; };
        const f = (i) => ({ width: 1920, height: 1080, dpr: 1.75, time: i * 0.033, yaw: 0, mesh: false, cue: 0 });
        // mode 1: paint() call time only (what the main thread pays), 60 frames, one flush at the end
        let c = make(); let p = earthPlate(c); const calls = [];
        for (let i = 0; i < 65; i++) { const t0 = performance.now(); p.draw(f(i)); if (i >= 5) calls.push(performance.now() - t0); }
        c.remove();
        // mode 2: real frames: one paint per animation frame, time between frames
        c = make(); p = earthPlate(c);
        const gaps = await new Promise((done) => { const g = []; let last = 0, i = 0; const tick = (t) => { p.draw(f(i)); if (last && i > 5) g.push(t - last); last = t; if (++i < 70) requestAnimationFrame(tick); else done(g); }; requestAnimationFrame(tick); });
        c.remove();
        out[name] = { callMs: +median(calls).toFixed(2), frameMs: +median(gaps).toFixed(2) };
      }
      return out;
    }, variants);
    console.log(headless ? 'headless' : 'headed', JSON.stringify(res));
    await b.close();
  }
})();
