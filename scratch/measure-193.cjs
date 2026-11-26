// #193 measurement (not part of any PR). Run from spikes/visual-foundation with the dev server on PORT:
//   node measure-193.cjs 4175
// Prints the median frame time (ms) over 5 s with a station and with a lecture open, CPU 4x, real Chrome.
const { chromium } = require('@playwright/test');
const port = process.argv[2] || '4175';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const out = {};
  for (const [name, hash] of [['station (bayes, autoplay)', '/#station/bayes?seed=17&p=0.25'], ['station (bernoulli)', '/#station/bernoulli?seed=3&view=0'], ['lecture L8', '/#lecture/8/1']]) {
    const med = [];
    for (let r = 0; r < 3; r++) {
      const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await page.goto(`http://127.0.0.1:${port}${hash}`);
      await page.waitForTimeout(2500);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.waitForTimeout(500);
      const gaps = await page.evaluate(() => new Promise((done) => {
        const g = []; let last = 0; const end = performance.now() + 5000;
        const f = (t) => { if (last) g.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else done(g); };
        requestAnimationFrame(f);
      }));
      gaps.sort((a, c) => a - c);
      med.push(+gaps[Math.floor(gaps.length / 2)].toFixed(1));
      await ctx.close();
    }
    out[name] = med;
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
