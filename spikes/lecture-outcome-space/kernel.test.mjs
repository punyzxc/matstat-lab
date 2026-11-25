// node --test spikes/lecture-outcome-space/kernel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from './kernel.mjs';

const defaults = Object.fromEntries(K.stations.events.params.map((p) => [p.key, p.default]));
const run = (over, seed = 1) => K.run({ ...defaults, ...over }, { seed, station: 'events' });
const readout = (res, key) => res.readouts.find((r) => r.key === key);
const count = (a) => a.filter(Boolean).length;

test('the outcome spaces of L1: 36 pairs of dice, 8 triples of coins, 36 cards', () => {
  const dice = K.outcomeSpace(0), coins = K.outcomeSpace(1), cards = K.outcomeSpace(2);
  assert.equal(dice.items.length, 36);
  assert.equal(new Set(dice.items.map((it) => it.parts.join())).size, 36);
  assert.equal(coins.items.length, 8);
  assert.equal(new Set(coins.items.map((it) => it.parts.join(''))).size, 8);
  assert.deepEqual(coins.items.map((it) => it.X).sort(), [0, 1, 1, 1, 2, 2, 2, 3]);
  assert.equal(cards.items.length, 36);
  assert.equal(cards.items.filter((it) => it.X === 14).length, 4, 'four aces');
  assert.equal(dice.items.filter((it) => it.X === 7).length, 6);
});

test('operations on events follow set algebra, and P = m/n', () => {
  const a = [true, true, false, false], b = [true, false, true, false];
  assert.deepEqual(K.combine(2, a, b), [true, true, true, false], 'union');
  assert.deepEqual(K.combine(3, a, b), [true, false, false, false], 'product');
  assert.deepEqual(K.combine(4, a, b), [false, false, true, true], 'complement');
  assert.deepEqual(K.combine(5, a, b), [false, true, false, false], 'difference');
  // Two dice: A = {sum ≥ 9} has 10 outcomes, B = {first die = 6} has 6, AB has 4.
  const res = run({ experiment: 0, relA: 0, a: 9, relB: 1, b: 6, op: 2 });
  assert.equal(count(res.space.inA), 10);
  assert.equal(count(res.space.inB), 6);
  assert.equal(res.space.m, 12);
  assert.equal(readout(res, 'event').theory, Number((12 / 36).toPrecision(6)));
  assert.ok(res.formula[1].includes('\\dfrac{10}{36} + \\dfrac{6}{36} - \\dfrac{4}{36} = \\dfrac{12}{36}'), res.formula[1]);
});

test('addition theorem and complement hold for every setting', () => {
  for (const experiment of [0, 1, 2]) for (const relA of [0, 1, 2]) for (const relB of [0, 1, 2]) for (const a of [0, 2, 7, 12]) for (const b of [1, 3]) {
    const r = (op) => run({ experiment, relA, a, relB, b, op }).space.m;
    assert.equal(r(2), r(0) + r(1) - r(3), `union ${experiment} ${relA} ${a} ${relB} ${b}`);
    assert.equal(r(4), run({ experiment }).space.n - r(0), 'complement');
    assert.equal(r(5), r(0) - r(3), 'difference');
  }
});

test('independence: on a 36-card deck, the rank and the suit are independent', () => {
  const res = run({ experiment: 2, relA: 1, a: 14, relB: 1, b: 4, op: 3 }); // ace and hearts
  assert.equal(res.space.m, 1);
  assert.equal(readout(res, 'independent').observed, readout(res, 'independent').theory);
  assert.match(readout(res, 'independent').convention, /independent/);
  const dep = run({ experiment: 0, relA: 0, a: 9, relB: 1, b: 6, op: 3 });
  assert.match(readout(dep, 'independent').convention, /dependent/);
});

test('trials: frequencies within a predeclared band of P (4 standard errors), deterministic, flashes from the picks', () => {
  for (const [experiment, seed] of [[0, 3], [1, 4], [2, 5]]) {
    const n = 20000, res = run({ experiment, n }, seed);
    for (const key of ['event', 'A', 'B', 'AB', 'union']) {
      const r = readout(res, key), p = r.theory;
      assert.ok(Math.abs(r.observed - p) <= 4 * Math.sqrt((p * (1 - p)) / n) + 1e-9, `${experiment} ${key}: ${r.observed} vs ${p}`);
    }
    assert.equal(res.space.flashes.length, K.FLASHES);
    assert.ok(res.space.flashes.every((k) => k >= 0 && k < res.space.n));
    const trace = res.series.find((s) => s.id === 'freq');
    assert.equal(trace.x.at(-1), n);
    assert.equal(trace.y.at(-1), readout(res, 'event').observed);
    assert.equal(JSON.stringify(res), JSON.stringify(run({ experiment, n }, seed)), 'same seed, same bytes');
    assert.notEqual(JSON.stringify(res.space.flashes), JSON.stringify(run({ experiment, n }, seed + 1).space.flashes), 'new seed, new trials');
  }
});

test('contract: aligned finite series, defaults in range, impossible and certain events explained', () => {
  for (const p of K.stations.events.params) assert.ok(p.default >= p.min && p.default <= p.max, p.key);
  const res = run({});
  for (const s of res.series) {
    assert.equal(s.x.length, s.y.length, s.id);
    assert.ok([...s.x, ...s.y].every(Number.isFinite), s.id);
  }
  assert.ok(run({ experiment: 1, relA: 0, a: 9, op: 0 }).notes.some((t) => t.includes('impossible')));
  assert.ok(run({ experiment: 1, relA: 0, a: 0, op: 0 }).notes.some((t) => t.includes('certain')));
});

// #130: the combinatorics generator.
const comb = (q, seed = 1) => K.run(q, { seed, station: 'combinatorics' });
const fact = (m) => { let r = 1n; for (let i = 2n; i <= BigInt(m); i++) r *= i; return r; };

test('#130 counts match the closed formulas for a table of cases, with exact big integers', () => {
  const table = [
    // [scheme, n, k, count]
    [0, 1, 0, 1n], [0, 4, 0, 24n], [0, 5, 0, 120n], [0, 20, 0, 2432902008176640000n], [0, 25, 0, 15511210043330985984000000n],
    [1, 4, 2, 12n], [1, 10, 3, 720n], [1, 5, 0, 1n], [1, 3, 5, 0n], [1, 25, 25, fact(25)],
    [2, 5, 2, 10n], [2, 10, 5, 252n], [2, 25, 12, 5200300n], [2, 3, 5, 0n], [2, 7, 0, 1n],
    [3, 3, 2, 9n], [3, 2, 10, 1024n], [3, 25, 25, 25n ** 25n],
    [4, 3, 2, 6n], [4, 4, 3, 20n], [4, 25, 25, 63205303218876n],
  ];
  for (const [scheme, n, k, want] of table) {
    assert.equal(K.countOf(scheme, n, k), want, `scheme ${scheme}, n ${n}, k ${k}`);
    assert.equal(comb({ scheme, n, k }).constructions.count, want.toString());
  }
  // A_n^k = C_n^k · k! and C̄_n^k = C_{n+k−1}^k on a grid.
  for (let n = 1; n <= 12; n++) for (let k = 0; k <= 12; k++) {
    assert.equal(K.countOf(1, n, k), K.countOf(2, n, k) * fact(k));
    assert.equal(K.countOf(4, n, k), K.countOf(2, n + k - 1, k));
  }
});

test('#130 small cases list every construction exactly once, in the right shape', () => {
  for (const scheme of [0, 1, 2, 3, 4]) for (let n = 1; n <= 5; n++) for (let k = 0; k <= 5; k++) {
    const N = K.countOf(scheme, n, k);
    if (N > BigInt(K.ENUMERATE_UP_TO)) continue;
    const { items, all, size, ordered, repetition } = comb({ scheme, n, k }).constructions;
    assert.ok(all);
    assert.equal(BigInt(items.length), N, `scheme ${scheme} n ${n} k ${k}`);
    assert.equal(new Set(items.map((c) => c.join())).size, items.length, 'no duplicates');
    for (const c of items) {
      assert.equal(c.length, size);
      assert.ok(c.every((o) => o >= 0 && o < n));
      if (!repetition) assert.equal(new Set(c).size, c.length, 'no repeated object');
      if (!ordered) assert.deepEqual(c, [...c].sort((p, q) => p - q), 'unordered: sorted');
    }
  }
});

test('#130 large cases show only the count and a seeded sample of valid constructions', () => {
  for (const [scheme, n, k] of [[0, 12, 0], [1, 10, 4], [2, 20, 10], [3, 6, 5], [4, 20, 10]]) {
    const a = comb({ scheme, n, k }, 4), b = comb({ scheme, n, k }, 4), c = comb({ scheme, n, k }, 5);
    const { items, all, size, ordered, repetition } = a.constructions;
    assert.equal(all, false);
    assert.equal(items.length, K.SAMPLED);
    assert.equal(a.readouts.find((r) => r.key === 'count').observed, null, 'nothing is counted by hand');
    for (const x of items) {
      assert.equal(x.length, size);
      assert.ok(x.every((o) => o >= 0 && o < n));
      if (!repetition) assert.equal(new Set(x).size, x.length);
      if (!ordered) assert.deepEqual(x, [...x].sort((p, q) => p - q));
    }
    assert.equal(JSON.stringify(a), JSON.stringify(b), 'same seed, same sample');
    assert.notEqual(JSON.stringify(a.constructions.items), JSON.stringify(c.constructions.items), 'new seed, new sample');
  }
  // Sampling covers the space: over 400 seeds every one of the 120 pairs of C_16^2 appears.
  const freq = new Map();
  for (let seed = 0; seed < 400; seed++) for (const x of comb({ scheme: 2, n: 16, k: 2 }, seed).constructions.items) freq.set(x.join(), (freq.get(x.join()) ?? 0) + 1);
  assert.equal(freq.size, 120, 'every pair of 16 appears');
});

test('#130 degenerate inputs are explained: k > n without repetition, and k = 0', () => {
  const none = comb({ scheme: 2, n: 3, k: 5 });
  assert.equal(none.constructions.items.length, 0);
  assert.ok(none.notes.some((t) => t.includes('no construction at all')));
  assert.ok(!none.formula[0].includes('= 0 = 0'));
  const empty = comb({ scheme: 1, n: 4, k: 0 });
  assert.deepEqual(empty.constructions.items, [[]]);
  assert.ok(empty.notes.some((t) => t.includes('the empty one')));
});
