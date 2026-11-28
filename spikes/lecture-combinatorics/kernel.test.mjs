// Discovery-only checks for #38. Run from this folder: node --test kernel.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BAND_Z, LECTURE_N5, binom, emptyBoxes, enumerateEmptyBoxes, fraction, hypergeometric, identicalBallsInBoxes, meta, polynomialCoefficient,
  run, stations, urnCount, urnOutcomeProbability, urnOutcomes,
} from './kernel.mjs';

const SEEDS = [1, 2, 3, 20261125, 4294967295];

/** Independent brute force: every ordered tuple of k numbers from n, then filtered or sorted per scheme. */
function bruteSamples(scheme, n, k) {
  const tuples = [];
  const cur = [];
  const rec = () => {
    if (cur.length === k) { tuples.push([...cur]); return; }
    for (let b = 0; b < n; b++) { cur.push(b); rec(); cur.pop(); }
  };
  rec();
  const distinct = (t) => new Set(t).size === t.length;
  const pool = scheme === 1 || scheme === 2 ? tuples.filter(distinct) : tuples;
  if (scheme === 0 || scheme === 1) return pool.map((t) => t.join(','));
  return [...new Set(pool.map((t) => [...t].sort((a, b) => a - b).join(',')))];
}

test('contract: meta, the urn station and run output shape', () => {
  assert.equal(meta.id, 'lecture-combinatorics');
  assert.deepEqual(meta.lectures, ['L1']);
  assert.ok(stations.urn);
  for (const view of [1, 2, 3]) {
    const out = run({ view }, { seed: 1 });
    assert.ok(Array.isArray(out.readouts) && out.readouts.length > 0);
    for (const r of out.readouts) assert.ok(r.key && r.label && r.convention, `view ${view} readout ${r.key}`);
    for (const s of out.series) assert.ok(['pmf', 'points', 'band'].includes(s.kind) && s.x.length === s.y.length);
    assert.ok(out.axes && Array.isArray(out.notes));
  }
});

test('AC1: every scheme count equals full enumeration for n ≤ 6, k ≤ 4', () => {
  let cases = 0;
  for (let scheme = 0; scheme < 4; scheme++) {
    for (let n = 1; n <= 6; n++) {
      for (let k = 0; k <= 4; k++) {
        const brute = bruteSamples(scheme, n, k);
        assert.equal(urnCount(scheme, n, k), BigInt(brute.length), `scheme ${scheme} n=${n} k=${k}`);
        if (brute.length > 0) {
          const listed = urnOutcomes(scheme, n, k).map((s) => s.join(','));
          assert.deepEqual([...listed].sort(), [...brute].sort(), `outcomes scheme ${scheme} n=${n} k=${k}`);
        }
        cases++;
      }
    }
  }
  assert.equal(cases, 120);
  // The kernel's own readout reports the enumerated count next to the exact one.
  const out = run({ view: 1, scheme: 2, n: 6, k: 3 });
  const c = out.readouts.find((r) => r.key === 'count');
  assert.deepEqual([c.observed, c.theory], [20, '20']);
});

test('AC2: combinations with repetition are C(n+k−1, k); the lecture C(n+k−1, k−1) is n identical balls in k boxes', () => {
  for (let n = 1; n <= 6; n++) for (let k = 1; k <= 4; k++) {
    assert.equal(urnCount(3, n, k), binom(n + k - 1, k));
    // Brute force of the other problem: k boxes, occupancies summing to n.
    let placements = 0;
    const rec = (box, left) => { if (box === k - 1) { placements++; return; } for (let c = 0; c <= left; c++) rec(box + 1, left - c); };
    rec(0, n);
    assert.equal(identicalBallsInBoxes(n, k), BigInt(placements), `n=${n} k=${k}`);
  }
  // They differ unless n = k: 3 draws from 2 numbers give 4 multisets; 2 identical balls in 3 boxes give 6.
  const out = run({ view: 1, scheme: 3, n: 2, k: 3 });
  const get = (key) => out.readouts.find((r) => r.key === key);
  assert.equal(get('count').theory, '4');
  assert.equal(get('cbar').theory, '4');
  assert.equal(get('lectureBoxes').theory, '6');
  assert.match(get('lectureBoxes').label, /identical balls in \$k\$ boxes/);
  // Multisets are not equally likely when drawn one at a time: their exact probabilities still sum to 1.
  for (let n = 1; n <= 6; n++) for (let k = 0; k <= 4; k++) {
    let p = 0n; const q = BigInt(n) ** BigInt(k);
    for (const s of urnOutcomes(3, n, k)) { const e = urnOutcomeProbability(3, n, k, s); assert.equal(e.q, q); p += e.p; }
    assert.equal(p, q, `n=${n} k=${k}`);
  }
});

test('AC3: the hypergeometric PMF (L1 ex. 8) sums to 1 and matches exact rationals from enumeration', () => {
  for (const [n, k, r] of [[10, 4, 4], [8, 3, 5], [12, 7, 6], [6, 6, 3], [9, 0, 4], [7, 2, 7]]) {
    const { p, q } = hypergeometric(n, k, r);
    assert.equal(p.reduce((a, b) => a + b, 0n), q, `sum n=${n} k=${k} r=${r}`);
    // Enumerate every r-subset of n numbered balls; balls 0 … k−1 are red.
    const counts = new Array(r + 1).fill(0n);
    const rec = (start, left, red) => { if (left === 0) { counts[red]++; return; } for (let b = start; b <= n - left; b++) rec(b + 1, left - 1, red + (b < k ? 1 : 0)); };
    rec(0, r, 0);
    assert.deepEqual(p, counts, `pmf n=${n} k=${k} r=${r}`);
  }
  const out = run({ view: 2, N: 10, K: 4, r: 4, s: 2 });
  assert.deepEqual(out.pmf, ['1/14', '8/21', '3/7', '4/35', '1/210']);
  assert.equal(out.readouts.find((x) => x.key === 'ps').exact, '3/7');
  assert.equal(out.readouts.find((x) => x.key === 'sum').theory, '1');
});

test('AC4: n = 5 balls in 5 boxes, empty boxes equal the lecture values and 5^5 enumeration', () => {
  const { p, q } = emptyBoxes(5, 5);
  assert.equal(q, 3125n);
  assert.deepEqual(p.map((v) => fraction(v, q)), LECTURE_N5);
  assert.deepEqual(LECTURE_N5, ['24/625', '48/125', '12/25', '12/125', '1/625']);
  assert.deepEqual(enumerateEmptyBoxes(5, 5).map(BigInt), p);
  // The general formula against enumeration for other small n, m.
  for (let n = 1; n <= 6; n++) for (let m = 1; m <= 6; m++) {
    const e = emptyBoxes(n, m);
    assert.deepEqual(enumerateEmptyBoxes(n, m).map(BigInt), e.p, `n=${n} m=${m}`);
  }
  // Polynomial coefficients over all occupancy vectors of 5 balls in 5 boxes add up to 5^5 (formula 4).
  let total = 0n;
  const occ = [];
  const rec = (box, left) => { if (box === 4) { total += polynomialCoefficient([...occ, left]); return; } for (let c = 0; c <= left; c++) { occ.push(c); rec(box + 1, left - c); occ.pop(); } };
  rec(0, 5);
  assert.equal(total, 3125n);
  const out = run({ view: 3, balls: 5, boxes: 5 });
  assert.deepEqual(out.readouts.filter((r) => r.lecture).map((r) => [r.exact, r.lecture]), LECTURE_N5.map((v) => [v, v]));
});

test('AC3/AC4: seeded frequencies stay inside the predeclared bands', () => {
  let checked = 0;
  for (const seed of SEEDS) {
    for (const params of [{ view: 2, N: 10, K: 4, r: 4, R: 5000 }, { view: 3, balls: 5, boxes: 5, R: 5000 }, { view: 1, scheme: 3, n: 3, k: 2, R: 5000 }]) {
      const out = run(params, { seed });
      const freq = out.series.find((s) => s.id === 'freq');
      const b = out.series.find((s) => s.id === 'band');
      if (b) b.x.forEach((x, j) => { const f = freq.y[freq.x.indexOf(x)]; assert.ok(f >= b.y[j] && f <= b.y2[j], `seed ${seed} ${JSON.stringify(params)} x=${x}: ${f}`); checked++; });
      for (const r of out.readouts) if (r.band) { assert.ok(r.observed >= r.band[0] && r.observed <= r.band[1], `seed ${seed} ${r.key}`); checked++; }
    }
  }
  assert.ok(checked > 50);
  assert.equal(BAND_Z, 4);
});

test('AC5: same params and seed give byte-identical JSON; no Math.random, no DOM', () => {
  for (const params of [{ view: 1 }, { view: 1, scheme: 1, n: 5, k: 3 }, { view: 2 }, { view: 3, balls: 7, boxes: 4 }]) {
    assert.equal(JSON.stringify(run(params, { seed: 42 })), JSON.stringify(run(params, { seed: 42 })));
  }
  assert.notEqual(JSON.stringify(run({ view: 3 }, { seed: 1 })), JSON.stringify(run({ view: 3 }, { seed: 2 })));
  const src = readFileSync(new URL('./kernel.mjs', import.meta.url), 'utf8');
  assert.ok(!/Math\.random|document\.|window\./.test(src));
});
