// node --test spikes/lecture-limit-theorems/kernel.test.mjs
// Issue #41 acceptance criteria, checked against independent references
// (L6's piecewise formulas, Simpson integration, exact sums) and predeclared Monte Carlo bands.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as k from './kernel.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const defaults = (station) => Object.fromEntries(k.stations[station].params.map((p) => [p.key, p.default]));
function simpson(f, a, b, m = 6000) {
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

// ---------------------------------------------------------------- AC 1: convolution of uniforms
test('AC1: the exact density matches L6\'s piecewise formulas for m = 2 and m = 3', () => {
  const tri = (x) => (x < 0 || x > 2 ? 0 : x <= 1 ? x : 2 - x);
  const par = (x) => (x < 0 || x > 3 ? 0 : x <= 1 ? x * x / 2 : x <= 2 ? 1 - (x - 1) ** 2 / 2 - (2 - x) ** 2 / 2 : (3 - x) ** 2 / 2);
  for (let x = -0.5; x <= 3.5; x += 0.01) {
    close(k.irwinHallPdf(x, 2), tri(x), 1e-12, `m = 2 at ${x}`);
    close(k.irwinHallPdf(x, 3), par(x), 1e-12, `m = 3 at ${x}`);
  }
});

test('AC1: the m = 4 density is the convolution of the m = 3 density with U(0, 1), and every density integrates to 1', () => {
  for (const x of [0.3, 1.2, 2, 2.7, 3.6]) close(k.irwinHallPdf(x, 4), simpson((y) => k.irwinHallPdf(y, 3), x - 1, x, 4000), 1e-9, `m = 4 at ${x}`);
  for (let m = 1; m <= 6; m++) {
    close(simpson((x) => k.irwinHallPdf(x, m), 0, m), 1, 1e-6, `∫ f, m = ${m}`);
    for (const x of [0.4, 1.5, m / 2, m - 0.3].filter((x) => x < m)) close(k.irwinHallCdf(x, m), simpson((y) => k.irwinHallPdf(y, m), 0, x), 1e-6, `F = ∫ f, m = ${m}, x = ${x}`);
  }
});

test('AC1: seeded sums agree with the exact law within the predeclared 99.9% Kolmogorov band', () => {
  close(k.KS_LAMBDA, 1.9495, 5e-4, 'λ(0.999)');
  for (const m of [2, 3, 4]) for (const seed of [1, 2048, 20261125]) {
    const R = 5000, D = k.kolmogorovDistance(k.uniformSums(m, R, seed), (x) => k.irwinHallCdf(x, m));
    assert.ok(D <= k.ksBand(R), `m = ${m}, seed ${seed}: D = ${D} > ${k.ksBand(R)}`);
  }
  const r = k.run({ m: 3, R: 5000 }, { seed: 2048, station: 'convolution' });
  assert.match(r.readouts.find((x) => x.key === 'ks').convention, /inside the band/);
  assert.equal(r.series.find((s) => s.id === 'exact').kind, 'pdf');
});

// ---------------------------------------------------------------- AC 2: Chebyshev vs real tails
test('AC2: exact tails next to the Chebyshev bound (normal k = 3: 0.0027, Poisson(1) k = 3: 0.019)', () => {
  close(k.LAWS[0].tail(3), 0.0026998, 1e-6, 'normal');
  close(k.LAWS[3].tail(3), 1 - Math.exp(-1) * (1 + 1 + 1 / 2 + 1 / 6), 1e-12, 'Poisson(1): P(X ≥ 4)');
  close(k.LAWS[3].tail(3), 0.019, 5e-4);
  for (const li of [0, 1, 2, 3]) for (let t = 0.5; t <= 4; t += 0.25) assert.ok(k.LAWS[li].tail(t) <= 1 / (t * t) + 1e-12, `${k.LAWS[li].id} at k = ${t}`);
  const r = k.run({ ...defaults('lln'), law: 0, k: 3, view: 1 }, { seed: 7, station: 'lln' });
  const exact = r.readouts.find((x) => x.key === 'exact'), cheb = r.readouts.find((x) => x.key === 'chebyshev');
  close(exact.theory, 0.0027, 1e-4);
  close(cheb.theory, 1 / 9, 1e-5);
  const se = Math.sqrt(0.0027 * (1 - 0.0027) / 20000);
  close(exact.observed, exact.theory, 4 * se, 'simulated normal tail');
  assert.ok(r.series.some((s) => s.id === 'bound'));
});

test('AC2: a zero tail (uniform, k ≥ √3) gives a readable readout, not a huge ratio', () => {
  const r = k.run({ law: 1, N: 100, k: 2, view: 1 }, { seed: 1, station: 'lln' });
  for (const x of r.readouts) assert.doesNotMatch(String(x.convention), /e\+|Infinity|NaN/);
  assert.equal(r.readouts.find((x) => x.key === 'exact').theory, 0);
});

test('AC2: uniform and exponential tails agree with simulation (4 SE)', () => {
  for (const li of [1, 2]) for (const t of [0.8, 1.5]) {
    const r = k.run({ law: li, N: 100, k: t, view: 1 }, { seed: 11, station: 'lln' });
    const e = r.readouts.find((x) => x.key === 'exact');
    close(e.observed, e.theory, 4 * Math.sqrt(e.theory * (1 - e.theory) / 20000) + 1e-9, `${k.LAWS[li].id} k = ${t}`);
  }
});

// ---------------------------------------------------------------- AC 3: Cauchy
test('AC3: Cauchy running means do not settle, no band is claimed and the note says the expectation does not exist', () => {
  const r = k.run({ law: 4, N: 10000, k: 3, view: 0 }, { seed: 2048, station: 'lln' });
  assert.ok(!r.series.some((s) => s.kind === 'band'), 'no band for Cauchy');
  assert.equal(r.readouts.find((x) => x.key === 'final').theory, 'does not exist');
  assert.ok(r.notes.some((n) => /no expectation/.test(n)));
  // The mean of n Cauchy draws is standard Cauchy for every n: its spread does not shrink.
  const R = 4000, n = 400, means = new Float64Array(R);
  for (let i = 0; i < R; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += k.LAWS[4].draw(99, 1 + 2 * j * 7919, i);
    means[i] = s / n;
  }
  const D = k.kolmogorovDistance(means, (x) => 0.5 + Math.atan(x) / Math.PI);
  assert.ok(D <= k.ksBand(R), `mean of ${n} Cauchy draws is Cauchy: D = ${D}`);
  const cheb = k.run({ law: 4, N: 100, k: 3, view: 1 }, { seed: 1, station: 'lln' });
  assert.ok(!cheb.series.some((s) => s.id === 'bound'), 'no Chebyshev bound for Cauchy');
});

test('AC3 contrast: finite-variance running means stay inside MX ± 3σ/√n at the end', () => {
  for (const li of [0, 1, 2, 3]) {
    const r = k.run({ law: li, N: 10000, k: 3, view: 0 }, { seed: 5, station: 'lln' });
    const band = r.series.find((s) => s.id === 'band');
    const paths = r.series.filter((s) => s.id.startsWith('path'));
    assert.equal(paths.length, 5);
    for (const p of paths) assert.ok(p.y.at(-1) >= band.y.at(-1) && p.y.at(-1) <= band.y2.at(-1), `${k.LAWS[li].id}`);
  }
});

// ---------------------------------------------------------------- AC 4: CLT and the Poisson lemma
test('AC4: the distance of standardized sums to N(0, 1) shrinks as n grows for every finite-variance law', () => {
  for (const law of [0, 1, 2]) {
    const r = k.run({ law, n: 5, R: 8000, view: 1 }, { seed: 2048, station: 'clt' });
    const d = r.series.find((s) => s.id === 'ks').y;
    assert.ok(d.at(-1) < d[0] / 3, `law ${law}: ${d[0]} → ${d.at(-1)}`);
    assert.ok(d.at(-1) < 0.05, `law ${law}: n = 100 distance ${d.at(-1)}`);
  }
  // A normal term is exactly normal for every n: every distance stays inside the noise band.
  const r = k.run({ law: 3, n: 5, R: 8000, view: 1 }, { seed: 3, station: 'clt' });
  for (const d of r.series.find((s) => s.id === 'ks').y) assert.ok(d <= k.ksBand(8000), `normal: ${d}`);
});

test('AC4: Σₖ≤ₙ nᵏe⁻ⁿ/k! is exact and approaches 1/2', () => {
  close(k.poissonLemmaSum(1), 2 / Math.E, 1e-15);
  close(k.poissonLemmaSum(2), Math.exp(-2) * (1 + 2 + 2), 1e-15);
  // Direct summation for moderate n (no overflow below n = 150).
  for (const n of [10, 50, 120]) {
    let t = Math.exp(-n), s = t;
    for (let j = 1; j <= n; j++) { t *= n / j; s += t; }
    close(k.poissonLemmaSum(n), s, 1e-12 * s, `n = ${n}`);
  }
  let prev = Infinity;
  for (const n of [1, 10, 100, 1000, 10000]) {
    const v = k.poissonLemmaSum(n);
    assert.ok(v > 0.5 && v < prev, `monotone down to 1/2 at n = ${n}`);
    if (n >= 10) close(v - 0.5, 2 / (3 * Math.sqrt(2 * Math.PI * n)), 0.02 / Math.sqrt(n) + 1e-3, `Ramanujan term at n = ${n}`);
    prev = v;
  }
  close(k.poissonLemmaSum(10000), 0.5, 0.003);
});

// ---------------------------------------------------------------- contract
test('contract: every station runs at its defaults and its extremes, seeded runs repeat, and series are finite', () => {
  for (const [id, { params }] of Object.entries(k.stations)) {
    const cases = [defaults(id), Object.fromEntries(params.map((p) => [p.key, p.min])), Object.fromEntries(params.map((p) => [p.key, p.max]))];
    const views = params.some((p) => p.key === 'view') ? [0, 1, 2].filter((v) => v <= params.find((p) => p.key === 'view').max) : [undefined];
    for (const base of cases) for (const view of views) {
      const p = view == null ? base : { ...base, view };
      if (id === 'clt' && view === 1 && p.R > 4000) p.R = 4000; // keep the suite quick
      const a = k.run(p, { seed: 42, station: id }), b = k.run(p, { seed: 42, station: id });
      assert.deepEqual(a, b, `${id} ${JSON.stringify(p)} repeats`);
      assert.ok(a.readouts.length && a.series.length && a.notes.length);
      for (const s of a.series) {
        assert.equal(s.x.length, s.y.length, `${id}/${s.id}`);
        for (const v of [...s.x, ...s.y, ...(s.y2 ?? [])]) assert.ok(Number.isFinite(v), `${id}/${s.id} finite`);
      }
    }
  }
  assert.equal(k.meta.id, 'lecture-limit-theorems');
  assert.equal(k.stations.convolution.live, true);
});

test('contract: different seeds give different sums, and the convolution display range is fixed over m', () => {
  assert.notDeepEqual(k.uniformSums(3, 50, 1), k.uniformSums(3, 50, 2));
  const xs = [1, 6].map((m) => k.run({ m, R: 1000 }, { seed: 1, station: 'convolution' }).series.find((s) => s.id === 'hist').x);
  assert.deepEqual(xs[0], xs[1]);
});
