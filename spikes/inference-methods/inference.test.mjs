import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mulberry32, normalSampler, mean, variance, oracles, normalQuantile, normalCdf,
  studentTCdf, studentTQuantile, zInterval, tInterval, acceptanceBand, coverage, binomialPmf, signTest,
} from './inference.mjs';

const near = (got, want, tol, msg) => assert.ok(Math.abs(got - want) <= tol, `${msg ?? ''} got ${got}, want ${want} ±${tol}`);

// Reference values are listed, with their provenance, in docs/research/inference-methods.md.
test('normal quantile and CDF match SciPy references', () => {
  near(normalQuantile(0.975), 1.959963984540054, 1e-12);
  near(normalQuantile(0.995), 2.5758293035489004, 1e-12);
  near(normalQuantile(0.001), -3.090232306167813, 1e-11);
  near(normalCdf(1), 0.8413447460685429, 1e-14);
  near(normalCdf(-4), 3.167124183311992e-05, 1e-15);
});

test('Student t quantile and CDF match SciPy references', () => {
  near(studentTQuantile(0.975, 1), 12.706204736174698, 1e-9);
  near(studentTQuantile(0.975, 4), 2.7764451051977987, 1e-10);
  near(studentTQuantile(0.975, 9), 2.2621571627409915, 1e-10);
  near(studentTQuantile(0.975, 29), 2.045229642132703, 1e-10);
  near(studentTQuantile(0.995, 9), 3.249835541592118, 1e-12); // closed-form odd-df CDF, see the research note
  near(studentTCdf(2, 5), 0.9490302605850709, 1e-12);
});

test('variance divisors are explicit and n-1 is undefined at n = 1', () => {
  const x = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.equal(variance(x, 'n'), 4);
  near(variance(x, 'n-1'), 32 / 7, 1e-15);
  assert.equal(variance([3], 'n'), 0);
  assert.ok(Number.isNaN(variance([3], 'n-1')));
  assert.throws(() => variance(x, 'n+1'), RangeError);
});

test('analytic oracles for Normal(sigma2 = 4), n = 5', () => {
  const o = oracles(5, 4);
  assert.deepEqual(o.mean, { bias: 0, variance: 0.8, mse: 0.8 });
  assert.equal(o['var-n-1'].bias, 0);
  assert.equal(o['var-n-1'].variance, 8); // 2 sigma^4 / (n-1)
  near(o['var-n'].bias, -0.8, 1e-15); // -sigma^2 / n
  near(o['var-n'].mse, (2 * 5 - 1) * 16 / 25, 1e-12); // (2n-1) sigma^4 / n^2
  assert.ok(o['var-n'].mse < o['var-n-1'].mse); // biased estimator has smaller MSE for Normal
  assert.equal(oracles(1, 4)['var-n-1'], null);
});

// Predeclared: R = 20000 fixed replicates, seed 20261123, accept within 4 Monte Carlo SE.
function mcCheck(draw, sigma2, kappa, n, seed) {
  const R = 20000, rand = mulberry32(seed), sample = draw(rand);
  const est = { mean: [], 'var-n-1': [], 'var-n': [] };
  for (let r = 0; r < R; r++) {
    const x = Array.from({ length: n }, sample);
    est.mean.push(mean(x));
    est['var-n-1'].push(variance(x, 'n-1'));
    est['var-n'].push(variance(x, 'n'));
  }
  const truth = { mean: draw.mu, 'var-n-1': sigma2, 'var-n': sigma2 };
  const o = oracles(n, sigma2, kappa);
  for (const k of Object.keys(est)) {
    const bias = mean(est[k]) - truth[k];
    near(bias, o[k].bias, 4 * Math.sqrt(o[k].variance / R), `${k} bias`);
    // Variance of the estimator: SE of a sample variance is sqrt((m4 - v^2) / R),
    // with the fourth central moment m4 estimated from the same replicates.
    const m = mean(est[k]), dev = est[k].map(e => (e - m) ** 2);
    const v = mean(dev), m4 = mean(dev.map(d => d * d));
    near(v, o[k].variance, 4 * Math.sqrt((m4 - v * v) / R), `${k} variance`);
    // MSE = mean squared error around the known target, same predeclared band.
    const se2 = est[k].map(e => (e - truth[k]) ** 2), mse = mean(se2);
    near(mse, o[k].mse, 4 * Math.sqrt(variance(se2, 'n') / R), `${k} MSE`);
  }
}
test('Monte Carlo bias agrees with the Normal oracle (fixed seed)', () => {
  const draw = rand => { const z = normalSampler(rand); return () => 1 + 2 * z(); };
  draw.mu = 1;
  mcCheck(draw, 4, 0, 5, 20261123);
});
test('Monte Carlo bias agrees with the oracle for Exponential(rate 1), excess kurtosis 6', () => {
  const draw = rand => () => -Math.log(1 - rand());
  draw.mu = 1;
  mcCheck(draw, 1, 6, 5, 20261124);
});

test('z and t intervals reproduce a hand-computed case', () => {
  const x = [4.8, 5.1, 5.3, 4.9, 5.4];
  const z = zInterval(x, { sigma: 0.25, level: 0.95 });
  near(z.estimate, 5.1, 1e-12);
  near(z.upper - z.estimate, 1.959963984540054 * 0.25 / Math.sqrt(5), 1e-12);
  const t = tInterval(x, { level: 0.95 });
  near(t.upper - t.estimate, 2.7764451051977987 * Math.sqrt(0.065) / Math.sqrt(5), 1e-9);
  assert.equal(t.df, 4);
});

test('applicability failures are typed, not thrown', () => {
  assert.equal(tInterval([1]).code, 'n-too-small');
  assert.equal(tInterval([]).code, 'n-too-small');
  assert.equal(tInterval([2, 2, 2]).code, 'zero-sample-variance');
  assert.equal(tInterval([1, NaN]).code, 'non-finite-data');
  assert.equal(tInterval([1, 2], { level: 1 }).code, 'level-out-of-range');
  assert.equal(zInterval([1], { sigma: 0 }).code, 'sigma-not-positive');
  assert.equal(zInterval([1], { sigma: 1 }).ok, true); // z works at n = 1
});

test('acceptance band is exact: each tail is at most alpha/2 and maximal', () => {
  const R = 2000, p = 0.95, { lo, hi } = acceptanceBand(R, p, 0.001);
  let low = 0; for (let k = 0; k < lo; k++) low += binomialPmf(k, R, p);
  let up = 0; for (let k = hi + 1; k <= R; k++) up += binomialPmf(k, R, p);
  assert.ok(low <= 0.0005 && low + binomialPmf(lo, R, p) > 0.0005);
  assert.ok(up <= 0.0005 && up + binomialPmf(hi, R, p) > 0.0005);
  assert.deepEqual([lo, hi], [1867, 1931]); // mean 1900, SD 9.75
});

const normalDraw = rand => { const z = normalSampler(rand); return () => 10 + 3 * z(); };
const band = acceptanceBand(2000, 0.95, 0.001);
for (const [method, n] of [['z', 1], ['z', 5], ['t', 2], ['t', 5], ['t', 30]]) {
  test(`coverage of the ${method} interval at n = ${n} is inside the predeclared band`, () => {
    const c = coverage({ method, n, R: 2000, seed: (method === 'z' ? 1000 : 2000) + n, mu: 10, sigma: 3, draw: normalDraw });
    assert.equal(c.failures, 0);
    assert.ok(c.hits >= band.lo && c.hits <= band.hi, `hits ${c.hits} outside [${band.lo}, ${band.hi}]`);
  });
}

test('limitation: the t interval under-covers skewed Exponential data at n = 5', () => {
  const draw = rand => () => -Math.log(1 - rand());
  const c = coverage({ method: 't', n: 5, R: 2000, seed: 77, mu: 1, draw });
  assert.ok(c.hits < band.lo, `hits ${c.hits} should fall below ${band.lo}`);
});

test('exact sign test reference: 8 above and 2 below gives p = 112/1024', () => {
  const r = signTest([1, 2, 3, 4, 5, 6, 7, 8, -1, -2, 0], 0);
  assert.equal(r.ties, 1);
  near(r.pValue, 112 / 1024, 1e-14);
  assert.equal(signTest([0, 0], 0).code, 'all-ties');
});

// Regressions from an independent check of the first draft.
test('t quantile has no hidden cap and is exactly 0 at the median', () => {
  near(studentTQuantile(0.9997, 1), 1061.0329, 1e-3); // tan(pi * (p - 1/2)) for df = 1
  near(studentTQuantile(1 - 1e-10, 1) / Math.tan(Math.PI * (0.5 - 1e-10)), 1, 1e-6);
  assert.equal(studentTQuantile(0.5, 1), 0);
  near(studentTQuantile(0.975, 1000), 1.9623390808264078, 1e-9);
  near(normalQuantile(1 - 1e-10), 6.361340902404056, 1e-6);
});

test('degenerate inputs return typed failures instead of wrong numbers or exceptions', () => {
  assert.equal(zInterval([1]).code, 'sigma-not-positive');
  assert.equal(tInterval([1e200, -1e200]).code, 'non-finite-result');
  const narrow = tInterval([1, 2], { level: 1e-17 });
  assert.ok(narrow.ok && narrow.lower <= narrow.upper);
  assert.equal(coverage({ method: 't', n: 1, R: 10, seed: 1, mu: 0, draw: normalDraw }).code, 'no-valid-replicates');
  assert.equal(coverage({ method: 'z', n: 3, R: 0, seed: 1, mu: 0, draw: normalDraw }).code, 'invalid-repetitions');
  assert.equal(signTest([NaN, 1, 2], 0).code, 'non-finite-data');
});

test('sign test p-values are exact', () => {
  assert.equal(signTest([1, 2, 3, 4, 5], 0).pValue, 0.0625);
  assert.equal(signTest([1, -1], 0).pValue, 1);
});
