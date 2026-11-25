// node --test spikes/lecture-geometric-probability/kernel.test.mjs
// Issue #40 acceptance criteria: exact prefix counts, predeclared 3-SE bands, exact measures,
// the three Bertrand answers, and byte-identical reruns.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as k from './kernel.mjs';
import { fixtureUint32 } from '../simulation-engine/engine.mjs';

const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;
const defaults = (station) => Object.fromEntries(k.stations[station].params.map((p) => [p.key, p.default]));

test('AC1: the relative-frequency series equals prefix counts recomputed independently', () => {
  const p = 0.3, N = 3000, seed = 4040;
  const { ns, counts } = k.frequencyRuns(p, N, seed);
  for (let j = 0; j < counts.length; j++) {
    let c = 0, kk = 0;
    for (let i = 1; i <= N; i++) {
      if (uni(seed, 10 + j, i) < p) c++;
      if (i === ns[kk]) { assert.equal(counts[j][kk], c, `path ${j} at n = ${i}`); kk++; }
    }
    assert.equal(kk, ns.length);
  }
  const r = k.run({ p, N }, { seed, station: 'frequency' });
  const path0 = r.series.find((s) => s.id === 'path0');
  path0.y.forEach((y, i) => assert.equal(y, counts[0][i] / ns[i]));
});

test('AC1: final frequencies fall inside the predeclared band p ± 3√(p(1 − p)/n)', () => {
  let inside = 0, total = 0;
  for (const p of [0.1, 0.5, 0.85]) for (const seed of [1, 2, 3, 4040]) {
    const { counts } = k.frequencyRuns(p, 10000, seed);
    for (const row of counts) { total++; if (Math.abs(row.at(-1) / 10000 - p) <= k.band3(p, 10000)) inside++; }
  }
  // Each check fails with probability 0.0027; 60 checks: allow at most one miss.
  assert.ok(inside >= total - 1, `${inside} of ${total}`);
});

test('AC2: the sin² example has exact measure 1/2 and seeded throws agree within the band', () => {
  // Independent check of the region: Riemann sum of the indicator over [0, π].
  let s = 0;
  const M = 1_000_000;
  for (let i = 0; i < M; i++) if (k.sinHit((Math.PI * (i + 0.5)) / M)) s++;
  assert.ok(Math.abs(s / M - 0.5) < 1e-5);
  for (const seed of [404, 7, 2048]) {
    const r = k.run({ view: 0, N: 20000 }, { seed, station: 'darts' });
    const f = r.readouts.find((x) => x.key === 'freq');
    assert.equal(f.theory, 0.5);
    assert.ok(Math.abs(f.observed - 0.5) <= k.band3(0.5, 20000), `seed ${seed}: ${f.observed}`);
  }
});

test('AC2: the quarter disc in [0, 1]² has measure π/4 and throws agree within the band', () => {
  for (const seed of [1, 404]) {
    const r = k.run({ view: 1, N: 20000 }, { seed, station: 'darts' });
    const f = r.readouts.find((x) => x.key === 'freq');
    assert.ok(Math.abs(f.observed - Math.PI / 4) <= k.band3(Math.PI / 4, 20000));
    for (const s of r.series.filter((s) => s.kind === 'points')) assert.ok(s.x.length <= 1500);
  }
});

test('AC3: the three Bertrand schemes converge to 1/2, 1/3 and 1/4, and no single answer is endorsed', () => {
  // The schemes' events, checked against their exact geometry on a fine grid of u.
  const M = 600000;
  for (const s of k.BERTRAND) {
    let c = 0;
    for (let i = 0; i < M; i++) if (s.long((i + 0.5) / M, 0)) c++;
    assert.ok(Math.abs(c / M - s.exact) < 1e-5, `${s.id}: ${c / M}`);
  }
  assert.deepEqual(k.BERTRAND.map((s) => s.exact), [1 / 2, 1 / 3, 1 / 4]);
  const r = k.run({ view: 2, N: 20000 }, { seed: 1889, station: 'darts' });
  for (const s of k.BERTRAND) {
    const x = r.readouts.find((y) => y.key === s.id);
    assert.ok(Math.abs(x.observed - s.exact) <= k.band3(s.exact, 20000), `${s.id}: ${x.observed}`);
  }
  assert.ok(r.notes.some((n) => /None of them is "the" answer/.test(n)));
  assert.ok(!r.readouts.some((x) => /answer/i.test(x.label)));
});

test('AC4 and contract: identical params and seed give byte-identical output; extremes are finite', () => {
  for (const [id, { params }] of Object.entries(k.stations)) {
    const cases = [defaults(id), Object.fromEntries(params.map((p) => [p.key, p.min])), Object.fromEntries(params.map((p) => [p.key, p.max]))];
    const views = id === 'darts' ? [0, 1, 2] : [undefined];
    for (const base of cases) for (const view of views) {
      const p = view == null ? base : { ...base, view };
      const a = JSON.stringify(k.run(p, { seed: 9, station: id })), b = JSON.stringify(k.run(p, { seed: 9, station: id }));
      assert.equal(a, b, `${id} ${JSON.stringify(p)}`);
      const out = JSON.parse(a);
      assert.ok(out.readouts.length && out.series.length && out.notes.length);
      for (const s of out.series) {
        assert.equal(s.x.length, s.y.length, `${id}/${s.id}`);
        for (const v of [...s.x, ...s.y, ...(s.y2 ?? [])]) assert.ok(Number.isFinite(v), `${id}/${s.id}`);
      }
    }
  }
  assert.notEqual(JSON.stringify(k.run({ view: 2, N: 500 }, { seed: 1, station: 'darts' })), JSON.stringify(k.run({ view: 2, N: 500 }, { seed: 2, station: 'darts' })));
  assert.equal(k.meta.id, 'lecture-geometric-probability');
});
