import test from 'node:test';
import assert from 'node:assert/strict';
import { run, lawFor, kolmogorovDistance, binCount, checkText, stations, TYPED } from './kernel.mjs';

const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
const readout = (r, key) => r.readouts.find((x) => x.key === key);

test('the same params and seed give the same sample; another seed gives another', () => {
  const a = run({ law: 0, n: 400 }, { seed: 7 });
  const b = run({ law: 0, n: 400 }, { seed: 7 });
  const c = run({ law: 0, n: 400 }, { seed: 8 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(readout(a, 'mean').observed, readout(c, 'mean').observed);
});

test('built-in laws: x̄ and s² land within a few standard errors of MX and DX', () => {
  const cases = [
    { law: 0, a: 2, sigma: 3 }, { law: 1, lo: -1, hi: 4 }, { law: 2, lambda: 0.5 },
    { law: 3, m: 20, p: 0.3 }, { law: 4, lambda: 4 },
  ];
  for (const q of cases) {
    const n = 20000, r = run({ ...q, n }, { seed: 11 }), L = lawFor({ a: 0, sigma: 1, lo: 0, hi: 1, lambda: 1, m: 10, p: 0.3, ...q });
    const m = readout(r, 'mean'), v = readout(r, 'var');
    assert.equal(m.theory, Number(L.mean.toPrecision(6)));
    assert.ok(Math.abs(m.observed - L.mean) < 4 * Math.sqrt(L.variance / n), `mean of law ${q.law}`);
    assert.ok(Math.abs(v.observed / L.variance - 1) < 0.08, `variance of law ${q.law}`);
  }
});

test('continuous laws: histogram heights are a density (area 1); the pdf and CDF come with the ECDF', () => {
  const r = run({ law: 2, lambda: 1, n: 3000 }, { seed: 3 });
  const hist = r.series.find((s) => s.id === 'hist');
  const h = hist.x[1] - hist.x[0];
  assert.ok(Math.abs(hist.y.reduce((s, y) => s + y * h, 0) - 1) < 1e-3);
  assert.equal(hist.x.length, binCount(3000));
  assert.ok(r.series.some((s) => s.id === 'pdf'));
  assert.deepEqual(r.linked.series.map((s) => s.id).sort(), ['cdf', 'ecdf']);
  assert.equal(run({ law: 2, n: 3000, bins: 12 }, { seed: 3 }).series.find((s) => s.id === 'hist').x.length, 12);
});

test('discrete laws: relative frequencies sum to 1 and the masses sit on the same values', () => {
  const r = run({ law: 3, m: 8, p: 0.4, n: 2000 }, { seed: 5 });
  const hist = r.series.find((s) => s.id === 'hist'), pmf = r.series.find((s) => s.id === 'pdf');
  assert.ok(Math.abs(hist.y.reduce((s, y) => s + y, 0) - 1) < 1e-4);
  assert.deepEqual(pmf.x, hist.x.map((x) => x + 0.5));
});

test('a typed law is a source: discrete and continuous', () => {
  const d = run({ law: TYPED, n: 5000, custom: '0 1 2 | 0.2 0.5 0.3' }, { seed: 2 });
  assert.equal(readout(d, 'mean').theory, 1.1);
  assert.ok(Math.abs(readout(d, 'mean').observed - 1.1) < 0.05);
  const c = run({ law: TYPED, n: 5000, custom: '2x on [0, 1]' }, { seed: 2 });
  assert.ok(Math.abs(readout(c, 'mean').theory - 2 / 3) < 1e-4);
  assert.ok(c.series.some((s) => s.kind === 'pdf'));
  assert.match(checkText('distribution', 'custom', '0 1 | 0.5 0.4').message, /add up to 0.9/);
  assert.equal(checkText('distribution', 'custom', '0 1 | 0.5 0.5'), null);
  assert.equal(stations.distribution.texts[0].when.law[0], TYPED);
});

test('the Kolmogorov distance: below its 99.9% band for the true law, far above it for a wrong one', () => {
  const r = run({ law: 0, n: 2000 }, { seed: 9 });
  const ks = readout(r, 'ks');
  assert.ok(ks.observed < 1.95 / Math.sqrt(2000));
  const sorted = Float64Array.from({ length: 1000 }, (_, i) => (i + 0.5) / 1000);
  assert.ok(Math.abs(kolmogorovDistance(sorted, (x) => Math.min(1, Math.max(0, x)))) < 1e-3);
  assert.ok(kolmogorovDistance(sorted, (x) => Math.min(1, Math.max(0, x * x))) > 0.2);
  // A discrete law uses F(x−) on the lower side: a perfect sample of a fair coin has distance 0.
  const coin = lawFor({ law: TYPED, custom: '0 1 | 0.5 0.5' });
  assert.equal(kolmogorovDistance(Float64Array.from([0, 0, 1, 1]), coin.cdf), 0);
});

test('the formula shows x̄ next to MX and s² next to DX; a bad n is refused', () => {
  const r = run({ law: 1, lo: 0, hi: 2, n: 100 }, { seed: 1 });
  assert.match(r.formula[1], /\\bar\{x\}.*MX = 1/);
  assert.match(r.formula[2], /s\^2.*DX = 0\.3333/);
  assert.throws(() => run({ n: 1 }), /n must be/);
  assert.throws(() => run({ law: 1, lo: 1, hi: 1 }), /right end/);
  assert.ok(mean([1, 2, 3]) === 2);
});
