// Discovery-only checks for #54. Run from this folder: node --test special.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as S from './special.mjs';

const ref = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));
// Acceptance tolerances from the issue: CDFs within 1e-7 absolute, quantiles within 1e-6 relative.
// The spike also records how far below those limits it stays (see worst.* in the last test).
const worst = { cdfAbs: 0, quantileRel: 0 };
const cdfClose = (a, e, label) => { const d = Math.abs(a - e); worst.cdfAbs = Math.max(worst.cdfAbs, d); assert.ok(d <= 1e-7, `${label}: ${a} vs ${e}`); };
const qClose = (a, e, label) => { const d = Math.abs(a - e) / Math.abs(e || 1); worst.quantileRel = Math.max(worst.quantileRel, d); assert.ok(d <= 1e-6, `${label}: ${a} vs ${e}`); };

test('AC1: the module exports every named function and stays pure', () => {
  for (const name of ['normalCdf', 'laplacePhi0', 'erf', 'normalQuantile', 'studentTCdf', 'studentTQuantile', 'chiSquareCdf',
    'chiSquareQuantile', 'fisherCdf', 'fisherQuantile', 'logGamma', 'kolmogorovK', 'kolmogorovQuantile']) {
    assert.equal(typeof S[name], 'function', name);
  }
  const src = readFileSync(new URL('./special.mjs', import.meta.url), 'utf8');
  for (const banned of ['Math.random', 'document', 'window', 'globalThis']) assert.ok(!src.includes(banned), `uses ${banned}`);
});

test('AC1: three normal conventions are distinct and consistent', () => {
  for (const r of ref.normal) {
    cdfClose(S.normalCdf(r.x), r.cdf, `Φ(${r.x})`);
    cdfClose(S.laplacePhi0(r.x), r.phi0, `Φ₀(${r.x})`);
    cdfClose(S.erf(r.x), r.erf, `erf(${r.x})`);
    cdfClose(S.normalCdf(r.x), r.mpCdf, `Φ(${r.x}) vs mpmath`);
  }
  // Φ(x) = 1/2 + Φ₀(x) = (1 + erf(x/√2))/2: the same number under three names, never interchangeable inputs.
  assert.equal(S.laplacePhi0(0), 0);
  assert.ok(Math.abs(S.normalCdf(1.96) - (0.5 + S.laplacePhi0(1.96))) < 1e-15);
  assert.ok(Math.abs(S.laplacePhi0(1.96) - S.erf(1.96 / Math.SQRT2) / 2) < 1e-15);
  assert.ok(Math.abs(S.laplacePhi0(-1) + S.laplacePhi0(1)) === 0, 'Φ₀ is odd');
});

test('AC2: CDFs match SciPy and mpmath within 1e-7 absolute over the documented domain', () => {
  for (const r of ref.tCdf) { cdfClose(S.studentTCdf(r.x, r.df), r.cdf, `t cdf ${JSON.stringify(r)}`); cdfClose(S.studentTCdf(r.x, r.df), r.mp, 't mp'); }
  for (const r of ref.chi2Cdf) { cdfClose(S.chiSquareCdf(r.x, r.df), r.cdf, `chi2 cdf ${JSON.stringify(r)}`); cdfClose(S.chiSquareCdf(r.x, r.df), r.mp, 'chi2 mp'); }
  for (const r of ref.fCdf) { cdfClose(S.fisherCdf(r.x, r.d1, r.d2), r.cdf, `F cdf ${JSON.stringify(r)}`); cdfClose(S.fisherCdf(r.x, r.d1, r.d2), r.mp, 'F mp'); }
  for (const r of ref.kolmogorov) { cdfClose(S.kolmogorovK(r.lam), r.cdf, `K(${r.lam})`); cdfClose(S.kolmogorovK(r.lam), r.mp, `K(${r.lam}) mp`); }
  for (const r of ref.logGamma) qClose(S.logGamma(r.x), r.mp, `logGamma(${r.x})`);
});

test('AC2: quantiles match within 1e-6 relative, including p = 1e-6, 1 − 1e-6 and df = 1, 2', () => {
  for (const r of ref.normalQuantile) qClose(S.normalQuantile(r.p), r.q, `z ${r.p}`);
  for (const r of ref.tQuantile) qClose(S.studentTQuantile(r.p, r.df), r.q, `t ${r.p} df ${r.df}`);
  for (const r of ref.chi2Quantile) qClose(S.chiSquareQuantile(r.p, r.df), r.q, `chi2 ${r.p} df ${r.df}`);
  for (const r of ref.fQuantile) qClose(S.fisherQuantile(r.p, r.d1, r.d2), r.q, `F ${r.p} (${r.d1},${r.d2})`);
  for (const r of ref.kolmogorovQuantile) qClose(S.kolmogorovQuantile(r.p), r.q, `K⁻¹ ${r.p}`);
  // Round trip: quantile then CDF returns p.
  for (const p of ref.probabilities) for (const df of [1, 2, 5, 30]) {
    const q = S.studentTQuantile(p, df);
    assert.ok(Math.abs((p <= 0.5 ? S.studentTCdf(q, df) : S.studentTSf(q, df)) - Math.min(p, 1 - p)) <= 1e-12 * Math.min(p, 1 - p) + 1e-300, `t round trip ${p} ${df}`);
  }
});

test('AC3: lecture values are reproduced at the lecture precision', () => {
  const L = ref.lecture;
  const at = (v, digits) => Number(v.toFixed(digits));
  assert.equal(at(S.chiSquareQuantile(0.975, 21), 3), L.chi2_975_21);
  assert.equal(at(S.chiSquareQuantile(0.025, 21), 3), L.chi2_025_21);
  assert.equal(at(S.studentTQuantile(0.975, 21), 4), L.t_975_21);
  assert.equal(at(S.normalQuantile(0.99), 4), L.z_99);
  assert.equal(at(S.kolmogorovK(1.36), 2), L.K_136);
  // The often-quoted λ for α = 0.05 is 1.358, which rounds to 1.36.
  assert.equal(at(S.kolmogorovQuantile(0.95), 2), 1.36);
});

test('AC4: invalid inputs throw typed errors instead of returning NaN', () => {
  const cases = [
    [() => S.normalQuantile(0), 'PROBABILITY_OUT_OF_RANGE'], [() => S.normalQuantile(1), 'PROBABILITY_OUT_OF_RANGE'],
    [() => S.normalQuantile(NaN), 'INVALID_ARGUMENT'], [() => S.studentTQuantile(1.5, 3), 'PROBABILITY_OUT_OF_RANGE'],
    [() => S.studentTCdf(1, 0), 'INVALID_DF'], [() => S.studentTCdf(1, -2), 'INVALID_DF'], [() => S.studentTCdf(NaN, 3), 'INVALID_ARGUMENT'],
    [() => S.chiSquareCdf(1, NaN), 'INVALID_ARGUMENT'], [() => S.chiSquareQuantile(0.5, 0), 'INVALID_DF'],
    [() => S.fisherCdf(1, 3, 0), 'INVALID_DF'], [() => S.fisherQuantile(0.5, Infinity, 3), 'INVALID_DF'],
    [() => S.kolmogorovQuantile(0), 'PROBABILITY_OUT_OF_RANGE'], [() => S.kolmogorovK(NaN), 'INVALID_ARGUMENT'],
    [() => S.logGamma(0), 'INVALID_ARGUMENT'], [() => S.laplacePhi0('1'), 'INVALID_ARGUMENT'],
  ];
  for (const [fn, code] of cases) assert.throws(fn, (e) => e instanceof S.SpecialFunctionError && e.code === code, code);
  // Infinite arguments are valid limits, not errors.
  assert.deepEqual([S.normalCdf(-Infinity), S.normalCdf(Infinity), S.chiSquareCdf(Infinity, 3), S.kolmogorovK(Infinity)], [0, 1, 1, 1]);
});

test('evidence: worst observed deviations stay far below the acceptance limits', () => {
  console.log(`worst CDF abs error ${worst.cdfAbs.toExponential(2)}, worst quantile rel error ${worst.quantileRel.toExponential(2)}`);
  assert.ok(worst.cdfAbs < 1e-12 && worst.quantileRel < 1e-10);
});
