// Throwaway Discovery spike for issue #47 (lecture 12). Run: node --test spikes/lecture-hypothesis-tests/kernel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  meta, stations, run, TAILS, criticalRegion, proportionTest, meanTest, fTest, lectureExample,
  proportionPower, proportionSize, zPower, tPower, fPower, acceptanceBand, simulateMean, simulateVariances, simulateProportion,
} from './kernel.mjs';
import { normalQuantile, studentTQuantile, fisherQuantile, fisherCdf, normalCdf, studentTCdf, logGamma } from './special.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const SEED = 20261124;

// ---------------------------------------------------------------- AC 1: quantile-based critical values, bands on the null density
test('critical values come from computed quantiles for every H1 and test', () => {
  for (const alpha of [0.01, 0.05, 0.1]) {
    const z = (tail) => criticalRegion({ kind: 'z' }, alpha, tail);
    assert.deepEqual(z('right'), { lower: null, upper: normalQuantile(1 - alpha) });
    assert.deepEqual(z('left'), { lower: normalQuantile(alpha), upper: null });
    assert.deepEqual(z('two'), { lower: normalQuantile(alpha / 2), upper: normalQuantile(1 - alpha / 2) });
    // Independent identity checks of the quantiles themselves: Φ(z) = p, F(1, k) = t²(k), F_p(a, b) = 1/F_{1−p}(b, a).
    close(normalCdf(z('right').upper), 1 - alpha, 1e-12, 'Φ round trip');
    for (const k of [1, 4, 9, 30]) {
      const t = criticalRegion({ kind: 't', df: k }, alpha, 'two').upper;
      close(studentTCdf(t, k), 1 - alpha / 2, 1e-10, 't round trip');
      close(fisherQuantile(1 - alpha, 1, k), t * t, 1e-7 * t * t, 'F(1,k) = t²');
    }
    for (const [a, b] of [[4, 9], [9, 14], [19, 5]]) {
      const f = criticalRegion({ kind: 'F', df1: a, df2: b }, alpha, 'two');
      close(f.lower, 1 / fisherQuantile(1 - alpha / 2, b, a), 1e-9 * f.upper, 'F lower = 1/F upper of the swapped df');
      close(fisherCdf(f.upper, a, b), 1 - alpha / 2, 1e-10, 'F round trip');
    }
  }
});

test('the critical region is emitted as accent bands on the null density, with stable ids and lengths', () => {
  // p₀ = 0.4: with the default p₀ = 0.1 the left critical frequency is below 0, so that band is rightly empty.
  for (const [station, extra] of [['proportion', { p0: 0.4 }], ['mean', { sigmaKnown: 1 }], ['mean', { sigmaKnown: 0 }], ['variances', {}]]) {
    const shapes = new Set();
    for (const tail of [0, 1, 2]) {
      const out = run({ ...extra, tail, view: 0 }, { seed: SEED, station });
      const left = out.series.find((s) => s.id === 'crit-left'), right = out.series.find((s) => s.id === 'crit-right');
      assert.equal(left.kind, 'band'); assert.equal(left.tone, 'accent');
      assert.equal(right.kind, 'band'); assert.equal(right.tone, 'accent');
      const nullPdf = out.series.find((s) => s.id === 'null-pdf');
      const pdfAt = (x) => { // linear interpolation of the emitted null density
        const i = nullPdf.x.findIndex((v) => v >= x);
        if (i <= 0) return nullPdf.y[Math.max(0, i)];
        const t = (x - nullPdf.x[i - 1]) / (nullPdf.x[i] - nullPdf.x[i - 1]);
        return nullPdf.y[i - 1] + t * (nullPdf.y[i] - nullPdf.y[i - 1]);
      };
      const used = (b) => b.y2.some((v) => v > 0);
      // A used band's upper edge is the null density itself; an unused side collapses to zero height.
      for (const band of [left, right]) {
        band.y.forEach((v) => assert.equal(v, 0));
        if (used(band)) band.x.forEach((x, i) => close(band.y2[i], pdfAt(x), 2e-2 * Math.max(...nullPdf.y), `${station} band on null density`));
      }
      assert.equal(used(left), tail !== 1, `${station} tail ${tail} left band`);
      assert.equal(used(right), tail !== 2, `${station} tail ${tail} right band`);
      shapes.add(JSON.stringify(out.series.map((s) => [s.id, s.x.length])));
    }
    assert.equal(shapes.size, 1, `${station}: series ids and lengths do not change with H1`);
  }
});

// ---------------------------------------------------------------- AC 2: the L12 worked example
test('L12 example: n = 50, frequency 0.12, H0 p = 0.1, alpha = 0.01, right-sided', () => {
  const ex = lectureExample();
  close(ex.U, 0.02 * Math.sqrt(50) / 0.3, 1e-12);
  assert.equal(ex.U.toFixed(3), '0.471');
  assert.equal(ex.critical.toFixed(3), '2.326');
  assert.equal(ex.reject, false);
  close(ex.phi0AtCritical, 0.49, 1e-12, 'Φ₀(u_cr) = (1 − 2α)/2');
  // The test function agrees with the example on the same counts (m = 6 of 50).
  const t = proportionTest(6, 50, 0.1, 0.01, 'right');
  close(t.U, ex.U, 1e-12); assert.equal(t.reject, false);
  // The station readout shows it.
  const out = run({}, { seed: SEED, station: 'proportion' });
  const r = out.readouts.find((x) => x.key === 'l12-example');
  assert.match(String(r.observed), /U = 0\.471/);
  assert.match(String(r.observed), /2\.326/);
  assert.match(String(r.observed), /keep H₀/);
});

test('the exact size of the L12 proportion test is not alpha', () => {
  // Rejection set m ≥ 10 for n = 50, p0 = 0.1, alpha = 0.01: an independent binomial tail sum.
  let tail = 0;
  for (let m = 10; m <= 50; m++) tail += Math.exp(logGamma(51) - logGamma(m + 1) - logGamma(51 - m) + m * Math.log(0.1) + (50 - m) * Math.log(0.9));
  close(proportionSize(50, 0.1, 0.01, 'right'), tail, 1e-12);
  assert.ok(tail > 0.024 && tail < 0.025, `size ${tail}`);
});

// ---------------------------------------------------------------- AC 3: type I error and power with Monte Carlo bands
test('exact power formulas reduce to alpha under H0 and agree with independent forms', () => {
  for (const tail of TAILS) {
    close(zPower(0, 25, 0.05, tail), 0.05, 1e-12, `z ${tail}`);
    close(tPower(0, 10, 0.05, tail), 0.05, 2e-6, `t ${tail}`);
    close(fPower(1, 9, 14, 0.05, tail), 0.05, 1e-10, `F ${tail}`);
  }
  // z: closed form 1 − Φ(u − δ).
  close(zPower(0.5, 16, 0.05, 'right'), 1 - normalCdf(normalQuantile(0.95) - 2), 1e-12);
  // t power for large n tends to the z power (d = 0.05σ, n = 2001: δ = 2.24).
  close(tPower(0.05, 2001, 0.05, 'two'), zPower(0.05, 2001, 0.05, 'two'), 2e-3);
  // t power with d = (μ − a₀)/σ and n: tPower(0.5, 16) is P(T₁₅(δ = 2) > t₀.₉₅(15)), below the z power.
  assert.ok(tPower(0.5, 16, 0.05, 'right') < zPower(0.5, 16, 0.05, 'right'));
  // F: ratio ρ·F(k1, k2), so the right-sided power is P(F > c/ρ).
  close(fPower(2, 9, 14, 0.05, 'right'), 1 - fisherCdf(fisherQuantile(0.95, 9, 14) / 2, 9, 14), 1e-12);
  // proportion: exact binomial, the L12 example's true p = 0.12 gives the tail P(m ≥ 10 | p = 0.12).
  let tail = 0;
  for (let m = 10; m <= 50; m++) tail += Math.exp(logGamma(51) - logGamma(m + 1) - logGamma(51 - m) + m * Math.log(0.12) + (50 - m) * Math.log(0.88));
  close(proportionPower(50, 0.1, 0.12, 0.01, 'right'), tail, 1e-12);
});

test('regression: the t power integral stays exact at n = 2 and alpha = 0.001 (critical t ≈ 318)', () => {
  for (const n of [2, 3, 5]) for (const alpha of [0.001, 0.002, 0.05]) for (const tail of TAILS) close(tPower(0, n, alpha, tail), alpha, 1e-5 * alpha, `n ${n} α ${alpha} ${tail}`);
  // Independent check (checker run, 400 000 replicates): P(T > t₀.₉₉₉(1)) at n = 2, d = 1.5 is 0.00534 ± 0.00012.
  close(tPower(1.5, 2, 0.001, 'right'), 0.00534, 4 * 0.00012);
});

test('the t power integral matches a long independent Monte Carlo run', () => {
  // 40 000 replicates of a t test (n = 10, δ = 0.8σ, right) drawn here with Box–Muller from a plain LCG, independent of the kernel streams.
  let s = 12345;
  const u = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 2 ** 32; };
  const norm = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  const n = 10, R = 40000, c = studentTQuantile(0.95, n - 1);
  let hits = 0;
  for (let r = 0; r < R; r++) {
    const x = Array.from({ length: n }, () => 0.8 + norm());
    const m = x.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
    if (m * Math.sqrt(n) / sd > c) hits++;
  }
  const p = tPower(0.8, n, 0.05, 'right'), se = Math.sqrt(p * (1 - p) / R);
  close(hits / R, p, 4.5 * se, 't power');
});

test('seeded type I error stays inside its predeclared band around alpha (or the exact size)', () => {
  const R = 2000, alpha = 0.05;
  for (const tail of TAILS) {
    const { lo, hi } = acceptanceBand(R, alpha, 0.001);
    for (const sigmaKnown of [1, 0]) {
      const sim = simulateMean({ n: 12, R, seed: SEED, sigmaKnown, alpha, tail, grid: [0] });
      assert.ok(sim.hits[0] >= lo && sim.hits[0] <= hi, `mean σ known ${sigmaKnown} ${tail}: ${sim.hits[0]} not in [${lo}, ${hi}]`);
    }
    const f = simulateVariances({ n1: 8, n2: 13, R, seed: SEED, alpha, tail, grid: [1] });
    assert.ok(f.hits[0] >= lo && f.hits[0] <= hi, `F ${tail}: ${f.hits[0]} not in [${lo}, ${hi}]`);
    const size = proportionSize(50, 0.3, alpha, tail), band = acceptanceBand(R, size, 0.001);
    const p = simulateProportion({ n: 50, p0: 0.3, R, seed: SEED, alpha, tail, grid: [0.3] });
    assert.ok(p.hits[0] >= band.lo && p.hits[0] <= band.hi, `p ${tail}: ${p.hits[0]} not in [${band.lo}, ${band.hi}] (exact size ${size})`);
  }
});

test('the power curve is emitted with its Monte Carlo band and the points sit inside it', () => {
  for (const [station, params] of [['proportion', { tail: 0, n: 80, p0: 0.4 }], ['mean', { sigmaKnown: 0 }], ['mean', { sigmaKnown: 1, tail: 2 }], ['variances', { tail: 0 }]]) {
    const out = run({ ...params, view: 1, R: 1000 }, { seed: SEED, station });
    const theory = out.series.find((s) => s.id === 'power-theory'), band = out.series.find((s) => s.id === 'power-band'), mc = out.series.find((s) => s.id === 'power-mc');
    assert.ok(theory && band && mc, station);
    assert.equal(band.kind, 'band');
    assert.deepEqual(band.x, mc.x);
    let outside = 0;
    mc.y.forEach((v, i) => { assert.ok(band.y[i] <= band.y2[i]); if (v < band.y[i] || v > band.y2[i]) outside++; });
    // Points share draws (common random numbers), each band is a 99.9% band: allow at most one excursion per curve.
    assert.ok(outside <= 1, `${station}: ${outside} points outside the band`);
  }
});

// ---------------------------------------------------------------- AC 4: the F test
test('F test: larger variance on top with matching df; two-sided uses alpha/2', () => {
  const x = [1.2, -0.7, 2.9, 0.4, -1.8, 3.1, 0.2, -2.2], y = [0.1, 0.4, -0.3, 0.2, 0.0, -0.5, 0.6, 0.3, -0.1, 0.2, 0.4, -0.2];
  const v = (a) => { const m = a.reduce((s, t) => s + t, 0) / a.length; return a.reduce((s, t) => s + (t - m) ** 2, 0) / (a.length - 1); };
  const t2 = fTest(x, y, 0.05, 'two');
  assert.ok(v(x) > v(y));
  close(t2.F, v(x) / v(y), 1e-12);
  assert.deepEqual([t2.df1, t2.df2], [x.length - 1, y.length - 1]);
  close(t2.critical, fisherQuantile(1 - 0.025, 7, 11), 1e-12, 'two-sided uses α/2');
  // Swapping the samples keeps the larger variance on top, and the df follow it.
  const s2 = fTest(y, x, 0.05, 'two');
  close(s2.F, t2.F, 1e-12); assert.deepEqual([s2.df1, s2.df2], [7, 11]);
  // One-sided H1: D(X) > D(Y) uses the ratio in the order H1 names, with α.
  const r = fTest(x, y, 0.05, 'right');
  close(r.critical, fisherQuantile(0.95, 7, 11), 1e-12);
  assert.equal(r.reject, v(x) / v(y) > r.critical);
  const wrongWay = fTest(y, x, 0.05, 'right');
  assert.equal(wrongWay.reject, false, 'the sample variance of X is smaller: no evidence for D(X) > D(Y)');
});

test('the lecture one-sided rule (larger over smaller with alpha) doubles the type I error', () => {
  const R = 4000, alpha = 0.05;
  const sim = simulateVariances({ n1: 8, n2: 13, R, seed: SEED, alpha, tail: 'right', grid: [1] });
  const band = acceptanceBand(R, 2 * alpha, 0.001);
  assert.ok(sim.lectureRuleHits[0] >= band.lo && sim.lectureRuleHits[0] <= band.hi, `${sim.lectureRuleHits[0]} vs [${band.lo}, ${band.hi}]`);
  close(fPower(1, 7, 12, alpha, 'right', { lectureRule: true }), 2 * alpha, 1e-10);
});

// ---------------------------------------------------------------- contract
test('kernel follows the contract: deterministic, finite, aligned arrays, every station and view', () => {
  assert.equal(meta.id, 'lecture-hypothesis-tests');
  assert.deepEqual(meta.lectures, ['L12']);
  for (const [id, st] of Object.entries(stations)) {
    for (const p of st.params) assert.ok(p.min <= p.default && p.default <= p.max, `${id}.${p.key}`);
    const view = st.params.find((p) => p.key === 'view');
    for (let v = view.min; v <= view.max; v++) {
      for (const tail of [0, 1, 2]) {
        const params = { view: v, tail, R: 400 };
        const a = JSON.stringify(run(params, { seed: 7, station: id })), b = JSON.stringify(run(params, { seed: 7, station: id }));
        assert.equal(a, b, `${id} view ${v}: same seed, same bytes`);
        const out = JSON.parse(a);
        assert.ok(out.readouts.length && out.series.length && out.notes.length && out.axes.x && out.axes.y);
        for (const s of out.series) {
          assert.equal(s.x.length, s.y.length, `${id}/${s.id}`);
          if (s.y2) assert.equal(s.y2.length, s.x.length, `${id}/${s.id} y2`);
          for (const arr of [s.x, s.y, s.y2 ?? []]) arr.forEach((val) => assert.ok(Number.isFinite(val), `${id}/${s.id} finite`));
        }
      }
    }
    assert.notEqual(JSON.stringify(run({ view: 0 }, { seed: 7, station: id })), JSON.stringify(run({ view: 0 }, { seed: 8, station: id })), `${id}: seed matters`);
  }
});

test('series ids and lengths stay stable across alpha and the effect slider (smooth tweens)', () => {
  const shape = (o) => JSON.stringify(o.series.map((s) => [s.id, s.kind, s.x.length]));
  for (const [station, key, values] of [['proportion', 'p', [0.05, 0.12, 0.5]], ['mean', 'mu', [-1, 0, 1.2]], ['variances', 'rho', [0.25, 1, 4]]]) {
    for (const view of [0, 1, 2]) {
      const shapes = new Set();
      for (const v of values) for (const alpha of [0.01, 0.1]) shapes.add(shape(run({ [key]: v, alpha, view, R: 200 }, { seed: 3, station })));
      assert.equal(shapes.size, 1, `${station} view ${view}`);
    }
  }
});
