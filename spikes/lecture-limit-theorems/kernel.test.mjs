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
    const views = params.some((p) => p.key === 'view') ? [0, 1, 2, 3].filter((v) => v <= params.find((p) => p.key === 'view').max) : [undefined];
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

// #116: many paths and the Chebyshev corridor.
const corridor = (q, seed = 1) => k.run({ ...defaults('lln'), view: 2, ...q }, { seed, station: 'lln' });

test('#116 the share of paths outside a ± ε never exceeds the Chebyshev bound by more than the predeclared band', () => {
  for (const law of [0, 1, 2, 3]) for (const eps of [0.05, 0.1, 0.3]) for (const seed of [1, 2, 3]) {
    const res = corridor({ law, N: 2000, M: 300, eps }, seed);
    const outside = res.linked.series.find((s) => s.id === 'outside'), bound = res.linked.series.find((s) => s.id === 'bound');
    assert.equal(outside.x.length, bound.x.length);
    outside.y.forEach((share, j) => {
      const n = Math.round(10 ** outside.x[j]);
      assert.ok(Math.abs(bound.y[j] - k.chebyshevBound(k.LAWS[law].sd, n, eps)) < 1e-12);
      assert.ok(bound.y[j] <= 1);
      assert.ok(share <= bound.y[j] + k.corridorBand(300), `law ${law} eps ${eps} seed ${seed} n ${n}: ${share} > ${bound.y[j]}`);
    });
  }
});

test('#116 M typed paths are drawn, the bundle narrows, and the same seed gives the same paths', () => {
  const res = corridor({ law: 2, N: 4000, M: 120, eps: 0.1 }, 5);
  const paths = res.series.filter((s) => /^path\d/.test(s.id));
  assert.equal(paths.length, 120);
  const spreadAt = (j) => { const v = paths.map((p) => p.y[j]); return Math.max(...v) - Math.min(...v); };
  assert.ok(spreadAt(paths[0].y.length - 1) < spreadAt(20) / 3, 'the bundle narrows');
  // Independent recomputation of path 7 from the shared draws.
  const law = k.LAWS[2];
  let s = 0;
  for (let n = 1; n <= 4000; n++) s += law.draw(5, 300 + 2 * 7 * 7919, n);
  assert.ok(Math.abs(paths[7].y.at(-1) - s / 4000) < 1e-12);
  assert.equal(JSON.stringify(res), JSON.stringify(corridor({ law: 2, N: 4000, M: 120, eps: 0.1 }, 5)));
  assert.notEqual(JSON.stringify(res.series[0].y), JSON.stringify(corridor({ law: 2, N: 4000, M: 120, eps: 0.1 }, 6).series[0].y));
  assert.equal(corridor({ M: 1 }).series.filter((s) => /^path\d/.test(s.id)).length, 1);
  // Cauchy: no bound, and the share outside does not fall.
  const c = corridor({ law: 4, N: 4000, M: 200, eps: 0.5 }, 2);
  assert.equal(c.linked.series.find((s) => s.id === 'bound'), undefined);
  assert.equal(c.readouts[0].theory, 'no bound');
  assert.ok(c.readouts[0].observed > 0.5);
});

// #121: the characteristic function as the mean of unit vectors.
import { CF_LAWS, empiricalPhi } from './charfn.mjs';
const charfn = (q, seed = 1) => k.run({ ...defaults('charfn'), motion: 1, ...q }, { seed, station: 'charfn' });

test('#121 the empirical φ(t) lands within 4/√n of the exact φ(t) for every law, and φ(0) = 1, |φ| ≤ 1', () => {
  for (let law = 0; law < CF_LAWS.length; law++) for (const t of [-3.3, -0.7, 0.4, 1, 2.5]) for (const seed of [1, 2, 3]) {
    const r = charfn({ law, t, n: 2000 }, seed);
    const re = r.readouts.find((x) => x.key === 're'), im = r.readouts.find((x) => x.key === 'im');
    const band = 4 / Math.sqrt(2000);
    close(re.observed, re.theory, band, `Re law ${law} t ${t}`);
    close(im.observed, im.theory, band, `Im law ${law} t ${t}`);
    assert.equal(r.readouts.find((x) => x.key === 'zero').observed, 1);
    for (const [a, b] of r.phasor.exact) assert.ok(Math.hypot(a, b) <= 1 + 1e-9);
    assert.ok(r.readouts.find((x) => x.key === 'abs').observed <= 1 + 1e-12);
  }
});

test('#121 exact φ agrees with a direct numeric M e^{itX}, and symmetric laws have Im φ ≡ 0', () => {
  const q = { p: 0.3, m: 4, lambda: 1.5, a: 0, s: 1.2 };
  const pmf = (law) => law.id === 'bernoulli' ? [[0, 0.7], [1, 0.3]]
    : law.id === 'binomial' ? [0, 1, 2, 3, 4].map((j) => [j, [1, 4, 6, 4, 1][j] * 0.3 ** j * 0.7 ** (4 - j)])
    : law.id === 'poisson' ? Array.from({ length: 60 }, (_, j) => { let f = 1; for (let i = 2; i <= j; i++) f *= i; return [j, Math.exp(-1.5) * 1.5 ** j / f]; }) : null;
  const dens = { uniform: [(x) => (Math.abs(x) <= 1.2 ? 1 / 2.4 : 0), -1.2, 1.2], normal: [(x) => Math.exp(-x * x / 2.88) / (1.2 * Math.sqrt(2 * Math.PI)), -12, 12], exponential: [(x) => 1.5 * Math.exp(-1.5 * x), 0, 40] };
  for (const law of CF_LAWS) for (const t of [-2, 0.5, 1.7]) {
    const pm = pmf(law);
    let want;
    if (pm) want = pm.reduce(([a, b], [x, w]) => [a + w * Math.cos(t * x), b + w * Math.sin(t * x)], [0, 0]);
    else { const [f, lo, hi] = dens[law.id]; want = [simpson((x) => f(x) * Math.cos(t * x), lo, hi), simpson((x) => f(x) * Math.sin(t * x), lo, hi)]; }
    const got = law.phi(t, q);
    close(got[0], want[0], 1e-6, `${law.id} Re`); close(got[1], want[1], 1e-6, `${law.id} Im`);
    if (law.symmetric(q)) assert.ok(got[1] === 0, `${law.id} Im = 0`);
  }
  assert.deepEqual(empiricalPhi([0, 0], 3), [1, 0]);
});

test('#121 the phasor field carries the whole sample, the shown cap and the motion switch', () => {
  const r = charfn({ n: 3000, motion: 0 });
  assert.equal(r.phasor.xs.length, 3000);
  assert.equal(r.phasor.shown, k.PHASOR_SHOWN);
  assert.equal(r.phasor.motion, true);
  assert.equal(r.phasor.ts.length, r.phasor.exact.length);
  assert.equal(charfn({ n: 50 }).phasor.shown, 50);
  assert.notDeepEqual(charfn({}, 1).phasor.xs, charfn({}, 2).phasor.xs);
});

// #122: sums of independent X and Y have φ_X φ_Y.
test('#122 the empirical φ of simulated sums lands within 4/√n of φ_X φ_Y; means and variances add', () => {
  for (let lx = 0; lx < CF_LAWS.length; lx++) for (let ly = 0; ly < CF_LAWS.length; ly++) for (const t of [-1.3, 0.6, 2]) {
    const r = charfn({ view: 1, law: lx, law2: ly, t, n: 3000 }, 7);
    const band = 4 / Math.sqrt(3000);
    for (const key of ['re', 'im']) { const x = r.readouts.find((v) => v.key === key); close(x.observed, x.theory, band, `${key} ${lx}+${ly} t ${t}`); }
    const q = { p: 0.3, m: 10, lambda: 2, a: 0, s: 1 }, q2 = { p: 0.5, m: 6, lambda: 1, a: 0, s: 1 };
    const [fx, fy] = [CF_LAWS[lx].phi(t, q), CF_LAWS[ly].phi(t, q2)];
    close(r.readouts[0].theory, fx[0] * fy[0] - fx[1] * fy[1], 1e-5);
    const v = r.readouts.find((x) => x.key === 'var');
    close(v.theory, CF_LAWS[lx].variance(q) + CF_LAWS[ly].variance(q2), 1e-4);
    close(v.observed, v.theory, 0.15 * v.theory + 0.01, `var ${lx}+${ly}`);
    assert.equal(r.phasor.parts.length, 2);
    assert.equal(r.phasor.xs.length, 3000);
  }
});

// #128: exact P(|Z| ≤ 1) from the law of the sum, the CLT limit, and the simulated share.
test('#128 exact P(|Z| ≤ 1): Erlang, Poisson, Irwin–Hall and normal against brute force; the CLT limit as n grows', () => {
  // n = 1: one term, directly.
  const [U, , E, P] = [k.LAWS[1], null, k.LAWS[2], k.LAWS[3]];
  assert.ok(Math.abs(k.within1Exact(E, 1) - (1 - Math.exp(-2))) < 1e-12); // |X − 1| ≤ 1 ⇔ 0 ≤ X ≤ 2
  assert.ok(Math.abs(k.within1Exact(U, 1) - 2 * Math.sqrt(1 / 12)) < 1e-12);
  assert.ok(Math.abs(k.within1Exact(P, 1) - Math.exp(-1) * 2.5) < 1e-12); // k = 0, 1, 2
  assert.ok(Math.abs(k.erlangCdf(3, 2) - (1 - 4 * Math.exp(-3))) < 1e-12);
  for (const L of [U, E, P]) assert.ok(Math.abs(k.within1Exact(L, 30) - 0.682689) < 0.01, L.id);
  assert.equal(k.within1Exact(U, 31), null); // the alternating sum is no longer trustworthy there
  const out = k.run({ law: 1, n: 5, R: 4000, view: 0 }, { seed: 3, station: 'clt' });
  assert.ok(out.meet.exact && out.meet.approx && out.meet.sim);
  assert.equal(out.meet.approx.series, 'pdf');
  assert.equal(out.meet.sim.series, 'hist');
  const cauchy = k.run({ law: 4, N: 2000, k: 3, view: 0, M: 200, eps: 0.2 }, { seed: 3, station: 'lln' });
  assert.equal(cauchy.meet, undefined); // no mean, nothing to meet
  const lln = k.run({ law: 0, N: 2000, k: 3, view: 0, M: 200, eps: 0.2 }, { seed: 3, station: 'lln' });
  assert.deepEqual([lln.meet.exact.value, lln.meet.approx], [0, undefined]);
});

test('#128 the simulated share approaches the exact one as R grows', () => {
  const gap = (R) => {
    let s = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const m = k.run({ law: 1, n: 5, R, view: 0 }, { seed, station: 'clt' }).meet;
      s += Math.abs(m.sim.value - m.exact.value);
    }
    return s / 12;
  };
  assert.ok(gap(10000) < gap(1000) / 2, `${gap(1000)} → ${gap(10000)}`);
});

// ---------------------------------------------------------------- #86: the CLT ridge
test('#86: the ridge has one histogram slice per n, phi on the wall, and D per slice', () => {
  const out = k.run({ view: 3, source: 0, nmax: 12, R: 4000 }, { seed: 5, station: 'clt' });
  const s = out.surface;
  assert.equal(s.y.length, 12);
  assert.equal(s.z.length, 12);
  assert.equal(s.rowNotes.length, 12);
  for (const row of s.z) {
    const mass = row.reduce((a, v) => a + v, 0) * (8 / row.length);
    close(mass, 1, 0.01, 'each slice is a density over [-4, 4]');
  }
  close(Math.max(...s.wall.z), 1 / Math.sqrt(2 * Math.PI), 2e-3, 'phi(0) on the wall');
  const ks = out.series.find((x) => x.id === 'ks').y;
  assert.equal(ks.length, 12);
  assert.ok(ks[0] > ks.at(-1), 'uniform sums approach the normal law');
});

test('#86: slice n + 1 adds one term to slice n along the same paths', () => {
  const law = k.ridgeLaw('exponential');
  const rows = k.ridgeSums(law, 3, 50, 9);
  for (let r = 0; r < 50; r++) {
    const s2 = rows[1][r] * Math.sqrt(2) + 2, s3 = rows[2][r] * Math.sqrt(3) + 3;
    assert.ok(s3 - s2 > 0, 'an exponential term is positive');
  }
  assert.deepEqual(k.ridgeSums(law, 3, 50, 9), rows, 'same seed, same ridge');
});

test('#86: finite-variance sources settle; Cauchy does not and says why', () => {
  const uni = k.run({ view: 3, source: 0, nmax: 30, R: 8000 }, { seed: 11, station: 'clt' });
  assert.ok(uni.readouts.find((r) => r.key === 'settled').observed <= 6);
  const cau = k.run({ view: 3, source: 4, nmax: 30, R: 8000 }, { seed: 11, station: 'clt' });
  const ks = cau.series.find((x) => x.id === 'ks').y;
  assert.ok(ks.at(-1) > 0.3 && ks.at(-1) > ks[0], 'the Cauchy ridge drifts away from Phi');
  assert.equal(cau.readouts.find((r) => r.key === 'settled').observed, null);
  assert.match(cau.notes.join(' '), /CLT does not apply/);
});

test('#86: lattice slices (share over the step) tend to phi: the local limit theorem', () => {
  const out = k.run({ view: 3, source: 2, p: 0.3, nmax: 30, R: 8000 }, { seed: 2, station: 'clt' });
  const { x, z } = out.surface;
  const phi = (v) => Math.exp(-v * v / 2) / Math.sqrt(2 * Math.PI);
  const gap = (row) => Math.max(...row.map((v, i) => Math.abs(v - phi(x[i]))));
  assert.ok(gap(z[29]) < 0.04, `n = 30 is close to phi (${gap(z[29])})`);
  assert.ok(gap(z[0]) > gap(z[29]), 'n = 1 is further away');
  // One Bernoulli term takes two values, at -p/sigma and (1 - p)/sigma: nothing beyond one lattice step outside them.
  const sd = Math.sqrt(0.3 * 0.7);
  z[0].forEach((v, i) => { if (x[i] < -1.3 / sd - 1e-9 || x[i] > 1.7 / sd + 1e-9) assert.equal(v, 0); });
  assert.match(out.notes.join(' '), /local limit theorem/);
});

// ---------------------------------------------------------------- #88: a typed law as the source
test('#88: a typed law is a source of the LLN, the CLT and the ridge, with its formula and pdf/CDF preview', () => {
  const lln = k.run({ law: k.CUSTOM.lln, N: 5000, view: 0, custom: '3x^2 on [0, 1]' }, { seed: 4, station: 'lln' });
  close(lln.readouts.find((r) => r.key === 'final').theory, 0.75, 1e-5, 'MX of 3x^2');
  close(lln.readouts.find((r) => r.key === 'final').observed, 0.75, 0.02, 'the running mean settles at MX');
  assert.match(lln.formula[0], /3x\^\{2\}/);
  assert.deepEqual(lln.linked.series.map((s) => s.kind), ['pdf', 'cdf']);

  const clt = k.run({ law: k.CUSTOM.clt, n: 30, R: 4000, view: 0, custom: '0 1 2 | 0.2 0.5 0.3' }, { seed: 4, station: 'clt' });
  assert.match(clt.formula[0], /begin\{array\}/);
  assert.deepEqual(clt.linked.series.map((s) => s.kind), ['pmf', 'ecdf']);
  assert.ok(clt.readouts.find((r) => r.key === 'ks').observed < 0.08, 'n = 30 sums of the typed law are near normal');

  const ridge = k.run({ view: 3, source: k.CUSTOM.ridge, nmax: 12, R: 4000, custom: '0 0.5 | 0.5 0.5' }, { seed: 4, station: 'clt' });
  assert.equal(ridge.surface.y.length, 12);
  close(ridge.surface.z[11].reduce((a, v) => a + v, 0) * 0.25, 1, 0.01, 'a lattice of span 1/2 integrates to 1');
  // Built-in laws carry no preview.
  assert.equal(k.run({ law: 0, n: 5, R: 1000, view: 0 }, { seed: 4, station: 'clt' }).linked, undefined);
});

test('#88: the typed law is checked before it runs, and a lattice is found on any decimal grid', () => {
  assert.equal(k.checkText('clt', 'custom', '2x on [0, 1]'), null);
  assert.match(k.checkText('lln', 'custom', '0 1 | 0.5 0.4').message, /add up to 0\.9/);
  assert.equal(k.checkText('convolution', 'custom', 'nonsense'), null, 'other stations have no typed law');
  assert.deepEqual(k.customLaw('0 2 4 | 0.2 0.3 0.5').lattice, { origin: 0, span: 2 });
  assert.deepEqual(k.customLaw('-1 0.5 | 0.5 0.5').lattice, { origin: -1, span: 1.5 });
  assert.equal(k.customLaw('2x on [0, 1]').lattice, null);
  close(k.customLaw('-1 0 10 | 0.5 0.45 0.05').tail(2), 0.05, 1e-12, 'P(|X − MX| ≥ 2σ): only the value 10');
});
