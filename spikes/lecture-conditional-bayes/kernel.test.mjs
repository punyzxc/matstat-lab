// node --test spikes/lecture-conditional-bayes/kernel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { meta, stations, run, eventGeometry, independenceCheck, MODELS, totalProbability, posteriors, checkHypotheses, guessingPosterior, BAND_Z } from './kernel.mjs';

const SEEDS = [1, 2, 3, 20261124, 4294967295];
const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const inBand = (r) => {
  assert.ok(r.band, `${r.key} has a band`);
  assert.ok(r.observed >= r.band[0] && r.observed <= r.band[1], `${r.key}: ${r.observed} outside [${r.band}]`);
};
const byKey = (out) => Object.fromEntries(out.readouts.map((r) => [r.key, r]));

test('contract shape: meta, params, stations, series kinds', () => {
  assert.equal(meta.id, 'lecture-conditional-bayes');
  assert.deepEqual(meta.lectures, ['L1', 'L2']);
  for (const p of meta.params) {
    assert.ok(p.min <= p.default && p.default <= p.max, p.key);
    assert.ok(p.step > 0, p.key);
  }
  assert.ok(stations.bayes, 'the catalog station id is bayes');
  const kinds = new Set(['pmf', 'pdf', 'cdf', 'hist', 'ecdf', 'line', 'points', 'band', 'rule']);
  for (const view of [1, 2, 3, 4]) {
    const out = run({ view }, { seed: 7, station: 'bayes' });
    assert.ok(Array.isArray(out.readouts) && Array.isArray(out.series) && Array.isArray(out.notes));
    for (const s of out.series) {
      assert.ok(kinds.has(s.kind), s.kind);
      assert.equal(s.x.length, s.y.length, s.id);
      if (s.y2) assert.equal(s.y2.length, s.x.length);
    }
    assert.ok(out.axes.x && out.axes.y, 'labelled axes');
  }
});

test('determinism: same params and seed give byte-identical output', () => {
  for (const view of [1, 2, 3, 4]) {
    const a = JSON.stringify(run({ view, n: 3000 }, { seed: 99 }));
    const b = JSON.stringify(run({ view, n: 3000 }, { seed: 99 }));
    assert.equal(a, b);
    assert.notEqual(a, JSON.stringify(run({ view, n: 3000 }, { seed: 100 })));
  }
});

test('AC1: exact P(A∪B), P(AB), P(A|B) from the geometry (independent closed form)', () => {
  // A = [0,.5]×[0,1]; B = [.3,.8]×[0,.6]; overlap in x = .2.
  const { P } = eventGeometry({ a: 0.5, s: 0.3, b: 0.5, h: 0.6, c: 0.4 });
  close(P.A, 0.5); close(P.B, 0.3); close(P.AB, 0.12); close(P.AuB, 0.68);
  close(P.AgB, 0.4); close(P.AC, 0.2);
  // B∩C = [.3,.8]×[0,.4] = .2; ABC = .2×.4 = .08
  close(P.BC, 0.2); close(P.ABC, 0.08);
  close(P.AuBuC, 0.5 + 0.3 + 0.4 - 0.12 - 0.2 - 0.2 + 0.08);
  // B sticking out of the square is clipped.
  close(eventGeometry({ a: 0.5, s: 0.9, b: 0.5, h: 1, c: 0 }).P.B, 0.1);
  // Empty B: conditional is undefined, never NaN.
  assert.equal(eventGeometry({ a: 0.5, s: 0.3, b: 0.5, h: 0, c: 0 }).P.AgB, null);
});

test('AC1: simulated counts lie inside the predeclared band', () => {
  assert.equal(BAND_Z, 4);
  for (const seed of SEEDS) {
    const r = byKey(run({ view: 1, n: 8000 }, { seed }));
    for (const k of ['pA', 'pB', 'pC', 'pAB', 'pAuB', 'pAuBuC', 'pAgB']) inBand(r[k]);
  }
  const empty = byKey(run({ view: 1, h: 0 }, { seed: 1 }));
  assert.equal(empty.pAgB.observed, null);
  assert.equal(empty.pAgB.theory, null);
});

test('AC2: Bernstein — pairwise independence holds exactly, mutual fails exactly', () => {
  const b = independenceCheck(MODELS.bernstein);
  assert.equal(b.N, 4);
  assert.deepEqual(b.counts, { A: 2, B: 2, C: 2, AB: 1, AC: 1, BC: 1, ABC: 1 });
  assert.equal(b.pairwise, true);
  assert.equal(b.tripleProduct, false); // 1/4 ≠ 1/8
  assert.equal(b.mutual, false);
  const out = byKey(run({ view: 2, model: 1 }, { seed: 5 }));
  assert.equal(out.pairwise.theory, 'yes');
  assert.equal(out.mutual.theory, 'no');
  for (const seed of SEEDS) {
    const r = byKey(run({ view: 2, model: 1, n: 8000 }, { seed }));
    for (const k of ['pA', 'pB', 'pC', 'pAB', 'pAC', 'pBC', 'pABC']) inBand(r[k]);
  }
});

test('lecture pin: a full-family product alone is not mutual independence', () => {
  const c = independenceCheck(MODELS.productOnly);
  assert.equal(c.N, 8);
  assert.equal(c.tripleProduct, true); // 1/8 = 1/2·1/2·1/2
  assert.equal(c.pairs.AB, false); // 1/2 ≠ 1/4
  assert.equal(c.mutual, false);
});

test('AC3: priors not summing to 1 are rejected, posteriors sum to 1', () => {
  assert.throws(() => checkHypotheses([0.5, 0.3, 0.3], [0.1, 0.1, 0.1]), /sum to 1\.1000/);
  assert.throws(() => totalProbability([0.5, 0.4], [1, 1]), /complete group/);
  assert.throws(() => run({ view: 3, q1: 0.5, q2: 0.5, q3: 0.2 }, { seed: 1 }), /not 1/);
  assert.throws(() => checkHypotheses([1.2, -0.2], [0.5, 0.5]), /\[0, 1\]/);
  checkHypotheses([0.1, 0.2, 0.7], [0, 0, 0]); // float sum within tolerance
  const post = posteriors([0.5, 0.3, 0.2], [0.02, 0.05, 0.1]);
  close(totalProbability([0.5, 0.3, 0.2], [0.02, 0.05, 0.1]), 0.045);
  close(post[0], 0.01 / 0.045); close(post[1], 0.015 / 0.045); close(post[2], 0.02 / 0.045);
  close(post.reduce((m, v) => m + v, 0), 1);
  for (const seed of SEEDS) {
    const r = byKey(run({ view: 3, n: 20000 }, { seed }));
    inBand(r.pA); inBand(r.post1); inBand(r.post2); inBand(r.post3);
  }
});

test('AC3: L2 die example — even face via total probability', () => {
  // Solution 2: B2 = {2}, B4 = {4}, B6 = {1,3,5,6}; P(A|B6) = 1/4.
  close(totalProbability([1 / 6, 1 / 6, 2 / 3], [1, 1, 1 / 4]), 0.5);
  // Solution 1 uses hypotheses {2},{4},{6} (Σ = 1/2); the complete group adds {1,3,5} with P(A|·) = 0.
  assert.throws(() => totalProbability([1 / 6, 1 / 6, 1 / 6], [1, 1, 1]));
  close(totalProbability([1 / 6, 1 / 6, 1 / 6, 1 / 2], [1, 1, 1, 0]), 0.5);
});

test('AC3: guessing student equals (1 − p)/(4p + 1) for m = 5', () => {
  for (const p of [0, 0.01, 0.25, 0.6, 0.99, 1]) close(guessingPosterior(p, 5), (1 - p) / (4 * p + 1), 1e-15);
  assert.equal(guessingPosterior(0, 5), 1);
  assert.equal(guessingPosterior(1, 5), 0);
  for (const seed of SEEDS) {
    const r = byKey(run({ view: 4, skill: 0.6, m: 5, n: 20000 }, { seed }));
    close(r.post.theory, 0.4 / 3.4, 1e-15);
    inBand(r.post); inBand(r.pCorrect);
  }
  const all = byKey(run({ view: 4, skill: 1, m: 5 }, { seed: 3 }));
  assert.equal(all.post.observed, 0);
});

test('per-view stations select their view regardless of the view slider', () => {
  const a = run({ view: 1 }, { seed: 4, station: 'bayes-guessing' });
  assert.equal(JSON.stringify(a), JSON.stringify(run({ view: 4 }, { seed: 4 })));
});
