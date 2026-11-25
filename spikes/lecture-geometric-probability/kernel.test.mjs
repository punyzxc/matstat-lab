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

// #90: Buffon's needle and a typed region.
import * as R from './region.mjs';
const darts = (q, seed = 1) => k.run({ ...defaults('darts'), ...q }, { seed, station: 'darts' });
const ro = (res, key) => res.readouts.find((r) => r.key === key);

test("#90 Buffon: the estimate of π converges within 4 SE, and every drawn needle crosses a line exactly when it is counted", () => {
  for (const [l, d, seed] of [[0.8, 1, 1], [0.5, 1, 2], [1, 1, 3], [0.3, 0.6, 4]]) {
    const N = 20000, res = darts({ view: 3, N, l, d }, seed);
    const p = k.buffonP(l, d);
    assert.equal(ro(res, 'cross').theory, Number(p.toPrecision(6)));
    const se = Math.PI * Math.sqrt((1 - p) / (N * p));
    assert.ok(Math.abs(ro(res, 'pi').observed - Math.PI) <= 4 * se, `l ${l} d ${d}: ${ro(res, 'pi').observed}`);
    // Independent geometry: the ends of the needle lie in different strips (or on a line) iff it crosses.
    const { needles, hits } = res.board;
    assert.equal(needles.length, k.NEEDLES);
    needles.forEach(([, cy, th], i) => {
      const y1 = cy - (l / 2) * Math.sin(th), y2 = cy + (l / 2) * Math.sin(th);
      const crosses = Math.floor(y1 / d + 1e-6) !== Math.floor(y2 / d - 1e-6) || Math.abs(y1 / d - Math.round(y1 / d)) < 1e-5;
      assert.equal(hits[i], crosses, `needle ${i}`);
    });
    const est = res.series.find((s) => s.id === 'estimate');
    assert.ok(Math.abs(est.y.at(-1) - ro(res, 'pi').observed) < 1e-4);
    assert.equal(JSON.stringify(res), JSON.stringify(darts({ view: 3, N, l, d }, seed)), 'same seed, same bytes');
  }
  const long = darts({ view: 3, l: 1.5, d: 1 });
  assert.ok(long.notes[0].includes('cut to $l = d = 1$'));
  assert.equal(ro(long, 'cross').theory, Number(k.buffonP(1, 1).toPrecision(6)));
});

test('#90 typed regions: exact areas within the grid error, hit shares within the band, darts recomputed', () => {
  const cases = [['y < x^2', 1 / 3], ['x^2 + y^2 < 1', Math.PI / 4], ['|x - 0.5| + |y - 0.5| < 0.4', 0.32], ['0.2 < x < 0.8', 0.6],
    ['y < sin(pi x)', 2 / Math.PI], ['y > x and y < 2x', 0.25], ['y < 0,5 или x > 0,5', 0.75], ['not (x < 0.3)', 0.7], ['y ≤ 2x(1 − x)', 1 / 3]];
  for (const [text, exact] of cases) {
    const N = 20000, res = darts({ view: 4, N, region: text }, 7);
    const area = ro(res, 'area').theory, err = k.prepareRegion(text).error;
    assert.ok(Math.abs(area - exact) <= err + 1e-6, `${text}: area ${area} vs ${exact} ± ${err}`);
    assert.ok(Math.abs(ro(res, 'share').observed - exact) <= 4 * Math.sqrt((exact * (1 - exact)) / N), `${text}: share`);
    assert.ok(res.formula[0].startsWith('A = \\{(x, y) \\in [0, 1]^2 : '), res.formula[0]);
    const f = k.prepareRegion(text).inside;
    res.board.darts.forEach(([x, y], i) => assert.equal(res.board.hits[i], f(x, y), `${text} dart ${i}`));
  }
  assert.equal(darts({ view: 4, region: 'y < x^2' }).formula[0], 'A = \\{(x, y) \\in [0, 1]^2 : y < x^{2}\\}');
  assert.equal(darts({ view: 4, region: '0.2 < x < 0.8' }).formula[0], 'A = \\{(x, y) \\in [0, 1]^2 : 0.2 < x < 0.8\\}');
  assert.ok(darts({ view: 4, region: 'y > 2' }).notes[0].includes('empty'));
});

test('#90 invalid regions are explained and never run; nothing typed is executed as code', () => {
  for (const bad of ['', 'x +', 'y = x', 'x + y', '(y < x) + 1', '2 > 1', 'y < (x', 'alert(1) < x', 'constructor < 1', 'x.y < 1', 'y < x;', 'sin < x', '__proto__ > x']) {
    const c = k.checkText('darts', 'region', bad);
    assert.ok(c && c.message && c.template, `${JSON.stringify(bad)} should be rejected`);
    assert.equal(c.values.reduce((s, v, i) => s.replace(`[[${i + 1}]]`, v), c.template), c.message);
    assert.throws(() => R.parseRegion(bad), R.RegionError);
  }
  // z is a coordinate of the cube (#119): the square rejects it with a reason, the cube takes it.
  assert.match(k.checkText('darts', 'region', 'y < z').message, /z needs the cube/);
  assert.equal(k.checkText('darts', 'region3', 'y < z'), null);
  for (const good of ['y < x^2', 'xy > 0.1', 'y<sinx', 'y < e^(-3x)', '√x > y', 'x² + y² ≤ 1', 'y > x and y < 2x or x > 0.9']) assert.equal(k.checkText('darts', 'region', good), null, good);
  assert.equal(k.checkText('darts', 'other', 'anything'), null);
  // Precedence: and binds tighter than or; powers are right-associative; unary minus below the power.
  const f = R.compileRegion(R.parseRegion('x < 0.1 or x > 0.5 and y > 0.5'));
  assert.equal(f(0.05, 0.1), true);
  assert.equal(f(0.7, 0.1), false);
  assert.equal(R.compileRegion(R.parseRegion('y < -x^2 + 1'))(0.5, 0.74), true);
  assert.equal(R.compileRegion(R.parseRegion('y < 2^3^0'))(0.5, 1.9), true); // 2^(3^0) = 2
  // Undefined functions leave the point outside: sqrt of a negative number.
  assert.equal(R.compileRegion(R.parseRegion('y < sqrt(x - 0.5)'))(0.25, 0.01), false);
});

test('#90 the darts station declares the new views, Buffon parameters and the region text', () => {
  const ps = k.stations.darts.params;
  assert.equal(ps.find((p) => p.key === 'view').max, 4);
  assert.deepEqual(ps.find((p) => p.key === 'l').when, { view: [3] });
  const text = k.stations.darts.texts[0];
  assert.equal(text.key, 'region');
  assert.equal(k.checkText('darts', 'region', text.default), null);
  for (const p of text.presets) assert.equal(k.checkText('darts', 'region', p), null, p);
});

// #124: Bertrand's three circles.
test('#124 every drawn chord lies on the unit circle and is lit exactly when it is longer than √3', () => {
  for (const seed of [1, 2, 3]) {
    const res = darts({ view: 2, N: 2000 }, seed);
    assert.equal(res.board.kind, 'chords');
    assert.deepEqual(res.board.circles.map((c) => c.id), ['radius', 'endpoints', 'midpoint']);
    for (const c of res.board.circles) {
      assert.equal(c.chords.length, k.CHORDS_SHOWN);
      c.chords.forEach(([x1, y1, x2, y2], i) => {
        assert.ok(Math.abs(Math.hypot(x1, y1) - 1) < 1e-5 && Math.abs(Math.hypot(x2, y2) - 1) < 1e-5, `${c.id} ${i} on the circle`);
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (Math.abs(len - Math.sqrt(3)) > 1e-4) assert.equal(c.long[i], len > Math.sqrt(3), `${c.id} chord ${i}: length ${len}`);
      });
      assert.equal(c.share, ro(res, c.id).observed);
    }
    assert.equal(res.formula.length, 3);
    assert.ok(res.formula[1].includes('\\tfrac13'));
  }
});

test('#124 with 10 000 chords per method each share lies in the predeclared 3-SE band of 1/2, 1/3, 1/4', () => {
  for (const seed of [11, 12, 13, 14]) {
    const res = darts({ view: 2, N: 10000 }, seed);
    for (const [id, exact] of [['radius', 1 / 2], ['endpoints', 1 / 3], ['midpoint', 1 / 4]]) {
      const share = res.board.circles.find((c) => c.id === id).share;
      assert.ok(Math.abs(share - exact) <= k.band3(exact, 10000), `seed ${seed} ${id}: ${share}`);
    }
    assert.equal(JSON.stringify(res), JSON.stringify(darts({ view: 2, N: 10000 }, seed)));
  }
});

// #119: the same typed region on a segment, in the square or in the cube.
test('#119 lengths and volumes by quadrature match the exact values; the share of hits sits in its band', () => {
  const cases = [
    [1, 'region1', 'x^2 < 0.5', Math.SQRT1_2],
    [1, 'region1', '|x - 0.5| < 0.2', 0.4],
    [3, 'region3', 'x^2 + y^2 + z^2 < 1', Math.PI / 6],
    [3, 'region3', 'x + y + z < 1', 1 / 6],
    [3, 'region3', 'z < x y', 1 / 4],
    [3, 'region3', 'x^2 + y^2 < z^2', Math.PI / 12],
  ];
  for (const [dim, key, region, exact] of cases) {
    const out = k.run({ view: 4, N: 20000, dim, [key]: region }, { seed: 11, station: 'darts' });
    const area = out.readouts.find((r) => r.key === 'area');
    const err = R[dim === 1 ? 'regionLength' : 'regionVolume'](R.compileRegion(R.parseRegion(region))).error;
    assert.ok(Math.abs(area.theory - exact) <= 3 * err + 1e-6, `${region}: ${area.theory} vs ${exact} (± ${err})`);
    const share = out.readouts.find((r) => r.key === 'share');
    assert.ok(Math.abs(share.observed - exact) <= k.band3(exact, 20000) + err, `${region}: share ${share.observed}`);
    assert.equal(out.board.kind, dim === 1 ? 'segment' : 'cube');
    assert.equal(out.board.darts[0].length, dim === 1 ? 2 : 3);
    assert.equal(out.board.darts.length, dim === 1 ? k.DARTS : k.DARTS_3D);
  }
});

test('#119 every drawn point is lit exactly when it is inside; the same seed gives the same hits', () => {
  const inside = R.compileRegion(R.parseRegion('x^2 + y^2 + z^2 < 1'));
  const a = k.run({ view: 4, N: 3000, dim: 3, region3: 'x^2 + y^2 + z^2 < 1' }, { seed: 9, station: 'darts' });
  a.board.darts.forEach(([x, y, z], i) => {
    // Coordinates are rounded to 6 digits for the picture; only points on the very boundary could flip.
    if (Math.abs(x * x + y * y + z * z - 1) > 1e-5) assert.equal(a.board.hits[i], inside(x, y, z), `point ${i}`);
  });
  const b = k.run({ view: 4, N: 3000, dim: 3, region3: 'x^2 + y^2 + z^2 < 1' }, { seed: 9, station: 'darts' });
  assert.deepEqual(a, b);
  const seg = k.run({ view: 4, N: 3000, dim: 1, region1: 'x < 0.3 or x > 0.9' }, { seed: 9, station: 'darts' });
  assert.deepEqual(seg.board.intervals, [[0, 0.3], [0.9, 0.1]]);
  seg.board.darts.forEach(([x], i) => assert.equal(seg.board.hits[i], x < 0.3 || x > 0.9));
  // The square keeps the #90 darts: dim 2 is the old view.
  assert.deepEqual(k.run({ view: 4, N: 3000, dim: 2, region: 'y < x^2' }, { seed: 9, station: 'darts' }).board,
    k.run({ view: 4, N: 3000, region: 'y < x^2' }, { seed: 9, station: 'darts' }).board);
});

test('#119 each space takes only its own coordinates, with a reason', () => {
  assert.match(k.checkText('darts', 'region1', 'y < x').message, /segment use x only/);
  assert.match(k.checkText('darts', 'region', 'z < x').message, /z needs the cube/);
  assert.equal(k.checkText('darts', 'region3', 'z < x'), null);
  for (const t of k.stations.darts.texts) {
    assert.equal(k.checkText('darts', t.key, t.default), null, t.default);
    for (const p of t.presets) assert.equal(k.checkText('darts', t.key, p), null, p);
  }
  assert.equal(R.regionTex(R.parseRegion('x^2 + y^2 < z^2')), 'x^{2} + y^{2} < z^{2}');
  assert.equal(R.regionTex(R.parseRegion('z < xy')), 'z < x \\cdot y');
});
