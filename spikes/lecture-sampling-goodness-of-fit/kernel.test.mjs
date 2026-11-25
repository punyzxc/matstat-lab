// node --test spikes/lecture-sampling-goodness-of-fit
// Reference values are closed forms, exact enumeration or brute force, never values copied from the lectures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as K from './kernel.mjs';
import * as S from './special.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const readout = (res, key) => res.readouts.find((r) => r.key === key);
const SAMPLE = (p = {}) => K.run({ law: 0, n: 100, bins: 0, digits: 0, view: 0, ...p }, { seed: 2026, station: 'sample' });
const FIT = (p = {}) => K.run({ law: 0, h0: 0, n: 200, alpha: 0.05, cells: 10, estimate: 0, merge: 1, reps: 100, ...p }, { seed: 2026, station: 'fit' });

// ------------------------------------------------------------ special functions
test('special: erf, Φ and Φ⁻¹ against closed forms', () => {
  close(S.erf(1), 0.8427007929497149, 1e-14, 'erf(1)');
  close(S.erf(-0.5) + S.erf(0.5), 0, 1e-16);
  close(S.normalCdf(0), 0.5, 1e-16);
  close(S.laplacePhi0(1.5), S.normalCdf(1.5) - 0.5, 1e-15);
  for (const p of [1e-10, 0.001, 0.025, 0.3, 0.5, 0.8, 0.975, 0.999999]) close(S.normalCdf(S.normalQuantile(p)), p, 1e-13 * Math.max(1, p / 1e-10) * p + 1e-15, `Φ(Φ⁻¹(${p}))`);
  close(S.normalQuantile(0.975), 1.959963984540054, 1e-12);
});

test('special: χ² quantiles invert the CDF and match df = 1 and df = 2 closed forms', () => {
  for (const p of [0.05, 0.5, 0.9, 0.95, 0.99]) {
    close(S.chiSquareQuantile(p, 2), -2 * Math.log(1 - p), 1e-11, `df 2, p ${p}`);
    close(S.chiSquareQuantile(p, 1), S.normalQuantile((1 + p) / 2) ** 2, 1e-10, `df 1, p ${p}`);
  }
  // df = 4: P(χ² ≤ x) = 1 − e^{−x/2}(1 + x/2)
  for (const x of [0.5, 3, 9.4877, 20]) close(S.chiSquareCdf(x, 4), 1 - Math.exp(-x / 2) * (1 + x / 2), 1e-14, `df 4, x ${x}`);
  for (const k of [1, 3, 7, 14, 29]) close(S.chiSquareCdf(S.chiSquareQuantile(0.95, k), k), 0.95, 1e-12, `df ${k}`);
});

test('special: K(λ) — the theta and alternating forms agree, and the limit of the exact law is K', () => {
  for (const l of [0.6, 0.9, 1.0, 1.18, 1.5, 2.0]) close(S.kolmogorovKTheta(l), S.kolmogorovKAlternating(l), 1e-14, `λ = ${l}`);
  assert.equal(S.kolmogorovK(0), 0);
  close(S.kolmogorovK(S.kolmogorovQuantile(0.95)), 0.95, 1e-12);
  // P(√n Dₙ < λ) → K(λ); with n = 2000 the gap is below 0.01 (finite-n correction ~ 1/(6√n)).
  close(S.kolmogorovExactCdf(2000, 1.0 / Math.sqrt(2000)), S.kolmogorovK(1.0), 0.01, 'n = 2000');
});

test('special: exact Kolmogorov law — closed form for n = 1, support bounds, Monte Carlo for n = 10', () => {
  // n = 1: D₁ = max(U, 1 − U), so P(D₁ < d) = 2d − 1 on [1/2, 1].
  for (const d of [0.55, 0.7, 0.9]) close(S.kolmogorovExactCdf(1, d), 2 * d - 1, 1e-14, `n = 1, d = ${d}`);
  assert.equal(S.kolmogorovExactCdf(10, 0.05), 0, 'Dₙ ≥ 1/(2n)');
  assert.equal(S.kolmogorovExactCdf(10, 1), 1);
  // Brute force: 20 000 uniform samples of size 10 from the fixture generator.
  const n = 10, R = 20000, d = 0.3;
  let below = 0;
  for (let r = 0; r < R; r++) if (K.kolmogorovStatistic(K.drawSample(1, n, 99, r), K.LAWS[1].cdf).d < d) below++;
  const p = S.kolmogorovExactCdf(n, d);
  close(below / R, p, 4 * Math.sqrt((p * (1 - p)) / R), 'MC vs exact');
});

// ------------------------------------------------------------ contract
test('contract: meta, stations sample and fit, deterministic output, no Math.random', () => {
  assert.equal(K.meta.id, 'lecture-sampling-goodness-of-fit');
  assert.deepEqual(Object.keys(K.stations).sort(), ['fit', 'sample']);
  for (const [station, { params }] of Object.entries(K.stations)) {
    const defaults = Object.fromEntries(params.map((p) => [p.key, p.default]));
    for (const p of params) assert.ok(p.min <= p.default && p.default <= p.max, `${station}.${p.key}`);
    const a = K.run(defaults, { seed: 5, station }), b = K.run(defaults, { seed: 5, station });
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${station} deterministic`);
    assert.notEqual(JSON.stringify(a), JSON.stringify(K.run(defaults, { seed: 6, station })), `${station} depends on the seed`);
    assert.ok(a.axes.x && a.axes.y, 'axes are labelled');
    for (const s of a.series) {
      assert.ok(['pmf', 'pdf', 'cdf', 'hist', 'ecdf', 'line', 'points', 'band', 'rule'].includes(s.kind));
      if (s.kind !== 'rule') assert.equal(s.x.length, s.y.length, s.id);
    }
  }
  const src = readFileSync(new URL('./kernel.mjs', import.meta.url), 'utf8') + readFileSync(new URL('./special.mjs', import.meta.url), 'utf8');
  assert.ok(!/Math\.random/.test(src));
});

test('laws have the stated mean and variance (sample of 200 000)', () => {
  for (let law = 0; law < 3; law++) {
    const m = K.shapeMoments(K.drawSample(law, 200000, 1));
    close(m.mean, 1, 4 * Math.sqrt(1 / 200000), `${K.LAWS[law].id} mean`);
    close(m.s2, 1, 0.03, `${K.LAWS[law].id} variance`);
  }
});

// ------------------------------------------------------------ AC1: series, table, histogram
test('AC1: counts sum to n, the histogram integrates to 1, and k defaults to 5·lg n (adjustable)', () => {
  for (const n of [10, 50, 100, 730, 1000]) {
    assert.equal(K.defaultBinCount(n), Math.round(5 * Math.log10(n)));
    for (let law = 0; law < 3; law++) {
      const res = SAMPLE({ law, n });
      assert.equal(readout(res, 'n').observed, n);
      close(readout(res, 'area').observed, 1, 1e-12);
      assert.equal(readout(res, 'k').observed, K.defaultBinCount(n));
      const hist = res.series.find((s) => s.kind === 'hist');
      assert.equal(hist.x.length, K.defaultBinCount(n));
    }
  }
  const res = SAMPLE({ bins: 23 });
  assert.equal(readout(res, 'k').observed, 23);
  assert.equal(res.series.find((s) => s.kind === 'hist').y.length, 23);
  // Variation series is sorted and the table of distinct values reproduces the sample.
  const x = K.drawSample(2, 300, 4).map((v) => Math.round(v * 10) / 10);
  const vs = K.variationSeries(x);
  for (let i = 1; i < vs.sorted.length; i++) assert.ok(vs.sorted[i - 1] <= vs.sorted[i]);
  assert.equal(vs.counts.reduce((s, m) => s + m, 0), 300);
  for (let r = 0; r < vs.values.length; r++) assert.equal(vs.counts[r], x.filter((v) => v === vs.values[r]).length);
  // The maximum lands in the last (closed) interval, nothing is lost at the edges.
  const t = K.frequencyTable([0, 1, 2, 3, 4], 2);
  assert.deepEqual(t.counts, [2, 3]);
});

// ------------------------------------------------------------ AC2: ECDF convention and ties
test('AC2: the ECDF states its convention and matches exact steps on ties', () => {
  const F = K.ecdf([3, 1, 2, 2, 2, 5]);
  assert.deepEqual(F.x, [1, 2, 3, 5]);
  assert.deepEqual(F.y, [1 / 6, 4 / 6, 5 / 6, 1]);
  const res = SAMPLE({ digits: 1, view: 1, n: 200 });
  const conv = readout(res, 'ecdf');
  assert.equal(conv.observed, '$P(\\xi \\le x)$');
  assert.match(conv.convention, /P\(\\xi < x\)/);
  const sample = K.drawSample(0, 200, 2026).map((v) => Math.round(v * 10) / 10);
  const e = res.series.find((s) => s.kind === 'ecdf');
  assert.ok(e.x.length < 200, 'rounding created ties');
  e.x.forEach((v, i) => assert.equal(e.y[i], sample.filter((s) => s <= v).length / 200, `step at ${v}`));
});

// ------------------------------------------------------------ AC3: Kolmogorov
test('AC3: Dₙ uses both D⁺ and D⁻ and equals the brute-force supremum', () => {
  const U = K.LAWS[1].cdf; // uniform on [1 − √3, 1 + √3]
  const a = 1 - Math.sqrt(3), w = 2 * Math.sqrt(3), at = (u) => a + u * w;
  const low = K.kolmogorovStatistic([0.05, 0.1, 0.15].map(at), U); // sample piled low: D⁺ dominates
  close(low.dPlus, 1 - 0.15, 1e-12); assert.ok(low.d === low.dPlus && low.dPlus > low.dMinus);
  const high = K.kolmogorovStatistic([0.85, 0.9, 0.95].map(at), U); // piled high: D⁻ dominates
  close(high.dMinus, 0.85, 1e-12); assert.ok(high.d === high.dMinus && high.dMinus > high.dPlus);
  // Brute force: sup over a fine grid, including left limits at each observation.
  for (let law = 0; law < 3; law++) {
    const x = K.drawSample(law, 40, 8), F = K.LAWS[law].cdf, sorted = [...x].sort((p, q) => p - q);
    let sup = 0;
    for (const v of sorted) {
      const right = sorted.filter((s) => s <= v).length / 40, left = sorted.filter((s) => s < v).length / 40;
      sup = Math.max(sup, Math.abs(right - F(v)), Math.abs(left - F(v)));
    }
    close(K.kolmogorovStatistic(x, F).d, sup, 1e-15, K.LAWS[law].id);
  }
});

test('AC3: √n·Dₙ is compared with K(λ), and the band Fₙ ± λₙ(α) is emitted', () => {
  const res = FIT();
  const dn = readout(res, 'dn'), lam = readout(res, 'lambda');
  close(lam.observed, Math.sqrt(200) * dn.observed, 1e-12);
  close(S.kolmogorovK(lam.theory), 0.95, 1e-12);
  close(S.kolmogorovExactCdf(200, dn.theory), 0.95, 1e-9, 'λₙ is the exact critical value');
  const band = res.series.find((s) => s.kind === 'band'), e = res.series.find((s) => s.kind === 'ecdf');
  for (let i = 0; i < e.x.length; i++) {
    const j = band.x.indexOf(e.x[i]) + 1; // second copy of the jump point carries the new level
    close(band.y[j], Math.max(0, e.y[i] - dn.theory), 1e-15);
    close(band.y2[j], Math.min(1, e.y[i] + dn.theory), 1e-15);
  }
  // Decision agrees with the band picture: reject ⇔ F leaves the band somewhere ⇔ Dₙ ≥ λₙ.
  const far = FIT({ law: 2, h0: 0 });
  assert.equal(readout(far, 'ksdecision').observed, 'reject $H_0$');
  assert.ok(readout(far, 'dn').observed >= readout(far, 'dn').theory);
});

test('AC3: with estimated parameters the Kolmogorov p-value is withheld', () => {
  const res = FIT({ estimate: 1 });
  assert.equal(readout(res, 'ksp').observed, null);
  assert.equal(readout(res, 'ksdecision').observed, 'not applicable');
});

// ------------------------------------------------------------ AC4: Pearson
test('AC4: df = s − 1 − r for each L12 law', () => {
  const r = { 0: 2, 1: 2, 2: 1 };
  for (let law = 0; law < 3; law++) for (const estimate of [0, 1]) {
    const p = K.pearsonTest(K.drawSample(law, 500, 3), law, { cells: 8, alpha: 0.05, estimate: estimate === 1, merge: false });
    assert.equal(p.s, 8);
    assert.equal(p.df, 8 - 1 - (estimate ? r[law] : 0), `${K.LAWS[law].id}, estimate ${estimate}`);
    close(p.groups.reduce((s, g) => s + g.expected, 0), 500, 1e-9, 'Σ npᵢ = n');
    assert.equal(p.groups.reduce((s, g) => s + g.observed, 0), 500);
    close(p.critical, S.chiSquareQuantile(0.95, p.df), 1e-12);
    close(p.p, S.chiSquareSf(p.chi2, p.df), 1e-15);
  }
  // L12 grouped estimates: uniform a* = x̄ − √3σ, b* = x̄ + √3σ; exponential λ* = 1/x̄.
  const u = K.pearsonTest(K.drawSample(1, 2000, 3), 1, { cells: 10, alpha: 0.05, estimate: true, merge: false });
  close((u.params[0] + u.params[1]) / 2, 1, 0.05); close(u.params[1] - u.params[0], 2 * Math.sqrt(3), 0.1);
});

test('AC4: expected counts below 5 raise a warning; merging removes them', () => {
  const raw = K.pearsonTest(K.drawSample(0, 40, 3), 0, { cells: 12, alpha: 0.05, estimate: false, merge: false });
  assert.ok(raw.small > 0);
  assert.match(raw.warning, /below 5/);
  const merged = K.pearsonTest(K.drawSample(0, 40, 3), 0, { cells: 12, alpha: 0.05, estimate: false, merge: true });
  assert.equal(merged.small, 0);
  assert.equal(merged.warning, null);
  assert.ok(merged.s < 12);
  const res = FIT({ n: 30, cells: 15, merge: 0 });
  assert.ok(readout(res, 'small').observed > 0);
  assert.ok(res.notes.some((n) => /below 5/.test(n)));
});

// Predeclared band: α ± 3·√(α(1 − α)/R). R = 1000 replicates of n = 200, α = 0.05: [0.0293, 0.0707].
const BAND = (alpha, R) => [alpha - 3 * Math.sqrt((alpha * (1 - alpha)) / R), alpha + 3 * Math.sqrt((alpha * (1 - alpha)) / R)];
test('AC4: seeded Monte Carlo false-rejection rate under H₀ is within its band', () => {
  const [lo, hi] = BAND(0.05, 1000);
  for (let h0 = 0; h0 < 3; h0++) {
    const mc = K.falseRejection(h0, 200, 451, 1000, { cells: 10, alpha: 0.05, estimate: false, merge: true });
    assert.equal(mc.R, 1000);
    assert.ok(mc.pearsonRate >= lo && mc.pearsonRate <= hi, `Pearson, fully specified ${K.LAWS[h0].id}: ${mc.pearsonRate}`);
    assert.ok(mc.kolmogorovRate >= lo && mc.kolmogorovRate <= hi, `Kolmogorov ${K.LAWS[h0].id}: ${mc.kolmogorovRate}`);
  }
  for (const h0 of [0, 2]) { // r > 0: normal (r = 2), exponential (r = 1)
    const mc = K.falseRejection(h0, 200, 451, 1000, { cells: 10, alpha: 0.05, estimate: true, merge: true });
    assert.ok(mc.pearsonRate >= lo && mc.pearsonRate <= hi, `Pearson, estimated ${K.LAWS[h0].id}: ${mc.pearsonRate}`);
  }
});

test('finding: L12 uniform moment estimates make Pearson anti-conservative; Kolmogorov with estimates is far too lenient', () => {
  const [, hi] = BAND(0.05, 1000);
  const uni = K.falseRejection(1, 200, 451, 1000, { cells: 10, alpha: 0.05, estimate: true, merge: true });
  assert.ok(uni.pearsonRate > hi, `uniform a*, b* by moments: ${uni.pearsonRate}`);
  const norm = K.falseRejection(0, 200, 451, 1000, { cells: 10, alpha: 0.05, estimate: true, merge: true });
  assert.ok(norm.kolmogorovRate < 0.01, `Kolmogorov with fitted normal: ${norm.kolmogorovRate}`);
});

test('edge cases: df < 1 explained, zero replicates, fast run for a far H₀ at n = 1000', () => {
  const few = FIT({ cells: 3, estimate: 1, n: 100 });
  assert.equal(readout(few, 'chidecision').observed, 'not applicable');
  assert.ok(few.notes.some((n) => /Too few cells/.test(n)));
  const none = FIT({ reps: 0 });
  assert.equal(readout(none, 'mcchi').observed, null);
  assert.match(readout(none, 'mcchi').convention, /no replicates/);
  const t0 = performance.now();
  const far = FIT({ law: 1, h0: 2, n: 1000, reps: 0 });
  assert.ok(performance.now() - t0 < 500, 'large n·Dₙ must not use the exact matrix');
  assert.match(readout(far, 'ksp').convention, /1 - K/);
  close(readout(far, 'ksp').observed, readout(far, 'ksp').theory, 0);
});

test('power: a wrong H₀ is rejected (n = 500)', () => {
  const res = FIT({ law: 1, h0: 0, n: 500 });
  assert.equal(readout(res, 'chidecision').observed, 'reject $H_0$');
  assert.equal(readout(res, 'ksdecision').observed, 'reject $H_0$');
});

// ------------------------------------------------------------ lecture pins (L10 worked examples)
test('lecture pins: L10 χ² critical value and the Kolmogorov example', () => {
  // L10 example 2 quotes χ² = 23.7 for 14 degrees of freedom at p = 0.95: correct to 3 significant figures.
  close(S.chiSquareQuantile(0.95, 14), 23.6848, 1e-4);
  // L10 example 1: F(τ) = 1 − e^{−0.03τ}; the largest gap is at τ = 55 (0.808 vs the tabulated 0.72).
  const tau = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
  const Fn = [0.135, 0.26, 0.36, 0.45, 0.518, 0.57, 0.628, 0.648, 0.735, 0.78, 0.72, 0.83, 0.85, 0.875, 0.892, 0.91];
  const gaps = tau.map((t, i) => Math.abs(Fn[i] + Math.expm1(-0.03 * t)));
  close(Math.max(...gaps), 0.0880, 5e-4);
  assert.equal(tau[gaps.indexOf(Math.max(...gaps))], 55);
  close(1 - S.kolmogorovK(0.0880 * 4), 0.9997, 1e-4, 'the lecture reads 1 − K(0.352) ≈ 0.999');
  // The table cannot be an ECDF of n = 16 values: it decreases, and its values are not multiples of 1/16.
  assert.ok(Fn[10] < Fn[9]);
  assert.ok(Fn.some((v) => Math.abs(v * 16 - Math.round(v * 16)) > 1e-9));
  // If 0.72 is a typo for 0.82, Dₙ moves to τ = 40 with 0.051.
  const fixed = [...Fn]; fixed[10] = 0.82;
  close(Math.max(...tau.map((t, i) => Math.abs(fixed[i] + Math.expm1(-0.03 * t)))), 0.0508, 5e-4);
});

test('lecture pins: L10 example 2 — Pearson with the lecture’s own data', () => {
  const W = [0.135, 0.125, 0.1, 0.09, 0.068, 0.082, 0.048, 0.052, 0.04, 0.04, 0.03, 0.02, 0.02, 0.025, 0.017, 0.018];
  close(W.reduce((s, w) => s + w, 0), 0.91, 1e-12, 'the frequencies do not sum to 1');
  const G = (t) => -Math.expm1(-t / 23.3);
  // The first summand of the lecture equals (F(5) − W₁)²/F(5): a cumulative probability against an interval frequency.
  close((G(5) - W[0]) ** 2 / G(5), 0.0174, 1e-4);
  // Correct statistic: interval probabilities, last cell open, the missing 9 % counted there.
  const n = 16, p = W.map((_, i) => G(5 * (i + 1)) - G(5 * i)); p[15] = 1 - G(75);
  const O = W.map((w) => n * w); O[15] += n * 0.09;
  const chi2 = p.reduce((s, pi, i) => s + (O[i] - n * pi) ** 2 / (n * pi), 0);
  close(chi2, 2.962, 1e-3);
  assert.ok(p.every((pi) => n * pi < 5), 'every expected count is below 5: the test does not apply');
});

// #127: the statistics drawn: the Kolmogorov gap as a bar, Pearson's χ² cell by cell.
test('#127 the gap bar is exactly D_n long and stands at its argmax; Pearson bars add up to χ²', () => {
  for (const [law, h0] of [[0, 0], [1, 0], [2, 2], [0, 2]]) for (const n of [30, 200, 600]) {
    const k0 = FIT({ view: 0, law, h0, n }), k1 = FIT({ view: 1, law, h0, n });
    const gap = k0.series.find((s) => s.id === 'gap');
    const dn = k0.readouts.find((r) => r.key === 'dn').observed;
    assert.equal(gap.x[0], gap.x[1]);
    assert.ok(Math.abs(Math.abs(gap.y[1] - gap.y[0]) - dn) < 1e-12, `gap ${law}/${h0}/${n}`);
    const terms = K.pearsonTerms(K.pearsonTest(K.drawSample(law, n, 2026), h0, { cells: 10, alpha: 0.05, estimate: false, merge: true }));
    assert.deepEqual(k1.series.find((s) => s.id === 'terms').y, terms);
    const chi2 = k1.readouts.find((r) => r.key === 'chi2').observed;
    assert.ok(Math.abs(terms.reduce((a, b) => a + b, 0) - chi2) < 1e-9 * Math.max(1, chi2));
    assert.equal(k1.linked.series.find((s) => s.id === 'observed').y.reduce((a, b) => a + b, 0), n);
    assert.ok(Math.abs(k1.linked.series.find((s) => s.id === 'expected').y.reduce((a, b) => a + b, 0) - n) < 1e-6);
    // The readouts are the same in both views: only the picture changes.
    assert.deepEqual(k0.readouts, k1.readouts);
  }
});

// #126: representativeness. A biased sampler takes members only from [lo, hi]; a random one from the whole population.
test('#126 the conditional law: exact moments of the uniform and exponential windows, the symmetric normal one', () => {
  const u = K.truncatedMoments(1, 0, 2); // inside U(1 − √3, 1 + √3): uniform on [0, 2]
  assert.ok(Math.abs(u.mean - 1) < 1e-9 && Math.abs(u.variance - 1 / 3) < 1e-9);
  assert.ok(Math.abs(u.mass - 2 / (2 * Math.sqrt(3))) < 1e-12);
  const e = K.truncatedMoments(2, 1, 2), E1 = Math.exp(-1), E2 = Math.exp(-2);
  assert.ok(Math.abs(e.mean - (2 * E1 - 3 * E2) / (E1 - E2)) < 1e-9, String(e.mean));
  const nrm = K.truncatedMoments(0, 0, 2);
  assert.ok(Math.abs(nrm.mean - 1) < 1e-9);
  assert.equal(K.truncatedMoments(2, -3, -1).mass, 0);
  assert.throws(() => K.run({ view: 2, law: 2, lo: -3, hi: -1 }, { seed: 1, station: 'sample' }), /almost none/);
});

test('#126 the biased sample stays in its region; the random one is the station’s own sample', () => {
  const out = K.run({ view: 2, law: 0, n: 300, lo: 4, hi: 1.5, reps: 20 }, { seed: 8, station: 'sample' }); // bounds in either order
  const b = K.biasedSample(0, 300, 1.5, 4, 8);
  assert.ok(b.every((v) => v >= 1.5 && v <= 4));
  const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length;
  assert.ok(Math.abs(out.readouts.find((r) => r.key === 'meanB').observed - mean(b)) < 1e-12);
  assert.ok(Math.abs(out.readouts.find((r) => r.key === 'meanR').observed - mean(K.drawSample(0, 300, 8))) < 1e-12);
  assert.deepEqual(out, K.run({ view: 2, law: 0, n: 300, lo: 4, hi: 1.5, reps: 20 }, { seed: 8, station: 'sample' }));
  // The two histograms have the same bars, so they can be read against each other and against f(x).
  const hist = out.series.find((s) => s.id === 'hist'), step = out.series.find((s) => s.id === 'biased');
  assert.equal(step.x.length, 2 * hist.x.length + 2);
  assert.equal(step.y[0], 0);
  assert.equal(step.y.at(-1), 0);
});

test('#126 on fixtures, the random mean error falls as 1/√n while the biased one does not shrink', () => {
  for (const law of [0, 1, 2]) {
    const T = K.truncatedMoments(law, 1.5, 4), bias = Math.abs(T.mean - 1);
    const E = K.errorCurve(law, 1.5, 4, 200, 2026);
    const first = E.random[0], last = E.random.at(-1);
    assert.ok(last < first / 5, `law ${law}: random ${first} → ${last}`); // √(1000/10) = 10
    assert.ok(Math.abs(last - Math.sqrt(2 / Math.PI / 1000)) < 0.006, `law ${law}: σ√(2/πn) ${last}`);
    assert.ok(E.biased.every((v) => Math.abs(v - bias) < 0.12), `law ${law}: biased ${E.biased}`);
    assert.ok(E.biased.at(-1) > 0.95 * E.biased[0], `law ${law}: the biased error does not shrink`);
  }
});

// ---------------------------------------------------------------- #88: a typed law as the source and as H0
test('#88: the Sample station draws from a typed law, with its formula and preview', () => {
  const r = K.run({ law: K.TYPED, n: 1000, view: 0, custom: '0 1 2 | 0.2 0.5 0.3' }, { seed: 6, station: 'sample' });
  const mean = r.readouts.find((x) => x.key === 'mean');
  assert.ok(Math.abs(mean.theory - 1.1) < 1e-12 && Math.abs(mean.observed - 1.1) < 0.08, JSON.stringify(mean));
  assert.equal(r.series.find((s) => s.id === 'pdf').kind, 'pmf', 'a discrete law is drawn as masses over h');
  assert.match(r.formula[0], /begin\{array\}/);
  const c = K.run({ law: K.TYPED, n: 1000, view: 1, custom: '2x on [0, 1]' }, { seed: 6, station: 'sample' });
  assert.deepEqual(c.linked.series.map((s) => s.kind), ['pdf', 'cdf']);
  const biased = K.run({ law: K.TYPED, n: 200, view: 2, lo: 0.5, hi: 1, reps: 40, custom: '2x on [0, 1]' }, { seed: 6, station: 'sample' });
  assert.ok(biased.readouts.length > 0);
});

test('#88: the Fit station tests a sample against a typed H0, discrete or continuous, at the right level', () => {
  for (const custom of ['3x^2 on [0, 1]', '0 1 2 | 0.2 0.5 0.3', '1 2 3 4 5 6 | 1/6 1/6 1/6 1/6 1/6 1/6']) {
    const r = K.run({ law: K.TYPED, h0: K.TYPED, n: 300, view: 1, reps: 300, alpha: 0.05, custom }, { seed: 6, station: 'fit' });
    const ro = Object.fromEntries(r.readouts.map((x) => [x.key, x]));
    // Pearson's false-rejection rate under H0 sits near alpha; Kolmogorov's is at most alpha (exact for a continuous law).
    assert.ok(Math.abs(ro.mcchi.observed - 0.05) < 0.04, `${custom}: Pearson ${ro.mcchi.observed}`);
    assert.ok(ro.mcks.observed < 0.05 + 0.04, `${custom}: Kolmogorov ${ro.mcks.observed}`);
  }
  // A normal sample is told apart from a typed discrete H0: values the law does not have make chi^2 infinite.
  const far = K.run({ law: 0, h0: K.TYPED, n: 200, view: 1, reps: 0, custom: '0 1 2 | 0.2 0.5 0.3' }, { seed: 6, station: 'fit' });
  assert.equal(far.readouts.find((x) => x.key === 'chidecision').observed, 'reject $H_0$');
});

test('#88: against a discrete F the Kolmogorov statistic uses F(x−) on the lower side', () => {
  const F = Object.assign((x) => (x < 0 ? 0 : x < 1 ? 0.5 : 1), { left: (x) => (x <= 0 ? 0 : x <= 1 ? 0.5 : 1) });
  const s = K.kolmogorovStatistic([0, 0, 1, 1], F);
  assert.equal(s.d, 0, 'a sample that matches the law exactly has D = 0');
  assert.equal(K.kolmogorovStatistic([0, 0, 0, 1], F).d, 0.25);
});
