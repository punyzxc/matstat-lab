// node --test spikes/lecture-estimation-intervals/kernel.test.mjs
// Issue #46 acceptance criteria, checked against independent references
// (closed forms, Simpson integration of the densities, exact sums) and predeclared Monte Carlo bands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as k from './kernel.mjs';
import { normalQuantile, studentTQuantile, chiSquareQuantile, chiSquareCdf, normalCdf, logGamma } from './special.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const defaults = (station) => Object.fromEntries(k.stations[station].params.map((p) => [p.key, p.default]));

// Independent references: composite Simpson integration of the densities (no incomplete beta or gamma).
function simpson(f, a, b, m = 20000) {
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}
const tDensity = (nu) => (t) => Math.exp(logGamma((nu + 1) / 2) - logGamma(nu / 2) - 0.5 * Math.log(nu * Math.PI) - ((nu + 1) / 2) * Math.log1p((t * t) / nu));
const chiDensity = (nu) => (x) => (x <= 0 ? 0 : Math.exp((nu / 2 - 1) * Math.log(x) - x / 2 - (nu / 2) * Math.LN2 - logGamma(nu / 2)));

// ---------------------------------------------------------------- AC 1: bias of s²
test('AC1: divisor n has bias −σ²/n and divisor n − 1 is unbiased (R = 20 000, 4 SE band)', () => {
  for (const [law, sigma, n, seed] of [[0, 1, 5, 20261124], [0, 2, 10, 46], [1, 1, 5, 7]]) {
    const R = 20000, s2 = sigma ** 2, vn = [], vn1 = [];
    for (let r = 0; r < R; r++) {
      const x = k.sampleOf({ law, mu: 0, sigma, n, seed, stream: 1000 + n, r });
      vn.push(k.variance(x, 'n')); vn1.push(k.variance(x, 'n-1'));
    }
    const th = k.oracles(n, s2, k.LAWS[law].kurtosis);
    for (const [vals, bias, key] of [[vn, -s2 / n, 'var-n'], [vn1, 0, 'var-n-1']]) {
      const m = vals.reduce((a, b) => a + b, 0) / R;
      const se = Math.sqrt(th[key].variance / R);
      close(m - s2, bias, 4 * se, `law ${law} n ${n} ${key} bias`);
    }
  }
});

test('AC1: the Estimation station reports both biases next to their theory', () => {
  const out = k.run({ ...defaults('estimation'), R: 5000 }, { seed: 11, station: 'estimation' });
  const byKey = Object.fromEntries(out.readouts.map((r) => [r.key, r]));
  close(byKey['bias-n'].theory, -1 / 5, 1e-15);
  assert.equal(byKey['bias-n1'].theory, 0);
  const band = (r) => Number(/± ([\d.]+)/.exec(r.convention)[1]);
  close(byKey['bias-n'].observed, byKey['bias-n'].theory, band(byKey['bias-n']), 'station bias n');
  close(byKey['bias-n1'].observed, 0, band(byKey['bias-n1']), 'station bias n-1');
  // For normal data the biased estimator has the smaller MSE: (2n − 1)σ⁴/n² < 2σ⁴/(n − 1).
  close(byKey['mse-n'].theory, 9 / 25, 1e-12);
  close(byKey['mse-n1'].theory, 2 / 4, 1e-12);
});

// ---------------------------------------------------------------- AC 2: quantiles and the L11 example
test('AC2: quantiles are computed and agree with Simpson integration of the densities', () => {
  close(normalQuantile(0.975), 1.959963984540054, 1e-12, 'z 0.975');
  for (const [p, nu] of [[0.975, 21], [0.995, 9], [0.95, 4]]) {
    const q = studentTQuantile(p, nu);
    close(0.5 + simpson(tDensity(nu), 0, q), p, 1e-10, `t ${p} ${nu}`);
  }
  for (const [p, nu] of [[0.975, 21], [0.025, 21], [0.95, 4], [0.05, 1.5 * 2]]) {
    const q = chiSquareQuantile(p, nu);
    // Integrate from a small x₀ to avoid the singular density at 0 for small df; add the head in closed form.
    const x0 = 1e-6, head = Math.exp((nu / 2) * Math.log(x0 / 2) - logGamma(nu / 2 + 1));
    close(head + simpson(chiDensity(nu), x0, q), p, 1e-8, `chi2 ${p} ${nu}`);
    close(chiSquareCdf(q, nu), p, 1e-12);
  }
  // Even df has a closed form: P(χ²₄ ≤ x) = 1 − e^(−x/2)(1 + x/2).
  const q4 = chiSquareQuantile(0.95, 4);
  close(1 - Math.exp(-q4 / 2) * (1 + q4 / 2), 0.95, 1e-12, 'chi2 df 4 closed form');
});

test('AC2: L11 example (22 values, γ = 0.95) gives s² = 0.02799, 2.9576 < M < 3.1060, 0.0166 < D < 0.0572', () => {
  const ex = k.lectureExample(0.95);
  assert.equal(ex.n, 22);
  close(ex.sum, 66.7, 1e-12, 'Σx');
  close(ex.sumSquares, 202.81, 1e-10, 'Σx²');
  // Exact, in tenths: Σ(10x) = 667 and Σ(10x)² = 20281.
  const exact = (20281 - 667 ** 2 / 22) / 21 / 100;
  close(ex.s2, exact, 1e-14, 's² exact');
  assert.equal(ex.s2.toFixed(5), '0.02799');
  assert.notEqual(ex.s2.toFixed(4), String(k.L11_PRINTED.s2), 'the lecture value 0.0303 does not match its data');
  assert.equal(ex.tMean.lower.toFixed(4), '2.9576');
  assert.equal(ex.tMean.upper.toFixed(4), '3.1060');
  assert.equal(ex.chi2Variance.lower.toFixed(4), '0.0166');
  assert.equal(ex.chi2Variance.upper.toFixed(4), '0.0572');
  close(ex.tMean.critical, 2.0796, 5e-5);
  close(ex.chi2Variance.critical[0], 10.283, 5e-4);
  close(ex.chi2Variance.critical[1], 35.479, 5e-4);
});

// ---------------------------------------------------------------- AC 3: coverage
test('AC3: exact methods stay in the band; the approximate method under-covers at small n', () => {
  const R = 4000, gamma = 0.95, { lo, hi } = k.acceptanceBand(R, gamma, 0.001);
  for (const target of ['mean', 'variance']) {
    for (const n of [3, 5, 30]) {
      const [approx, exact] = k.coverageAt({ n, R, gamma, law: 0, mu: 0, sigma: 1, target, seed: 20261124 });
      assert.equal(exact.R, R);
      assert.ok(exact.hits >= lo && exact.hits <= hi, `${target} exact n=${n}: ${exact.hits} not in [${lo}, ${hi}]`);
      if (n <= 5) assert.ok(approx.hits < lo, `${target} approx n=${n}: ${approx.hits} should be below ${lo}`);
    }
  }
});

test('AC3: the station reports hits/R and its Monte Carlo band per method', () => {
  const out = k.run({ ...defaults('confidence'), n: 5, R: 2000 }, { seed: 3, station: 'confidence' });
  const cov = out.readouts.filter((r) => r.key.startsWith('coverage-'));
  assert.equal(cov.length, 2);
  for (const r of cov) {
    assert.equal(r.theory, 0.95);
    assert.match(r.convention, /^\d+\/2000 hits; 99\.9% Monte Carlo band 0\.\d{3}–0\.\d{3}/);
  }
  assert.match(cov[0].convention, /below the band/);
  const band = out.series.find((s) => s.kind === 'band');
  const { lo, hi } = k.acceptanceBand(2000, 0.95, 0.001);
  assert.deepEqual([band.y[0], band.y2[0]], [lo / 2000, hi / 2000]);
});

test('AC3: the acceptance band is the exact binomial region', () => {
  const R = 1000, p = 0.95, { lo, hi } = k.acceptanceBand(R, p, 0.001);
  // Independent: the binomial pmf by the recurrence pmf(k − 1) = pmf(k)·k/(R − k + 1)·(1 − p)/p from pmf(R) = p^R.
  const pmf = new Array(R + 1);
  pmf[R] = Math.pow(p, R);
  for (let i = R; i > 0; i--) pmf[i - 1] = pmf[i] * (i / (R - i + 1)) * ((1 - p) / p);
  const below = pmf.slice(0, lo).reduce((a, b) => a + b, 0), above = pmf.slice(hi + 1).reduce((a, b) => a + b, 0);
  assert.ok(below <= 0.0005 && below + pmf[lo] > 0.0005, `lower tail ${below}`);
  assert.ok(above <= 0.0005 && above + pmf[hi] > 0.0005, `upper tail ${above}`);
});

// ---------------------------------------------------------------- AC 4: homogeneity
test('AC4: formula 139 on the lecture example gives z ≈ −0.447, its p-value and decision', () => {
  const t = k.homogeneityTest(480, 1000, 490, 1000, 0.05);
  const z = -0.01 / Math.sqrt(0.485 * 0.515 * 0.002);
  close(t.z, z, 1e-12);
  assert.equal(t.z.toFixed(3), '-0.447');
  close(t.pValue, 2 * normalCdf(-Math.abs(z)), 1e-15);
  close(t.pValue, 0.6546, 1e-4);
  assert.equal(t.reject, false);
  assert.equal(k.homogeneityTest(300, 1000, 360, 1000, 0.05).reject, true);
  assert.equal(k.homogeneityTest(0, 100, 0, 100).ok, false);
  // Formula 140: the lecture's −1.26 is (0.480 − 0.5)/√(0.25/1000).
  close(k.proportionTest(480, 1000, 0.5).z, -1.2649110640673518, 1e-12);
});

test('AC4: under H₀ the simulated rejection rate stays in the band around α', () => {
  const out = k.run({ ...defaults('homogeneity'), n1: 200, n2: 300, p1: 0.3, p2: 0.3, R: 2000 }, { seed: 99, station: 'homogeneity' });
  const r = out.readouts.find((x) => x.key === 'rejection-rate');
  assert.equal(r.theory, 0.05);
  const { lo, hi } = k.acceptanceBand(2000, 0.05, 0.001);
  const hits = Number(/^(\d+)\//.exec(r.convention)[1]);
  assert.ok(hits >= lo && hits <= hi, `${hits} not in [${lo}, ${hi}]`);
  for (const key of ['z-first', 'p-first', 'decision-first', 'l11-z']) assert.ok(out.readouts.some((x) => x.key === key), key);
});

// ---------------------------------------------------------------- contract
test('contract: every station runs at its defaults and its extremes, deterministically, with finite series', () => {
  for (const station of Object.keys(k.stations)) {
    const params = k.stations[station].params;
    const variants = [defaults(station),
      Object.fromEntries(params.map((p) => [p.key, p.key === 'R' ? p.min : p.min])),
      Object.fromEntries(params.map((p) => [p.key, p.key === 'R' ? p.min : p.max]))];
    for (const v of variants) for (const view of [0, 1, 2]) {
      const pv = 'view' in v ? { ...v, view: Math.min(view, params.find((p) => p.key === 'view').max) } : v;
      const a = k.run(pv, { seed: 5, station }), b = k.run(pv, { seed: 5, station });
      assert.equal(JSON.stringify(a), JSON.stringify(b), `${station} deterministic`);
      assert.ok(a.readouts.length > 0 && a.series.length > 0 && a.notes.length > 0 && a.axes.x && a.axes.y);
      for (const s of a.series) {
        assert.ok(['pmf', 'pdf', 'cdf', 'hist', 'ecdf', 'line', 'points', 'band', 'rule'].includes(s.kind));
        assert.equal(s.x.length, s.y.length, `${station}/${s.id}`);
        assert.ok(s.x.every(Number.isFinite) && s.y.every(Number.isFinite), `${station}/${s.id} finite`);
      }
    }
    assert.notEqual(JSON.stringify(k.run(defaults(station), { seed: 5, station })), JSON.stringify(k.run(defaults(station), { seed: 6, station })));
  }
  assert.deepEqual(k.meta.lectures, ['L11']);
});

test('contract: randomness only from fixtureUint32', () => {
  for (const f of ['kernel.mjs', 'special.mjs']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /Math\.random/);
  }
});
