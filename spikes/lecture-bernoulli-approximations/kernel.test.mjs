// node --test spikes/lecture-bernoulli-approximations/kernel.test.mjs
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  meta, stations, run, EXAMPLES, BAND_Z, binomialPmf, binomialLogPmf, binomialInterval, mostProbable,
  localApprox, integralApprox, poissonPmf, sampleSize,
} from './kernel.mjs';

// ---------- independent reference: exact rational arithmetic with BigInt ----------
// p = a/b, P(k) = C(n,k) a^k (b−a)^(n−k) / b^n. Returns a Number after an exact integer division
// scaled by 10^40, so the reference has far more digits than a double.
function exactBinomial(n, a, b, k1, k2) {
  const N = BigInt(n), A = BigInt(a), B = BigInt(b), C = B - A;
  let num = 0n, binom = 1n;
  for (let k = 0n; k <= N; k++) {
    if (k > 0n) binom = (binom * (N - k + 1n)) / k;
    if (k >= BigInt(k1) && k <= BigInt(k2)) num += binom * A ** k * C ** (N - k);
  }
  const scale = 10n ** 40n;
  return Number((num * scale) / B ** N) / 1e40;
}
const close = (a, b, eps, label = '') => assert.ok(Math.abs(a - b) <= eps, `${label} ${a} vs ${b}`);
const byKey = (out) => Object.fromEntries(out.readouts.map((r) => [r.key, r]));

test('contract shape: meta, params, station, series kinds, labelled axes', () => {
  assert.equal(meta.id, 'lecture-bernoulli-approximations');
  assert.deepEqual(meta.lectures, ['L3', 'L9']);
  assert.ok(stations.bernoulli, 'catalog station id is bernoulli');
  for (const p of meta.params) assert.ok(p.min <= p.default && p.default <= p.max && p.step > 0, p.key);
  const kinds = new Set(['pmf', 'pdf', 'cdf', 'hist', 'ecdf', 'line', 'points', 'band', 'rule']);
  for (const prm of [{ view: 1 }, { view: 1, example: 0 }, { view: 2 }]) {
    const out = run(prm, { seed: 7 });
    for (const s of out.series) { assert.ok(kinds.has(s.kind), s.kind); assert.equal(s.x.length, s.y.length, s.id); }
    assert.ok(out.axes.x && out.axes.y && out.notes.length > 0);
  }
});

test('determinism: same params and seed give byte-identical JSON; a new seed changes the simulation', () => {
  const a = JSON.stringify(run({ example: 3 }, { seed: 99 }));
  assert.equal(a, JSON.stringify(run({ example: 3 }, { seed: 99 })));
  assert.notEqual(a, JSON.stringify(run({ example: 3 }, { seed: 100 })));
  const src = readFileSync(new URL('./kernel.mjs', import.meta.url), 'utf8');
  assert.ok(!src.includes('Math.random'), 'no Math.random');
});

test('AC1: the PMF is computed in log space and sums to 1 within 1e-12 for n ≤ 10⁴', () => {
  for (const n of [1, 2, 10, 137, 1000, 5000, 10000]) {
    for (const p of [0, 0.001, 0.01, 0.3, 0.5, 0.75, 0.999, 1]) {
      const pmf = binomialPmf(n, p);
      const sorted = Array.from(pmf).sort((x, y) => x - y);
      let s = 0; for (const t of sorted) s += t;
      assert.ok(Math.abs(s - 1) <= 1e-12, `n=${n} p=${p}: sum ${s}`);
    }
  }
  // Log space: a far tail that underflows in linear space is still a finite log.
  assert.ok(Number.isFinite(binomialLogPmf(10000, 0.5, 0)) && binomialLogPmf(10000, 0.5, 0) < -6900);
  // Against exact rationals on small and lecture-sized cases.
  close(binomialPmf(7, 0.75)[5], exactBinomial(7, 3, 4, 5, 5), 1e-15, 'P7(5)');
  close(binomialPmf(10, 0.3)[3], exactBinomial(10, 3, 10, 3, 3), 1e-15, 'P10(3)');
});

test('AC1: the most probable number follows formula (13), including the two-mode case', () => {
  const argmax = (pmf) => { const m = Math.max(...pmf); return [...pmf.keys()].filter((k) => Math.abs(pmf[k] - m) <= 1e-12 * m); };
  const cases = [[7, 0.75], [9, 0.5], [5000, 0.01], [10, 0.3], [99, 0.01], [200, 0.6], [15000, 0.04], [1, 0.5], [3, 0.25], [50, 0.2], [20, 0.123]];
  for (const [n, p] of cases) {
    const m = mostProbable(n, p);
    assert.deepEqual(m.modes, argmax(binomialPmf(n, p)), `n=${n} p=${p}`);
  }
  assert.deepEqual(mostProbable(7, 0.75), { modes: [5, 6], twoModes: true, np1p: 6 }); // L3 ex. 1: (n+1)p = 6
  assert.deepEqual(mostProbable(9, 0.5).modes, [4, 5]);
  assert.deepEqual(mostProbable(5000, 0.01).modes, [50]); // L3 says 51; formula (13) gives [50.01] = 50
  assert.deepEqual(mostProbable(10, 0).modes, [0]);
  assert.deepEqual(mostProbable(10, 1).modes, [10]);
});

test('AC2: each approximation reports its absolute error; L3 ex. 2 exact 0.0566 and 0.5375 beside them', () => {
  const exA = exactBinomial(5000, 1, 100, 50, 50), exB = exactBinomial(5000, 1, 100, 0, 50);
  assert.equal(exA.toFixed(4), '0.0566');
  assert.equal(exB.toFixed(4), '0.5375');
  const a = byKey(run({ example: 2 }, { seed: 1 })), b = byKey(run({ example: 3 }, { seed: 1 }));
  close(a.exactPoint.theory, exA, 1e-12, 'ex2a exact');
  close(b.exactInt.theory, exB, 1e-12, 'ex2b exact');
  for (const [out, keys] of [[a, ['local', 'poissonPoint']], [b, ['integral', 'integralCC', 'poissonInt']]]) {
    for (const k of keys) {
      assert.ok(typeof out[k].error === 'number', `${k} has an error`);
      const ref = k === 'local' || k === 'poissonPoint' ? out.exactPoint.theory : out.exactInt.theory;
      close(out[k].error, Math.abs(out[k].theory - ref), 1e-11, k);
    }
  }
  // Values the lecture shows, recomputed: local 0.0567, plain integral 0.5, continuity-corrected 0.5283.
  assert.equal(a.local.theory.toFixed(4), '0.0567');
  assert.equal(b.integral.theory.toFixed(4), '0.5000');
  assert.equal(b.integralCC.theory.toFixed(4), '0.5283');
  // Independent check of the approximation formulas themselves.
  close(localApprox(5000, 0.01, 50), 1 / Math.sqrt(2 * Math.PI * 49.5), 1e-15, 'local at the centre');
  close(integralApprox(200, 0.6, 120, 150), 0.4999925488321037, 1e-13, 'L9 first grade plain (SciPy norm.cdf)');
  close(poissonPmf(2, 3), 4 * Math.exp(-2) / 3, 1e-15, 'Poisson 2,3');
});

test('AC3: frequency sample size uses the exact quantile (13 530) with the Chebyshev bound beside it', () => {
  const s = sampleSize(0.01, 0.98, 0.5);
  assert.equal(s.z.toFixed(4), '2.3263');
  assert.equal(s.normal, 13530);
  assert.equal(s.chebyshev, 125000); // 0.25 / (0.02 · 10⁻⁴)
  const out = byKey(run({ view: 2 }, { seed: 1 }));
  assert.equal(out.nNormal.theory, 13530);
  assert.equal(out.nCheb.theory, 125000);
  assert.equal(out.lectureTable.theory, 13225); // the lecture's z = 2.3, shown as a note
  assert.ok(sampleSize(0.05, 0.9, 0.2).chebyshev > sampleSize(0.05, 0.9, 0.2).normal);
});

test('AC4: L9 examples show exact 0.9520, 0.5307, 0.7963 next to the lecture normal values', () => {
  const want = { 5: ['0.9520', 50, 1, 5, 6, 50, 0.92135], 6: ['0.5307', 200, 3, 5, 120, 150, 0.5], 7: ['0.7963', 15000, 1, 25, 570, 630, 0.7888] };
  for (const [ex, [digits, n, a, b, k1, k2, lectureValue]] of Object.entries(want)) {
    const exact = exactBinomial(n, a, b, k1, k2);
    assert.equal(exact.toFixed(4), digits, `exact ex ${ex}`);
    const out = byKey(run({ example: Number(ex) }, { seed: 1 }));
    close(out.exactInt.theory, exact, 1e-12, `kernel ex ${ex}`);
    assert.equal(out.lecture_integral.theory, lectureValue, `lecture value ${lectureValue} shown`);
    assert.ok(out.integral.error > 0.005, 'the plain normal value visibly differs from the exact one');
  }
  // The L9 "defects" value is erf-based: ½(1 + erf(1)) = Φ(√2) = 0.92135.
  close(byKey(run({ example: 5 })).integral.theory, 0.9213503964748575, 1e-12); // SciPy norm.cdf(√2)
});

test('AC5: every normal-approximation readout names its function', () => {
  for (let ex = 0; ex < EXAMPLES.length; ex++) {
    for (const r of run({ example: ex }, { seed: 3 }).readouts) {
      if (['local', 'integral', 'integralCC'].includes(r.key)) assert.match(r.convention, /\\varphi|\\Phi|erf/, r.key);
      assert.ok(r.convention, `${r.key} has a convention`);
    }
  }
  for (const r of run({ view: 2 }).readouts) assert.ok(r.convention, r.key);
});

test(`Monte Carlo: simulated frequencies stay inside the predeclared ±${BAND_Z}σ band on fixed seeds`, () => {
  for (const seed of [1, 2, 3, 20261124, 4294967295]) {
    for (let ex = 1; ex < EXAMPLES.length; ex++) {
      for (const r of run({ example: ex, R: 4000 }, { seed }).readouts) {
        if (r.band) assert.ok(r.observed >= r.band[0] && r.observed <= r.band[1], `seed ${seed} ex ${ex} ${r.key}: ${r.observed} not in ${r.band}`);
      }
    }
  }
  // Inversion draws are integers in 0..n and use the exact CDF.
  const pmf = binomialPmf(30, 0.4);
  close(binomialInterval(pmf, 0, 30), 1, 1e-14);
});
