// node --test spikes/lecture-random-vectors/kernel.test.mjs
// References are recomputed here from first principles (exact sums, Simpson quadrature,
// least squares), not copied from the kernel's closed forms. Monte Carlo bands are declared up front.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from './kernel.mjs';

const defaults = (station) => Object.fromEntries(K.stations[station].params.map((p) => [p.key, p.default]));
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const readout = (res, key) => res.readouts.find((r) => r.key === key);
/** Composite Simpson on [a, b] with an even number of panels. */
function simpson(f, a, b, panels = 20000) {
  const h = (b - a) / panels;
  let s = f(a) + f(b);
  for (let i = 1; i < panels; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}
/** Mean, variance, skewness and excess kurtosis from a density or PMF, by direct summation. */
function momentsOf(law) {
  let E = (g) => law.support.reduce((s, x, i) => s + law.pmf[i] * g(x), 0);
  if (!law.discrete) {
    const [lo, hi] = law.integrate;
    E = (g) => simpson((x) => law.pdf(x) * g(x), lo, hi);
  }
  const mu = E((x) => x), v = E((x) => (x - mu) ** 2);
  return { mass: E(() => 1), mu, v, sk: E((x) => (x - mu) ** 3) / v ** 1.5, ek: E((x) => (x - mu) ** 4) / v ** 2 - 3 };
}
const LAW_ARGS = { p: 0.3, m: 10, lambda: 2, sigma: 1.3 };

test('closed-form moments of the six laws match direct summation and quadrature', () => {
  for (let li = 0; li < 6; li++) {
    const law = K.makeLaw(li, LAW_ARGS);
    if (!law.discrete) {
      const h = Math.sqrt(law.variance) * Math.sqrt(3);
      law.integrate = li === 3 ? [-h, h] : li === 4 ? [0, 60 / LAW_ARGS.lambda] : [-12 * LAW_ARGS.sigma, 12 * LAW_ARGS.sigma];
    }
    const ref = momentsOf(law);
    close(ref.mass, 1, 1e-9, `${law.name} mass`);
    close(law.mean, ref.mu, 1e-8, `${law.name} mean`);
    close(law.variance, ref.v, 1e-8, `${law.name} variance`);
    close(law.skew, ref.sk, 1e-7, `${law.name} skewness`);
    close(law.exkurt, ref.ek, 1e-6, `${law.name} excess kurtosis`);
  }
  assert.equal(K.makeLaw(5, LAW_ARGS).exkurt, 0, 'normal: Ek = 0');
});

test('sample moments use the stated divisors', () => {
  const xs = [1, 2, 2, 3, 7];
  const s = K.sampleMoments(xs);
  close(s.mean, 3, 1e-15, 'mean');
  close(s.s2, 22 / 4, 1e-15, 's² divides by n − 1');
  close(s.m2, 22 / 5, 1e-15, 'm₂ divides by n');
  const m3 = [-8, -1, -1, 0, 64].reduce((a, b) => a + b) / 5, m4 = [16, 1, 1, 0, 256].reduce((a, b) => a + b) / 5;
  close(s.skew, m3 / (22 / 5) ** 1.5, 1e-12, 'Sk = m₃/m₂^1.5');
  close(s.exkurt, m4 / (22 / 5) ** 2 - 3, 1e-12, 'Ek = m₄/m₂² − 3');
});

test('Moments station: sample values sit inside predeclared bands for each law (n = 20000)', () => {
  // Bands: mean 4σ/√n; variance 4·√((μ₄ − σ⁴)/n); |Sk − Sk₀| < 0.12 + 0.06|Sk₀|·… declared per law below.
  const skewTol = [0.12, 0.12, 0.12, 0.08, 0.25, 0.08], kurtTol = [0.25, 0.25, 0.4, 0.08, 1.5, 0.15];
  for (let li = 0; li < 6; li++) {
    const res = K.run({ ...defaults('moments'), law: li, n: 20000 }, { seed: 2026, station: 'moments' });
    const law = K.makeLaw(li, { ...defaults('moments') });
    const sd = Math.sqrt(law.variance), n = 20000, mu4 = (law.exkurt + 3) * law.variance ** 2;
    close(readout(res, 'mean').observed, law.mean, (4 * sd) / Math.sqrt(n), `law ${li} mean`);
    close(readout(res, 'variance').observed, law.variance, 4 * Math.sqrt((mu4 - law.variance ** 2) / n), `law ${li} variance`);
    close(readout(res, 'skew').observed, law.skew, skewTol[li], `law ${li} skewness`);
    close(readout(res, 'exkurt').observed, law.exkurt, kurtTol[li], `law ${li} excess kurtosis`);
    for (const k of [1, 2, 3, 4]) {
      const r = readout(res, `rule${k}`), p = r.theory;
      close(r.observed, p, 4 * Math.sqrt((p * (1 - p)) / n) + 1e-9, `law ${li} share inside ${k}σ`);
    }
  }
});

test('3σ rule: exact normal probabilities and the lecture table', () => {
  const law = K.makeLaw(5, { ...LAW_ARGS, sigma: 1 });
  const exact = { 1: 0.682689492137, 2: 0.954499736104, 3: 0.997300203937, 4: 0.999936657516 };
  for (const k of [1, 2, 3, 4]) {
    const quad = simpson((x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI), -k, k);
    close(K.sigmaRule(law, k), quad, 1e-10, `P(|ξ| < ${k}σ) against quadrature`);
    close(K.sigmaRule(law, k), exact[k], 1e-10, `P(|ξ| < ${k}σ) against the 12-digit value`);
  }
  close(1 - 2 * K.Phi(-3), 0.9973, 5e-5, '1 − 2Φ(−3)');
  close(K.Phi(-3), 0.00135, 5e-6, 'one tail Φ(−3)');
  assert.ok(Math.abs(K.LECTURE_TABLE_3[4] - exact[4]) > 2e-4, 'the lecture 4σ entry (0.9997) is wrong and must stay flagged');
});

test('mode and median conventions: double modes and discrete medians', () => {
  assert.deepEqual(K.makeLaw(2, { ...LAW_ARGS, lambda: 2 }).mode, [1, 2], 'Poisson with integer λ has two modes');
  assert.deepEqual(K.makeLaw(1, { ...LAW_ARGS, m: 9, p: 0.5 }).mode, [4, 5], 'Binomial with integer (m+1)p has two modes');
  assert.deepEqual(K.makeLaw(1, { ...LAW_ARGS, m: 10, p: 0.3 }).mode, [3]);
  const res = K.run({ ...defaults('moments'), law: 4, lambda: 2 }, { seed: 1, station: 'moments' });
  close(readout(res, 'median').theory, Math.LN2 / 2, 1e-6, 'exponential median ln2/λ');
});

test('Transform: formula (44) densities integrate to 1 and agree with the CDF', () => {
  const base = defaults('transform');
  const cases = [
    { phi: 0, alpha: 2 }, { phi: 0, alpha: -1.5 }, { phi: 1, sigma: 0.5 },
    { phi: 2, lambda: 2, beta: 1 }, { phi: 2, lambda: 0.5, beta: 2 }, { phi: 3, lambda: 1.5 },
  ];
  for (const c of cases) {
    const t = K.makeTransform({ ...base, ...c });
    // Total mass by the CDF (robust where f is unbounded at 0): F(+∞) − F(−∞) = 1.
    close(t.cdf(1e9) - t.cdf(-1e9), 1, 1e-12, `${t.name} total mass`);
    // f = dF/dy at interior points, by a central difference of the CDF.
    const [lo, hi] = t.range;
    for (const u of [0.2, 0.45, 0.7]) {
      const y = lo + u * (hi - lo), h = 1e-5 * (hi - lo);
      close(t.pdf(y), (t.cdf(y + h) - t.cdf(y - h)) / (2 * h), 1e-4 * Math.max(1, t.pdf(y)), `${t.name}: f(${y.toFixed(3)})`);
    }
    // Mass between two interior points by quadrature of f equals the CDF difference.
    const a = lo + 0.1 * (hi - lo), b = lo + 0.9 * (hi - lo);
    close(simpson(t.pdf, a, b), t.cdf(b) - t.cdf(a), 1e-8, `${t.name}: ∫f over [a, b]`);
  }
});

test('Transform: the L6 example η = e^(−βξ) has F(y) = y^(λ/β) on [0, 1]', () => {
  for (const [lambda, beta] of [[2, 1], [0.5, 2], [1, 1]]) {
    const t = K.makeTransform({ ...defaults('transform'), phi: 2, lambda, beta });
    for (const y of [0, 0.1, 0.5, 0.9, 1]) close(t.cdf(y), y ** (lambda / beta), 1e-15, `F(${y})`);
    // Independent derivation: P(e^(−βξ) < y) = P(ξ > −ln y / β) = e^(λ ln y / β).
    close(t.cdf(0.3), Math.exp((lambda * Math.log(0.3)) / beta), 1e-12, 'derivation');
  }
});

test('Transform: seeded histograms stay inside their bands', () => {
  for (const phi of [0, 1, 2, 3]) {
    const n = 20000;
    const res = K.run({ ...defaults('transform'), phi, n }, { seed: 44, station: 'transform' });
    assert.ok(readout(res, 'bins').observed < 4.5, `phi ${phi}: largest bin deviation ${readout(res, 'bins').observed} SE`);
    assert.ok(readout(res, 'ks').observed < 1.63 / Math.sqrt(n), `phi ${phi}: Kolmogorov distance under the 1 % critical value`);
    if (phi === 2) {
      const r = readout(res, 'F05');
      close(r.observed, r.theory, 4 * Math.sqrt((r.theory * (1 - r.theory)) / n), 'F(0.5)');
    }
  }
  assert.throws(() => K.makeTransform({ ...defaults('transform'), phi: 0, alpha: 0 }), /monotone/);
  const atom = K.run({ ...defaults('transform'), phi: 0, alpha: 0, b: 1.5 }, { seed: 1, station: 'transform' });
  assert.deepEqual(atom.series[0].x, [1.5], 'α = 0 shows the atom at b instead of failing during a live drag');
});

test('Scatter: bivariate normal correlation within the Fisher band; regression lines (63)–(64)', () => {
  for (const rho of [-0.8, 0, 0.6]) {
    const n = 5000, sigma2 = 1.5;
    const res = K.run({ ...defaults('scatter'), mode: 0, rho, sigma2, n }, { seed: 9, station: 'scatter' });
    const r = readout(res, 'r').observed;
    const half = 3.29 / Math.sqrt(n - 3); // 99.9 % in Fisher z
    assert.ok(Math.abs(Math.atanh(r) - Math.atanh(rho)) < half, `rho ${rho}: r = ${r}`);
    // Theory slopes are formulas (63) and (64) with σ₁ = 1.
    close(readout(res, 'slope63').theory, rho * sigma2, 1e-6, 'theory slope (63)');
    close(readout(res, 'slope64').theory, rho / sigma2, 1e-6, 'theory slope (64)');
    // Observed values against theory with predeclared bands (≈ 4 standard errors).
    close(readout(res, 'cov').observed, rho * sigma2, 4 * sigma2 * Math.sqrt((1 + rho * rho) / n), 'sample covariance');
    close(readout(res, 'slope63').observed, rho * sigma2, 4 * sigma2 * Math.sqrt((1 - rho * rho) / n), 'sample slope (63)');
    const pin = 1 - Math.exp(-2);
    close(readout(res, 'ellipse').observed, pin, 4 * Math.sqrt((pin * (1 - pin)) / n), 'share inside the ellipse');
    if (rho === 0) close(readout(res, 'angle').theory, 90, 0, 'perpendicular lines at r = 0');
  }
});

test('Scatter: sample line (63) is the least-squares fit (the L6 exercise)', () => {
  const xs = [], ys = [];
  for (let i = 0; i < 50; i++) { xs.push(Math.sin(i) * 3 + i / 10); ys.push(Math.cos(i * 1.7) + 0.4 * i / 10); }
  const st = K.vectorStats(xs, ys);
  // Least squares from the normal equations, written independently.
  const n = xs.length, Sx = xs.reduce((a, b) => a + b), Sy = ys.reduce((a, b) => a + b);
  const Sxx = xs.reduce((a, x) => a + x * x, 0), Sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), Syy = ys.reduce((a, y) => a + y * y, 0);
  close(st.slopeYonX, (n * Sxy - Sx * Sy) / (n * Sxx - Sx * Sx), 1e-12, 'OLS slope of y on x');
  close(st.slopeXonY, (n * Sxy - Sx * Sy) / (n * Syy - Sy * Sy), 1e-12, 'OLS slope of x on y');
  // Acute angle: compare with the angle between direction vectors of the two lines.
  const a1 = Math.atan(st.slopeYonX), a2 = Math.atan2(1, st.slopeXonY);
  let d = Math.abs(a1 - a2) * 180 / Math.PI; if (d > 90) d = 180 - d;
  close(K.regressionAngle(st.r, st.sx, st.sy), d, 1e-9, 'tan θ formula');
});

test('Scatter: the uniform disc is uncorrelated yet dependent', () => {
  // corr(ξ², η²) = −1/3 by polar quadrature: E ξ² = 1/4, E ξ⁴ = 1/8, E ξ²η² = 1/24.
  const E = (g) => simpson((r) => simpson((t) => g(r * Math.cos(t), r * Math.sin(t)) * r / Math.PI, 0, 2 * Math.PI, 400), 0, 1, 400);
  const ex2 = E((x) => x * x), ex4 = E((x) => x ** 4), exy = E((x, y) => x * x * y * y);
  close((exy - ex2 * ex2) / (ex4 - ex2 * ex2), -1 / 3, 1e-6, 'corr(ξ², η²)');
  const n = 20000;
  const res = K.run({ ...defaults('scatter'), mode: 1, n }, { seed: 5, station: 'scatter' });
  assert.ok(Math.abs(readout(res, 'r').observed) < 3.29 / Math.sqrt(n), 'r ≈ 0');
  close(readout(res, 'r2').observed, -1 / 3, 0.04, 'sample corr(ξ², η²)');
  assert.equal(readout(res, 'joint').observed, 0, 'no point in the corners');
  assert.ok(readout(res, 'product').observed > 0.015, 'the product of marginals is positive');
  // Marginal tail P(|ξ| > a) for the disc, by quadrature of the marginal density 2√(1 − x²)/π.
  const tail = 2 * simpson((x) => (2 * Math.sqrt(1 - x * x)) / Math.PI, 0.75, 1, 20000);
  close(readout(res, 'product').theory, tail * tail, 1e-6, 'product theory');
});

test('Matching problem: exact law has mean 1 and variance 1 for every n ≥ 2; simulation within bands', () => {
  for (let n = 2; n <= 9; n++) {
    // Exact law by brute-force enumeration of all n! permutations for small n.
    if (n <= 7) {
      const counts = new Array(n + 1).fill(0);
      const perm = Array.from({ length: n }, (_, i) => i);
      const walk = (k) => {
        if (k === n) { counts[perm.reduce((c, v, i) => (v === i ? c + 1 : c), 0)]++; return; }
        for (let i = k; i < n; i++) { [perm[k], perm[i]] = [perm[i], perm[k]]; walk(k + 1); [perm[k], perm[i]] = [perm[i], perm[k]]; }
      };
      walk(0);
      const total = counts.reduce((a, b) => a + b);
      K.matchPmf(n).forEach((p, k) => close(p, counts[k] / total, 1e-12, `P(M = ${k}), n = ${n}`));
    }
    const pmf = K.matchPmf(n);
    const mean = pmf.reduce((s, p, k) => s + p * k, 0), varr = pmf.reduce((s, p, k) => s + p * (k - mean) ** 2, 0);
    close(mean, 1, 1e-12, `exact mean, n = ${n}`);
    close(varr, 1, 1e-12, `exact variance, n = ${n}`);
    const reps = 4000;
    const res = K.run({ ...defaults('scatter'), mode: 2, players: n, reps }, { seed: 31 + n, station: 'scatter' });
    const b = K.matchBands(n, reps);
    close(readout(res, 'mean').observed, 1, b.mean, `simulated mean, n = ${n}`);
    close(readout(res, 'variance').observed, 1, b.variance, `simulated variance, n = ${n}`);
  }
});

test('every station is deterministic and emits only finite numbers', () => {
  const finite = (v, path) => {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `non-finite at ${path}`);
    else if (Array.isArray(v)) v.forEach((x, i) => finite(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) finite(x, `${path}.${k}`);
  };
  const runs = [
    ...[0, 1, 2, 3, 4, 5].map((law) => ['moments', { law }]),
    ...[0, 1, 2, 3].map((phi) => ['transform', { phi }]),
    ['transform', { phi: 2, lambda: 0.2, beta: 4 }],
    ...[0, 1, 2, 3, 4].map((mode) => ['scatter', { mode }]),
    ['scatter', { mode: 0, rho: -0.95, sigma2: 0.5 }], ['scatter', { mode: 0, rho: 0 }],
  ];
  for (const [station, over] of runs) {
    const params = { ...defaults(station), ...over };
    const a = K.run(params, { seed: 123, station }), b = K.run(params, { seed: 123, station });
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${station} ${JSON.stringify(over)} replays byte-identically`);
    finite(a, `${station}`);
    assert.ok(Array.isArray(a.readouts) && Array.isArray(a.series) && Array.isArray(a.notes));
    assert.notEqual(JSON.stringify(a), JSON.stringify(K.run(params, { seed: 124, station })), 'the seed matters');
  }
});

test('surface: theory density on the grid integrates to about 1 and matches the 2D histogram', () => {
  const res = K.run({ ...defaults('scatter'), mode: 0, rho: 0.6, n: 20000 }, { seed: 77, station: 'scatter' });
  const s = res.surface, dx = s.x[1] - s.x[0], dy = s.y[1] - s.y[0];
  const sum = (z) => z.flat().reduce((a, b) => a + b, 0) * dx * dy;
  close(sum(s.z), 1, 0.01, 'Riemann sum of f(x, y)');
  close(sum(s.zSample), 1, 0.01, 'sample histogram mass on the grid');
  let worst = 0;
  s.z.forEach((row, j) => row.forEach((f, i) => {
    const p = f * dx * dy, se = Math.sqrt((p * (1 - p)) / 20000) / (dx * dy);
    if (p > 1e-3) worst = Math.max(worst, Math.abs(s.zSample[j][i] - f) / se);
  }));
  assert.ok(worst < 5, `largest cell deviation ${worst} SE (cell-centre density vs cell average)`);
});

// ---------------------------------------------------------------- #96: Scatter in 3D with typed ρ, σ_X, σ_Y
test('#96 scatter: sigma_X and sigma_Y are typed; theory scales with both', () => {
  const keys = K.stations.scatter.params.map((p) => p.key);
  for (const k of ['rho', 'sigma1', 'sigma2', 'n']) assert.ok(keys.includes(k), k);
  const rho = -0.4, s1 = 1.8, s2 = 0.7, n = 20000;
  const res = K.run({ ...defaults('scatter'), mode: 0, rho, sigma1: s1, sigma2: s2, n }, { seed: 12, station: 'scatter' });
  close(readout(res, 'cov').theory, rho * s1 * s2, 1e-6, 'theory covariance');
  close(readout(res, 'cov').observed, rho * s1 * s2, 5 * s1 * s2 / Math.sqrt(n), 'sample covariance');
  close(readout(res, 'slope63').theory, rho * s2 / s1, 1e-6, 'slope (63)');
  close(readout(res, 'r').observed, rho, 0.03, 'r near rho');
  // The density surface integrates to about 1 and its histogram matches it.
  const s = res.surface, dx = s.x[1] - s.x[0], dy = s.y[1] - s.y[0];
  close(s.z.flat().reduce((a, v) => a + v, 0) * dx * dy, 1, 0.02, 'density volume');
  close(s.zSample.flat().reduce((a, v, k) => a + v, 0) * dx * dy, 1, 0.05, 'histogram volume');
});

test('#96 scatter: r and rho sit side by side, and the regression line is typeset', () => {
  const res = K.run({ ...defaults('scatter'), mode: 0, rho: 0.6, sigma1: 2, sigma2: 1, n: 2000 }, { seed: 3, station: 'scatter' });
  const keys = res.readouts.map((r) => r.key);
  assert.equal(keys.indexOf('line'), keys.indexOf('r') + 1, 'the line follows r');
  const line = readout(res, 'line');
  assert.match(line.label, /\\rho\\,\\dfrac\{\\sigma_Y\}\{\\sigma_X\}\\,x/);
  assert.equal(line.theory, '$y = 0.3\\,x$');
  assert.match(line.observed, /^\$y = -?[\d.]+\\,x [+-] [\d.]+\$$/);
});

test('#96 scatter: rho = ±1 degenerates to a ridge on the line, with a caption saying why', () => {
  for (const rho of [1, -1]) {
    const res = K.run({ ...defaults('scatter'), mode: 0, rho, sigma1: 1, sigma2: 2, n: 3000 }, { seed: 8, station: 'scatter' });
    assert.equal(readout(res, 'r').observed, rho, 'r = rho exactly');
    const s = res.surface;
    s.y.forEach((y, j) => s.x.forEach((x, i) => {
      if (Math.abs(y - rho * 2 * x) > (s.y[1] - s.y[0]) / 2 + 1e-9) assert.equal(s.z[j][i], 0, 'no mass off the line');
    }));
    assert.ok(s.z.flat().some((v) => v > 0), 'a ridge on the line');
    s.z.flat().forEach((v) => assert.ok(Number.isFinite(v)));
    assert.match(res.notes[0], /no density in the plane/);
    assert.match(s.title, /all probability on the line/);
    for (const r of res.readouts) for (const v of [r.observed, r.theory]) if (typeof v === 'number') assert.ok(Number.isFinite(v), r.key);
  }
});

test('#96 scatter: the same parameters and seed give the same histogram', () => {
  const p = { ...defaults('scatter'), mode: 0, rho: 0.3, sigma1: 1.4, sigma2: 0.8, n: 1500 };
  assert.equal(JSON.stringify(K.run(p, { seed: 44, station: 'scatter' }).surface), JSON.stringify(K.run(p, { seed: 44, station: 'scatter' }).surface));
  assert.notEqual(JSON.stringify(K.run(p, { seed: 45, station: 'scatter' }).surface.zSample), JSON.stringify(K.run(p, { seed: 44, station: 'scatter' }).surface.zSample));
});

// #133: correlation space. Predeclared band: 99.9 % in Fisher z, |z(r) − z(ρ)| < 3.29/√(n − 3) at n = 2000.
test('#133 scatter: r follows a typed rho within the Fisher band at n = 2000', () => {
  const n = 2000, half = 3.29 / Math.sqrt(n - 3);
  for (const [rho, seed] of [[-0.9, 11], [-0.35, 12], [0, 13], [0.25, 14], [0.75, 15], [0.95, 16]]) {
    const res = K.run({ ...defaults('scatter'), mode: 0, rho, n }, { seed, station: 'scatter' });
    const r = readout(res, 'r');
    assert.equal(r.theory, rho, 'r is shown beside rho');
    assert.ok(Math.abs(Math.atanh(r.observed) - Math.atanh(rho)) < half, `rho ${rho}: r = ${r.observed}`);
  }
});

test('#133 scatter: nonlinear presets have r near 0 while the dependence is strong', () => {
  const n = 2000, half = 3.29 / Math.sqrt(n - 3);
  close(K.nonlinearDependence(3), Math.sqrt(((4 * 16) / 45) / ((4 * 16) / 45 + 0.04)), 1e-12, 'parabola: corr(ξ², η)');
  for (const [mode, sign] of [[3, 1], [4, -1]]) {
    for (const seed of [21, 22, 23]) {
      const res = K.run({ ...defaults('scatter'), mode, n }, { seed, station: 'scatter' });
      const r = readout(res, 'r'), dep = readout(res, 'dep');
      assert.equal(r.theory, 0);
      assert.ok(Math.abs(Math.atanh(r.observed)) < half, `mode ${mode} seed ${seed}: r = ${r.observed}`);
      assert.ok(sign * dep.observed > 0.85, `mode ${mode}: dependence ${dep.observed} is visible`);
      assert.ok(Math.abs(Math.atanh(dep.observed) - Math.atanh(dep.theory)) < 2 * half, `mode ${mode}: dependence near theory`);
      assert.ok(res.series.some((s) => s.id === 'curve'), 'the curve of the dependence is drawn');
      assert.ok(res.notes.some((t) => /does not mean independent/.test(t)));
    }
  }
  // The theory density integrates to about 1 on the grid.
  for (const mode of [3, 4]) {
    const { surface: s } = K.run({ ...defaults('scatter'), mode, n: 2000 }, { seed: 5, station: 'scatter' });
    const dx = s.x[1] - s.x[0], dy = s.y[1] - s.y[0];
    const mass = s.z.flat().reduce((a, b) => a + b, 0) * dx * dy;
    assert.ok(Math.abs(mass - 1) < 0.08, `mode ${mode}: mass ${mass}`);
  }
});
