// node --test spikes/lecture-bernoulli-approximations/kernel.test.mjs
// Issue #39 acceptance criteria, checked against the worked-examples audit fixtures and exact rational values.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as k from './kernel.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const fixtures = JSON.parse(fs.readFileSync(new URL('../lecture-worked-examples-audit/fixtures/references.json', import.meta.url)));
const ref = (id) => Object.values(fixtures).flat().find((e) => e && e.id === id);
const readout = (r, key) => r.readouts.find((x) => x.key === key);

test('#39 the binomial law is evaluated in log space and sums to 1 within 1e-12 for n up to 10⁴', () => {
  for (const n of [1, 7, 50, 500, 5000, 10000]) for (const p of [0.001, 0.01, 0.2, 0.5, 0.97]) {
    const law = k.binomialLaw(n, p);
    let s = 0;
    for (const v of law) { assert.ok(Number.isFinite(v) && v >= 0); s += v; }
    close(s, 1, 1e-12, `n ${n} p ${p}`);
  }
  // Exact rationals: P_7(5) at p = 1/2 is 21/128 (L3 step 1); C(10, 3) / 2^10 = 120/1024.
  close(k.binomialPmf(7, 0.5, 5), 21 / 128, 1e-15);
  close(k.binomialPmf(10, 0.5, 3), 120 / 1024, 1e-15);
  assert.equal(k.binomialPmf(10, 0.5, 11), 0);
});

test('#39 the most probable number follows np − q ≤ k₀ ≤ np + p, with two modes when (n + 1)p is an integer', () => {
  assert.deepEqual(k.mostProbable(5000, 0.01), [ref('L03-binomial-mode').recomputed]);
  for (const n of [1, 2, 5, 9, 10, 37, 100, 999]) for (const p of [0.05, 0.1, 0.25, 0.3, 0.5, 0.6, 0.9]) {
    const law = k.binomialLaw(n, p), top = Math.max(...law);
    const modes = law.flatMap((v, j) => (v >= top * (1 - 1e-12) ? [j] : []));
    assert.deepEqual(k.mostProbable(n, p), modes, `n ${n} p ${p}`);
    for (const m of modes) assert.ok(n * p - (1 - p) - 1e-9 <= m && m <= n * p + p + 1e-9);
  }
  assert.deepEqual(k.mostProbable(9, 0.5), [4, 5]);
});

test('#39 L3 ex. 2: exact 0.0566 and 0.5375 next to the local, plain and corrected approximations, each with its error', () => {
  const r = k.run({ n: 5000, p: 0.01, k: 50, lo: 0, hi: 50 }, { seed: 1 });
  close(readout(r, 'pk').theory, ref('L03-binomial-pmf').recomputed, 1e-6);
  close(readout(r, 'range').theory, ref('L03-binomial-cdf').recomputed, 1e-6);
  close(readout(r, 'local').theory, ref('L03-local-normal').recomputed.local_normal, 1e-6);
  close(readout(r, 'plain').theory, ref('L03-plain-normal-cdf').recomputed.plain_normal, 1e-6);
  close(readout(r, 'corrected').theory, ref('L03-plain-normal-cdf').recomputed.continuity_corrected, 1e-6);
  for (const key of ['local', 'poisson', 'plain', 'corrected']) assert.match(readout(r, key).convention, /error/);
  for (const key of ['plain', 'corrected']) assert.match(readout(r, key).convention, /CDF from \$-\\infty\$/);
  assert.match(r.formula.join(' '), /0\.5375/);
  // The typo example: P(at least one) by Poisson with λ = 0.1 is 1 − e^(−0.1) = 0.09516.
  close(1 - k.poissonPmf(0.1, 0), ref('L03-typos').recomputed.poisson, 1e-12);
});

test('#39 L9 examples: exact binomial 0.9520, 0.5307, 0.7963 next to the lecture normal answers', () => {
  for (const id of ['L09-defects', 'L09-first-grade', 'L09-guarantee']) {
    const f = ref(id), { n, lo, hi } = f.inputs, p = Number(f.inputs.p);
    const r = k.run({ n, p, lo, hi, k: lo }, { seed: 9 });
    close(readout(r, 'range').theory, f.recomputed.exact, 1e-6, id);
    close(readout(r, 'plain').theory, f.recomputed.plain_normal, 1e-6, id);
    close(readout(r, 'corrected').theory, f.recomputed.continuity_corrected, 1e-6, id);
    // Simulated series agree with the exact sum within the predeclared 4 SE band.
    const band = Number(/± ([\d.]+)/.exec(readout(r, 'range').convention)[1]);
    close(readout(r, 'range').observed, f.recomputed.exact, band + 1e-4, `${id} simulated`);
  }
});

test('#39 frequency accuracy: the normal design uses the exact quantile (13 530 for ε = 0.01, γ = 0.98, p = 0.5) beside Chebyshev', () => {
  const s = k.frequencySize(0.5, 0.01, 0.98);
  close(s.z, ref('L03-coin-size').recomputed.z_0_99, 1e-9);
  close(s.normalExact, ref('L03-coin-size').recomputed.continuous_normal_n, 1e-4);
  assert.equal(s.normal, 13530);
  assert.equal(s.chebyshev, 125000);
  const r = k.run({ view: 1, p: 0.5, eps: 0.01, gamma: 0.98, R: 4000 }, { seed: 4 });
  assert.equal(readout(r, 'normal').theory, 13530);
  close(readout(r, 'inside').observed, readout(r, 'inside').theory, 4 * Math.sqrt(0.02 * 0.98 / 4000) + 1e-3);
});

test('#115 prerequisite: Poisson wins at n = 100, p = 0.02 and the normal at n = 100, p = 0.5', () => {
  const at = (p) => k.run({ n: 100, p, k: 2, lo: 0, hi: 100 }, { seed: 1 });
  const small = at(0.02), half = at(0.5);
  assert.ok(readout(small, 'maxPoisson').theory < readout(small, 'maxLocal').theory);
  assert.ok(readout(half, 'maxLocal').theory < readout(half, 'maxPoisson').theory);
});

test('contract: seeded runs repeat byte for byte, defaults and extremes run, series are finite', () => {
  const params = k.stations.bernoulli.params;
  const cases = [{}, Object.fromEntries(params.map((p) => [p.key, p.min])), Object.fromEntries(params.map((p) => [p.key, p.max]))];
  for (const base of cases) for (const view of [0, 1]) {
    const q = { ...base, view, ...(base.p === 0.999 ? { eps: 0.2 } : {}) };
    const a = k.run(q, { seed: 42 }), b = k.run(q, { seed: 42 });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.ok(a.readouts.length && a.series.length && a.notes.length && a.formula.length);
    for (const s of a.series) { assert.equal(s.x.length, s.y.length); for (const v of [...s.x, ...s.y]) assert.ok(Number.isFinite(v), s.id); }
  }
  assert.notEqual(JSON.stringify(k.run({}, { seed: 1 }).series[0]), JSON.stringify(k.run({}, { seed: 2 }).series[0]));
  assert.equal(k.meta.id, 'lecture-bernoulli-approximations');
  assert.throws(() => k.run({ p: 0 }), /strictly between/);
});

test('#115 each machine row of n trials collapses into its own count k, and the rows repeat for a seed', () => {
  for (const [n, p] of [[7, 0.5], [40, 0.3], [100, 0.02], [5000, 0.01]]) {
    const r = k.run({ n, p, R: 500 }, { seed: 11 });
    const { rows } = r.machine;
    assert.equal(rows.length, k.MACHINE_ROWS);
    const cells = Math.min(n, k.MACHINE_CELLS);
    for (const row of rows) {
      assert.equal(row.cells.length, cells);
      close(row.cells.reduce((a, b) => a + b, 0) * (n / cells), row.k, 1e-6, `n ${n}`);
      for (const c of row.cells) assert.ok(c >= 0 && c <= 1 + 1e-9);
      if (n <= k.MACHINE_CELLS) for (const c of row.cells) assert.ok(c === 0 || c === 1);
    }
    assert.deepEqual(rows, k.run({ n, p, R: 500 }, { seed: 11 }).machine.rows);
  }
  // Positions given k are uniform: over many rows each place of 5 is a success about k/n of the time.
  const hits = new Array(5).fill(0);
  const rows = k.machineRows(new Int32Array(4000).fill(2), 5, 3, 4000);
  for (const row of rows) row.cells.forEach((c, j) => (hits[j] += c));
  for (const h of hits) close(h / 4000, 2 / 5, 4 * Math.sqrt(0.24 / 4000));
});

// #128: the exact sum, the corrected integral theorem and the simulated share meet as R grows.
test('#128 the meeting strip: exact, approximate and simulated P(lo ≤ k ≤ hi), the simulated gap shrinking with R', () => {
  const gap = (R) => {
    let s = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const m = k.run({ view: 0, n: 100, p: 0.3, k: 30, lo: 20, hi: 35, R }, { seed, station: 'bernoulli' }).meet;
      s += Math.abs(m.sim.value - m.exact.value);
    }
    return s / 12;
  };
  const out = k.run({ view: 0, n: 100, p: 0.3, k: 30, lo: 20, hi: 35, R: 4000 }, { seed: 3, station: 'bernoulli' });
  const ids = new Set(out.series.map((s) => s.id));
  for (const part of ['exact', 'approx', 'sim']) assert.ok(ids.has(out.meet[part].series), part);
  assert.equal(out.meet.exact.value, out.readouts.find((r) => r.key === 'range').theory);
  assert.equal(out.meet.approx.value, out.readouts.find((r) => r.key === 'corrected').theory);
  assert.ok(gap(20000) < gap(100) / 4, `${gap(100)} → ${gap(20000)}`);
});
