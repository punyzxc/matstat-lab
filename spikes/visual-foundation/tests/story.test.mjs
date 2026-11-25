// #109 live formulas, #110 story lectures, #111 the normal factory, #112 the confidence interval wall,
// #135 clouds of estimates and the n vs n - 1 race, #138 math portals.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { splitMath } from '../src/math-text.mjs';
import { expandLiveTex, formatLive, LIVE_KATEX, liveTexKeys, snapValue } from '../src/lectures/live-tex.mjs';
import { FIGURES, figureParams } from '../src/lectures/figures/specs.mjs';
import { ksToNormal, replicate, SOURCES, zHistogram, zSample } from '../src/lectures/figures/clt-model.mjs';
import { intervalAt, wall } from '../src/lectures/figures/ci-model.mjs';
import { estimatesAt, LADDER, race, theory } from '../src/lectures/figures/est-model.mjs';
import { describe as describeSample, population, POPULATION } from '../src/lectures/figures/sample-model.mjs';
import { run as runSampling } from '../../lecture-sampling-goodness-of-fit/kernel.mjs';
import { corridor, exactTail, kBound, tailDraws, tailShare } from '../src/lectures/figures/lln-model.mjs';
import { run as runLimits } from '../../lecture-limit-theorems/kernel.mjs';
import { beamThrows, irwinHallPdf, lawDraws, overlap, sumsOf, throwStats, within } from '../src/lectures/figures/moment-model.mjs';
import { run as runMoments } from '../../lecture-random-vectors/kernel.mjs';
import { additive, chords, crossings, darts, longShare, needles, piPath, quarter, unionText } from '../src/lectures/figures/geo-model.mjs';
import { run as runDarts } from '../../lecture-geometric-probability/kernel.mjs';
import { courtCases, errorsOf, powerCurve, regionOf, rejects } from '../src/lectures/figures/test-model.mjs';
import { validateLecture } from '../src/lectures/script.ts';
import { ksBand, LAWS, standardizedSums } from '../../lecture-limit-theorems/kernel.mjs';
import { acceptanceBand, coverageAt, run as runEstimation } from '../../lecture-estimation-intervals/kernel.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const stations = [...readFileSync(root + 'src/stations/catalog.ts', 'utf8').matchAll(/id: '([a-z-]+)', name:/g)].map((m) => m[1]);
const slugs = read('lectures/scientists.json').scientists.map((s) => s.slug);
const scripts = readdirSync(root + 'lectures').filter((f) => /^L\d\d\.json$/.test(f)).map((f) => read('lectures/' + f));
const stories = scripts.filter((s) => s.story);
const typeset = (tex, display = true) => katex.renderToString(tex, { ...LIVE_KATEX, throwOnError: true, displayMode: display });

// ---------------------------------------------------------------- live formulas
test('live TeX: \\lv, \\lval and \\lres become \\htmlData groups with the current numbers', () => {
  const src = '\\dfrac{\\lv{S}{S_n} - \\lval{n}\\,\\lv{a}{a}}{\\sigma\\sqrt{\\lval{n}}} = \\lres{z}';
  const tex = expandLiveTex(src, { values: { n: 30 }, results: { z: -1.23456 }, digits: { n: 0 } });
  assert.equal(tex, '\\dfrac{\\htmlData{v=S}{S_n} - \\htmlData{v=n, role=edit}{30}\\,\\htmlData{v=a}{a}}{\\sigma\\sqrt{\\htmlData{v=n, role=edit}{30}}} = \\htmlData{v=z, role=res}{-1.235}');
  const html = typeset(tex);
  assert.match(html, /data-v="n"[^>]*data-role="edit"|data-role="edit"[^>]*data-v="n"/);
  assert.match(html, /data-v="S"/);
  assert.deepEqual([...liveTexKeys(src).values], ['n']);
  assert.deepEqual([...liveTexKeys(src).results], ['z']);
  assert.deepEqual([...liveTexKeys(src).symbols].sort(), ['S', 'a']);
  // nested: a symbol whose body holds a value
  assert.deepEqual([...liveTexKeys('\\lv{X}{X_{\\lval{n}}}').values], ['n']);
});

test('live TeX: a missing number renders as a dash, never as broken TeX', () => {
  assert.doesNotThrow(() => typeset(expandLiveTex('D = \\lres{ks}')));
  assert.equal(formatLive(null), '\\text{—}');
  assert.equal(formatLive(0.5000, 3), '0.5');
  assert.equal(formatLive(-0.0001, 2), '0');
  assert.throws(() => liveTexKeys('\\lval{n'), /unbalanced/);
  assert.throws(() => liveTexKeys('\\lval{1n}'), /bad live variable/);
});

test('live TeX trusts \\htmlData only', () => {
  assert.match(katex.renderToString('\\href{https://x.y}{a}', { ...LIVE_KATEX }), /katex-error|color:#cc0000|\\href/);
  assert.doesNotMatch(katex.renderToString('\\href{https://x.y}{a}', { ...LIVE_KATEX }), /<a href/);
});

test('typed values snap to the parameter range and step; text that is not a number is refused', () => {
  const n = { min: 1, max: 100, step: 1 }, g = { min: 0.8, max: 0.99, step: 0.01 };
  assert.equal(snapValue('37', n), 37);
  assert.equal(snapValue('37.6', n), 38);
  assert.equal(snapValue('1000', n), 100);
  assert.equal(snapValue('-5', n), 1);
  assert.equal(snapValue('0,951', g), 0.95);
  assert.equal(snapValue('.9', g), 0.9);
  assert.equal(snapValue('abc', n), null);
  assert.equal(snapValue('', n), null);
});

// ---------------------------------------------------------------- story scripts
test('the flagship lectures are stories; every story script checks against the figure specs', () => {
  const ids = stories.map((s) => s.lecture);
  for (const n of [4, 6, 7, 8, 10, 11, 12]) assert.ok(ids.includes(n), `L${n} is a story lecture`);
  const lectureSteps = Object.fromEntries(scripts.map((s) => [s.lecture, s.steps.length]));
  for (const s of scripts) assert.deepEqual(validateLecture(s, { stations, scientists: slugs, figures: FIGURES, liveKeys: liveTexKeys, lectureSteps }), [], `L${s.lecture}`);
});

test('every live line typesets with sample numbers, and story text has no Unicode look-alike math', () => {
  let lines = 0;
  for (const s of stories) {
    s.steps.forEach((step, i) => {
      for (const line of step.live ?? []) {
        lines++;
        const values = Object.fromEntries(Object.keys(FIGURES[step.figure?.id ?? 'clt-factory'].params).map((k) => [k, 1]));
        assert.doesNotThrow(() => typeset(expandLiveTex(line, { values, results: {} })), `L${s.lecture} step ${i + 1}: ${line}`);
      }
      const texts = [...Object.values(step.layers ?? {}), ...(step.whatIf ?? []).map((w) => w.label)];
      for (const t of texts)
        for (const part of splitMath(t)) {
          if (part.math) assert.doesNotThrow(() => katex.renderToString(part.value, { throwOnError: true, strict: 'error' }), `L${s.lecture} step ${i + 1}: ${part.value}`);
          else assert.doesNotMatch(part.value, /[ₙᵢᵏⁿ₀₁₂²√Σ∫σμγ]/u, `L${s.lecture} step ${i + 1}: put math between $…$`);
        }
    });
  }
  assert.ok(lines >= 12, 'the story lectures carry live formulas');
});

test('the validator rejects broken story steps', () => {
  const base = { lecture: 8, title: 'T', story: true, steps: [{ title: 'S', idea: 'I', figure: { id: 'clt-factory', beat: 'source' } }] };
  const known = { figures: FIGURES, liveKeys: liveTexKeys };
  assert.deepEqual(validateLecture(base, known), []);
  const withStep = (extra) => validateLecture({ ...base, steps: [{ ...base.steps[0], ...extra }] }, known);
  assert.ok(withStep({ figure: { id: 'nope', beat: 'source' } }).length, 'unknown figure');
  assert.ok(withStep({ figure: { id: 'clt-factory', beat: 'nope' } }).length, 'unknown beat');
  assert.ok(withStep({ figure: { id: 'clt-factory', beat: 'source', params: { n: 1000 } } }).length, 'param out of range');
  assert.ok(withStep({ live: ['\\lval{gamma}'] }).length, 'value of another figure');
  assert.ok(withStep({ live: ['\\lv{q}{q}'] }).length, 'unknown variable');
  assert.ok(withStep({ whatIf: [{ label: 'x', params: { zz: 1 } }] }).length, 'what-if sets an unknown parameter');
  assert.ok(withStep({ layers: { proof: 'x' } }).length, 'unknown layer');
  assert.ok(validateLecture({ ...base, story: false }, known).length, 'figure without story');
  assert.ok(validateLecture({ ...base, steps: [{ title: 'S', idea: 'I' }] }, known).length, 'a story starts with a figure');
});

test('figure parameters: defaults, presets and clamping', () => {
  assert.deepEqual(figureParams('clt-factory'), { n: 12, src: 1, p: 0.3 });
  assert.deepEqual(figureParams('ci-wall', { n: 500, gamma: 0.9 }), { n: 100, gamma: 0.9, law: 0, method: 0 });
  assert.equal(FIGURES['clt-factory'].station({ n: 30, src: 2, p: 0.3 }), null, 'the CLT station has no Bernoulli law');
  assert.deepEqual(FIGURES['clt-factory'].station({ n: 30, src: 1, p: 0.3 }), { station: 'clt', params: { law: 1, n: 30, R: 4000, view: 0 } });
});

// ---------------------------------------------------------------- the normal factory (#111)
test('factory: uniform and exponential sums are the CLT kernel\'s, so the figure and the station agree', () => {
  for (const [i, id] of [[0, 'uniform'], [1, 'exponential']]) {
    const mine = zSample(SOURCES[i], 7, 500, 808);
    const kernel = standardizedSums(LAWS.find((l) => l.id === id), 7, 500, 808);
    assert.deepEqual(Array.from(mine), Array.from(kernel), id);
  }
  const rep = replicate(SOURCES[1], 7, 808, 3);
  assert.ok(Math.abs(rep.z - zSample(SOURCES[1], 7, 4, 808)[3]) < 1e-12, 'one replicate equals its entry in the sample');
  assert.equal(rep.terms.length, 7);
  assert.ok(Math.abs(rep.terms.reduce((a, b) => a + b, 0) - rep.sum) < 1e-12);
});

test('factory: the same seed gives the same sums; Bernoulli terms are 0 or 1', () => {
  assert.deepEqual(Array.from(zSample(SOURCES[2], 9, 200, 5, 0.3)), Array.from(zSample(SOURCES[2], 9, 200, 5, 0.3)));
  const r = replicate(SOURCES[2], 50, 5, 0, 0.3);
  assert.ok(r.terms.every((x) => x === 0 || x === 1));
});

test('factory: standardized sums approach N(0, 1) as n grows, skewed sources more slowly', () => {
  const R = 4000, band = ksBand(R);
  const ks = (i, n, p) => ksToNormal(zSample(SOURCES[i], n, R, 808, p));
  assert.ok(ks(0, 12) < band, `uniform, n = 12: ${ks(0, 12)} < ${band}`);
  assert.ok(ks(1, 1) > 0.1, 'exponential, n = 1, is far from normal');
  assert.ok(ks(1, 100) < ks(1, 5) && ks(1, 5) < ks(1, 1), 'exponential converges');
  assert.ok(ks(2, 100, 0.3) < ks(2, 1, 0.3) / 3, 'Bernoulli converges too');
  const h = zHistogram(zSample(SOURCES[0], 12, R, 808), R);
  assert.ok(Math.abs(h.counts.reduce((a, b) => a + b, 0) - R) <= 2, 'almost every sum lies in [−4, 4]');
  assert.ok(Math.abs(Math.max(...h.density) - 0.3989) < 0.06, 'the peak is near φ(0)');
});

// ---------------------------------------------------------------- the confidence interval wall (#112)
test('wall: 1000 Student intervals cover exactly as often as the Confidence station\'s coverage run', () => {
  const o = { n: 10, gamma: 0.95, law: 0, seed: 1111 };
  const w = wall(o, 1000);
  const station = coverageAt({ n: 10, R: 1000, gamma: 0.95, law: 0, mu: 0, sigma: 1, target: 'mean', seed: 1111 }).find((m) => m.id === 't-mean');
  assert.equal(w.hits, station.hits);
  const band = acceptanceBand(1000, 0.95);
  assert.ok(w.hits >= band.lo && w.hits <= band.hi, `${w.hits} within ${band.lo} … ${band.hi}`);
});

test('wall: intervals are reproducible, centred on x̄, and narrow as n grows', () => {
  const a = intervalAt({ n: 10, gamma: 0.95, seed: 7, r: 3 }), b = intervalAt({ n: 10, gamma: 0.95, seed: 7, r: 3 });
  assert.deepEqual(a, b);
  assert.ok(Math.abs((a.lower + a.upper) / 2 - a.estimate) < 1e-12);
  assert.equal(a.hit, a.lower <= 0 && 0 <= a.upper);
  assert.ok(wall({ n: 100, gamma: 0.95, seed: 7 }, 200).meanWidth < wall({ n: 10, gamma: 0.95, seed: 7 }, 200).meanWidth / 2.5);
  assert.ok(wall({ n: 10, gamma: 0.99, seed: 7 }, 200).meanWidth > wall({ n: 10, gamma: 0.8, seed: 7 }, 200).meanWidth);
});

test('wall: a skewed law with n = 5 undercovers, and z in place of t undercovers more', () => {
  const t = wall({ n: 5, gamma: 0.95, law: 1, seed: 1111 }, 2000).coverage;
  const tNormal = wall({ n: 5, gamma: 0.95, law: 0, seed: 1111 }, 2000).coverage;
  const z = wall({ n: 5, gamma: 0.95, law: 1, method: 1, seed: 1111 }, 2000).coverage;
  assert.ok(t < 0.93, `skewed t coverage ${t}`);
  assert.ok(Math.abs(tNormal - 0.95) < 0.015, `normal t coverage ${tNormal}`);
  assert.ok(z < t, `z ${z} < t ${t}`);
});

// ---------------------------------------------------------------- #135 clouds of estimates
test('cloud: every sample drops one estimate, and the cloud tightens like sigma / sqrt(n)', () => {
  assert.deepEqual(figureParams('estimate-cloud'), { n: 5, sigma: 1, law: 0 });
  assert.deepEqual(estimatesAt({ n: 5, seed: 1111, r: 4 }), estimatesAt({ n: 5, seed: 1111, r: 4 }));
  let prev = Infinity;
  for (const n of LADDER) {
    const { sdX, meanX } = race({ n, sigma: 1, seed: 1111 }, 600);
    const th = theory(n, 1).sdX;
    assert.ok(sdX < prev, `spread falls with n: ${sdX} at n = ${n}`);
    assert.ok(Math.abs(sdX / th - 1) < 0.12, `spread ${sdX} near sigma/sqrt(n) = ${th} at n = ${n}`);
    assert.ok(Math.abs(meanX) < 4 * th / Math.sqrt(600), `cloud centred on a at n = ${n}`);
    prev = sdX;
  }
  // the cloud of a typed sigma scales with it
  assert.ok(Math.abs(race({ n: 5, sigma: 2, seed: 1111 }, 600).sdX / race({ n: 5, sigma: 1, seed: 1111 }, 600).sdX - 2) < 1e-9);
});

test('race: the same samples feed both divisors; n = 5 shows the bias -sigma^2/n, and the race equals the Estimation station', () => {
  for (const seed of [1111, 7, 2024]) {
    const r = race({ n: 5, sigma: 1, seed }, 2000), th = theory(5, 1);
    assert.ok(Math.abs(r.meanN - r.meanN1 * 4 / 5) < 1e-12, 'one sum of squares, two divisors');
    assert.ok(Math.abs(r.meanN1 - 1) < 4 * r.seN1, `divisor n - 1 mean ${r.meanN1} within 4 SE of sigma^2 (seed ${seed})`);
    assert.ok(Math.abs(r.meanN - 1 - th.bias) < 4 * r.seN1, `divisor n bias ${r.meanN - 1} near -sigma^2/n = ${th.bias} (seed ${seed})`);
    assert.ok(r.meanN < 1, 'divisor n mean below sigma^2');
  }
  const r = race({ n: 5, sigma: 1, law: 0, seed: 1111 }, 2000);
  const station = runEstimation({ n: 5, sigma: 1, law: 0, R: 2000, view: 0 }, { seed: 1111, station: 'estimation' }).readouts;
  assert.ok(Math.abs(station.find((x) => x.key === 'bias-n').observed - (r.meanN - 1)) < 1e-12);
  assert.ok(Math.abs(station.find((x) => x.key === 'bias-n1').observed - (r.meanN1 - 1)) < 1e-12);
  assert.deepEqual(FIGURES['estimate-cloud'].station({ n: 5, sigma: 1, law: 0 }), { station: 'estimation', params: { n: 5, sigma: 1, law: 0, R: 2000, view: 0 } });
});

// ---------------------------------------------------------------- L12 the hypothesis court
test('court: the critical region and exact errors of the z-test', () => {
  const right = regionOf(0.05, 1);
  assert.equal(right.lower, null);
  assert.ok(Math.abs(right.upper - 1.6449) < 1e-3);
  const two = regionOf(0.05, 0);
  assert.ok(Math.abs(two.upper - 1.96) < 1e-3 && Math.abs(two.lower + 1.96) < 1e-3);
  assert.ok(rejects(2, right) && !rejects(1, right) && rejects(-2, two) && !rejects(0, two));
  const e = errorsOf({ n: 16, d: 0.5, alpha: 0.05, tail: 1 });
  assert.ok(Math.abs(e.delta - 2) < 1e-12);
  assert.ok(Math.abs(e.power - 0.6388) < 1e-3, `power ${e.power}`);
  assert.ok(Math.abs(e.beta + e.power - 1) < 1e-12);
  const h0 = errorsOf({ n: 16, d: 0, alpha: 0.05, tail: 1 });
  assert.equal(h0.power, null);
  assert.equal(h0.beta, null);
});

test('court: a thousand verdicts are the Testing station\'s own (seed 1212), and the rates settle at alpha and the power', () => {
  const c = courtCases({ n: 16, d: 0.5, alpha: 0.05, tail: 1, seed: 1212, R: 1000 });
  assert.equal(c.h0.length, 1000);
  assert.equal(c.h1.length, 1000);
  assert.equal(c.hits0, 56);
  assert.equal(c.hits1, 660);
  const region = regionOf(0.05, 1);
  assert.equal(c.h0.filter((u) => rejects(u, region)).length, c.hits0, 'the verdicts follow the drawn region');
  assert.equal(c.h1.filter((u) => rejects(u, region)).length, c.hits1);
  assert.deepEqual(c, courtCases({ n: 16, d: 0.5, alpha: 0.05, tail: 1, seed: 1212, R: 1000 }), 'reproducible');
  assert.deepEqual(FIGURES['test-court'].station({ n: 16, a: 0.5, alpha: 0.05, tail: 1, truth: 1 }),
    { station: 'testing', params: { sigmaKnown: 1, a0: 0, mu: 0.5, sigma: 1, n: 16, alpha: 0.05, tail: 1, R: 1000, view: 0, truth: 1 } });
});

test('court: the power curve equals alpha at a0, grows with the effect and with n, and the simulation follows it', () => {
  const grid = Array.from({ length: 31 }, (_, i) => Math.round((-1.5 + i * 0.1) * 100) / 100);
  for (const n of [4, 16, 100]) {
    const c = powerCurve({ n, alpha: 0.05, tail: 1, seed: 1212, R: 400, grid });
    assert.ok(Math.abs(c.exact[grid.indexOf(0)] - 0.05) < 1e-9);
    for (let i = 1; i < grid.length; i++) assert.ok(c.exact[i] >= c.exact[i - 1] - 1e-12, 'one-sided power is monotone');
    c.simulated.forEach((p, i) => assert.ok(Math.abs(p - c.exact[i]) < 4 * Math.sqrt(c.exact[i] * (1 - c.exact[i]) / 400) + 0.01, `n ${n}, a ${grid[i]}`));
  }
  const two = powerCurve({ n: 16, alpha: 0.05, tail: 0, seed: 1212, R: 400, grid });
  assert.ok(Math.abs(two.exact[grid.indexOf(0)] - 0.05) < 1e-9);
  assert.ok(Math.abs(two.exact[grid.indexOf(-1)] - two.exact[grid.indexOf(1)]) < 1e-9, 'two-sided power is symmetric');
  const small = errorsOf({ n: 4, d: 0.5, alpha: 0.05, tail: 1 }).power, big = errorsOf({ n: 64, d: 0.5, alpha: 0.05, tail: 1 }).power;
  assert.ok(small < big);
});

// ---------------------------------------------------------------- #125 L10 the living population
test('living population: the sample is the first n members of the population and the Sample station\'s own', () => {
  for (const law of [0, 1, 2]) {
    const pop = population({ law, seed: 1010 });
    assert.equal(pop.x.length, POPULATION);
    assert.ok(pop.lift.every((u) => u > 0 && u < 1));
    for (const n of [10, 40, 1000]) {
      const d = describeSample({ law, n, seed: 1010 });
      assert.deepEqual(d.x, pop.x.slice(0, n), 'the sample flies out of the population');
      const station = Object.fromEntries(runSampling({ law, n }, { seed: 1010, station: 'sample' }).readouts.map((r) => [r.key, r]));
      assert.equal(station.mean.observed, d.mean);
      assert.equal(station.s2.observed, d.s2);
      assert.equal(station.k.observed, d.k);
      assert.equal(station.n.observed, d.sum);
      assert.ok(Math.abs(station.area.observed - d.table.area) < 1e-12);
    }
  }
});

test('living population: every portrait accounts for every observation; the same seed gives the same sample', () => {
  for (const [law, n, bins] of [[0, 40, 0], [2, 400, 0], [1, 100, 20], [0, 1000, 4]]) {
    const d = describeSample({ law, n, bins, seed: 1010 });
    assert.equal(d.sum, n, 'table counts sum to n');
    assert.deepEqual([...d.rank].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), 'ranks are a permutation');
    d.x.forEach((v, i) => {
      assert.equal(d.sorted[d.rank[i]], v, 'x_i sits at its rank in the variation series');
      const b = d.bin[i], e = d.table.edges;
      assert.ok(v >= e[b] - 1e-12 && (b === d.k - 1 ? v <= e[b + 1] + 1e-12 : v < e[b + 1]), 'x_i lies in its interval');
      assert.ok(d.slot[i] < d.table.counts[b]);
      assert.equal(d.fnAt[i], d.x.filter((y) => y <= v).length / n, 'F_n at x_i counts the observations not above it');
    });
    for (let b = 0; b < d.k; b++) {
      const slots = d.bin.map((x, i) => (x === b ? d.slot[i] : -1)).filter((j) => j >= 0).sort((p, q) => p - q);
      assert.deepEqual(slots, Array.from({ length: d.table.counts[b] }, (_, j) => j), 'each stack is filled without gaps');
    }
    assert.deepEqual(d, describeSample({ law, n, bins, seed: 1010 }), 'reproducible');
  }
  assert.notDeepEqual(describeSample({ law: 0, n: 40, seed: 1010 }).x, describeSample({ law: 0, n: 40, seed: 1011 }).x);
  // Glivenko: the largest gap shrinks as n grows
  assert.ok(describeSample({ law: 0, n: 1000, seed: 1010 }).dn < describeSample({ law: 0, n: 10, seed: 1010 }).dn);
  assert.deepEqual(FIGURES['sample-life'].station({ law: 2, n: 100, bins: 0 }), { station: 'sample', params: { law: 2, n: 100, bins: 0, digits: 0, view: 0 } });
});

// ---------------------------------------------------------------- L7 the corridor of running means
test('corridor: the tails and the paths are the LLN station\'s own', () => {
  for (const law of [0, 1, 2, 4]) {
    const draws = tailDraws({ law, seed: 707 });
    const station = runLimits({ law, k: 2, N: 2000, view: 1 }, { seed: 707, station: 'lln' }).readouts;
    assert.equal(tailShare(draws, law, 2), station.find((r) => r.key === 'exact').observed);
    for (const [N, M, eps] of [[2000, 200, 0.2], [500, 50, 0.05]]) {
      const c = corridor({ law, N, M, eps, seed: 707 });
      const corr = runLimits({ law, N, view: 2, M, eps }, { seed: 707, station: 'lln' }).readouts;
      assert.equal(c.outside.at(-1) / M, corr.find((r) => r.key === 'outside').observed, `law ${law}, N ${N}`);
      assert.equal(c.ns.at(-1), N);
    }
  }
});

test('corridor: Chebyshev bounds hold and fall; Cauchy has no bound and its share does not fall', () => {
  for (const law of [0, 1, 2, 3]) {
    for (const k of [1, 1.5, 2, 3]) assert.ok(exactTail(law, k) <= kBound(law, k) + 1e-12, `law ${law}, k ${k}`);
    const c = corridor({ law, N: 2000, M: 200, eps: 0.2, seed: 707 });
    for (let j = 1; j < c.ns.length; j++) assert.ok(c.bound[j] <= c.bound[j - 1] + 1e-15, 'the bound falls with n');
    assert.ok(c.outside.at(-1) / 200 <= c.bound.at(-1) + 2 / Math.sqrt(200), 'the share stays under the bound up to Monte Carlo error');
    assert.ok(c.outside.at(-1) < c.outside[5], 'paths gather into the corridor');
  }
  assert.equal(kBound(4, 2), null);
  const cauchy = corridor({ law: 4, N: 2000, M: 200, eps: 0.5, seed: 707 });
  assert.ok(cauchy.bound.every((b) => b === null));
  assert.ok(cauchy.outside.at(-1) / 200 > 0.5, 'Cauchy running means stay spread out');
  assert.deepEqual(corridor({ law: 2, N: 2000, M: 20, eps: 0.2, seed: 707 }), corridor({ law: 2, N: 2000, M: 20, eps: 0.2, seed: 707 }));
  assert.deepEqual(FIGURES['lln-corridor'].station({ law: 0, k: 2, N: 2000, M: 200, eps: 0.2 }, 'tail'), { station: 'lln', params: { law: 0, N: 2000, k: 2, view: 1 } });
  assert.deepEqual(FIGURES['lln-corridor'].station({ law: 2, k: 2, N: 2000, M: 200, eps: 0.2 }, 'paths'), { station: 'lln', params: { law: 2, N: 2000, view: 2, M: 200, eps: 0.2 } });
});

// ---------------------------------------------------------------- L4 darts on a board
test('darts on a board: the strips, the quarter disc, the needles and the chords are the Darts station\'s own', () => {
  const ob = (r, key) => r.readouts.find((x) => x.key === key).observed;
  const r6 = (v) => Number(v.toPrecision(6));
  for (const N of [500, 4000]) {
    for (const [a, b] of [[0.3, 0.4], [0.3, 0.85], [0.5, 0.5]]) {
      const ad = additive(darts(404, N, 1), a, b);
      assert.equal(r6(ad.mU / N), ob(runDarts({ view: 4, N, region: unionText(a, b) }, { seed: 404 }), 'share'), `a ${a}, b ${b}`);
      assert.equal(ad.mU, ad.mA + ad.mB - ad.mAB, 'the addition rule holds dart by dart');
      if (a + b <= 1) assert.equal(ad.mAB, 0, 'disjoint strips share no dart');
    }
    const q = quarter(darts(404, N, 0));
    assert.equal(r6(q.share), ob(runDarts({ view: 1, N }, { seed: 404 }), 'freq'));
    assert.equal(r6(q.pi), ob(runDarts({ view: 1, N }, { seed: 404 }), 'pi'));
    assert.equal(piPath(darts(404, N, 0), N).at(-1)[1], q.pi);
    for (const [l, d] of [[0.8, 1], [1, 1], [0.5, 2]]) {
      const c = crossings(needles(404, N, l, d)), st = runDarts({ view: 3, N, l, d }, { seed: 404 });
      assert.equal(r6(c.share), ob(st, 'cross'), `l ${l}, d ${d}`);
      assert.equal(r6(c.pi), ob(st, 'pi'));
    }
    const ch = chords(404, N), st = runDarts({ view: 2, N }, { seed: 404 });
    for (const c of ch) assert.equal(r6(longShare(c)), ob(st, c.id), c.id);
  }
  const spec = FIGURES['geo-darts'], d = figureParams('geo-darts');
  assert.deepEqual(spec.station(d, 'additive'), { station: 'darts', params: { view: 4, N: 4000 }, texts: { region: unionText(0.3, 0.4) } });
  assert.deepEqual(spec.station({ ...d, b: 0.85 }, 'additive').texts, { region: unionText(0.3, 0.85) });
  assert.deepEqual(spec.station(d, 'needle'), { station: 'darts', params: { view: 3, N: 4000, l: 0.8, d: 1 } });
  assert.deepEqual(spec.station(d, 'chords'), { station: 'darts', params: { view: 2, N: 4000 } });
});

// ---------------------------------------------------------------- L6 the centre of mass
test('centre of mass: the beam, the sigma bands and the sums are the stations\' own', () => {
  const ob = (rs, key) => rs.find((r) => r.key === key).observed;
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  for (const beam of [{ x1: -3, x2: -1, x3: 1.5, x4: 4, p1: 0.2, p2: 0.3, p3: 0.4, p4: 0.1 }, { x1: -5, x2: 0, x3: 2, x4: 5, p1: 0.6, p2: 0.1, p3: 0.2, p4: 0.3 }]) {
    const { law, hits } = beamThrows(beam, 606, 2000), st = throwStats(law, hits, 2000);
    const station = runMoments({ ...beam, n: 2000 }, { seed: 606, station: 'balance' }).readouts;
    assert.ok(Math.abs(st.mean - ob(station, 'mean')) < 1e-5, 'the sample mean of the throws');
    assert.ok(Math.abs(st.s2 - ob(station, 'variance')) < 1e-4, 'the sample variance of the throws');
    assert.ok(Math.abs(law.p.reduce((a, v) => a + v, 0) - 1) < 1e-12, 'weights are renormalised');
  }
  for (const law of [3, 4, 5]) {
    const { L, xs } = lawDraws(law, { lambda: 1, sigma: 1 }, 606, 2000);
    const station = runMoments({ law, p: 0.3, m: 10, lambda: 1, sigma: 1, a: 2, b: 2, n: 2000 }, { seed: 606, station: 'moments' }).readouts;
    for (const k of [1, 2, 3]) assert.equal(r6(within(L, xs, k).observed), ob(station, `rule${k}`), `law ${law}, ${k} sigma`);
  }
  const normal = lawDraws(5, { lambda: 1, sigma: 1 }, 606, 10);
  assert.ok(Math.abs(within(normal.L, normal.xs, 3).exact - 0.9973) < 1e-4, 'the 3 sigma rule');
  for (const m of [2, 3, 6]) {
    const sums = sumsOf(m, 5000, 606);
    const mean = sums.reduce((a, v) => a + v, 0) / sums.length;
    assert.ok(Math.abs(mean - ob(runLimits({ m, R: 5000 }, { seed: 606, station: 'convolution' }).readouts, 'mean')) < 1e-5, `m ${m}`);
    for (const z of [0.3, m / 2, m - 0.4]) assert.ok(Math.abs(overlap(m, z) - irwinHallPdf(z, m)) < 1e-4, `the overlap is the density, m ${m}, z ${z}`);
  }
  const spec = FIGURES['centre-mass'], d = figureParams('centre-mass');
  assert.deepEqual(spec.station(d, 'beam'), { station: 'balance', params: { x1: -3, x2: -1, x3: 1.5, x4: 4, p1: 0.2, p2: 0.3, p3: 0.4, p4: 0.1, n: 2000 } });
  assert.deepEqual(spec.station(d, 'sigma'), { station: 'moments', params: { law: 5, p: 0.3, m: 10, lambda: 1, sigma: 1, a: 2, b: 2, n: 2000 } });
  assert.deepEqual(spec.station({ ...d, m: 3 }, 'sums'), { station: 'convolution', params: { m: 3, R: 5000 } });
});

// ---------------------------------------------------------------- #138 math portals
test('portals: every portal target exists, opens a story step with a figure, and broken portals are reported', () => {
  const byN = Object.fromEntries(scripts.map((s) => [s.lecture, s]));
  let count = 0;
  for (const s of stories)
    s.steps.forEach((step, i) => {
      for (const p of step.portals ?? []) {
        count++;
        const target = byN[p.lecture]?.steps[p.step - 1];
        assert.ok(target, `L${s.lecture} step ${i + 1}: portal to L${p.lecture} step ${p.step} exists`);
        assert.ok(byN[p.lecture].story, `L${s.lecture} step ${i + 1}: a portal shows a live figure, so it points into a story lecture`);
      }
    });
  assert.ok(count >= 3, 'the story lectures are linked by portals');
  const base = { lecture: 8, title: 'T', story: true, steps: [{ title: 'S', idea: 'I', figure: { id: 'clt-factory', beat: 'source' } }] };
  const known = { figures: FIGURES, lectureSteps: { 8: 1, 11: 7 } };
  const withPortals = (portals) => validateLecture({ ...base, steps: [{ ...base.steps[0], portals }] }, known);
  assert.deepEqual(withPortals([{ lecture: 11, step: 7 }]), []);
  assert.match(withPortals([{ lecture: 11, step: 8 }]).join(), /does not exist/);
  assert.match(withPortals([{ lecture: 3, step: 1 }]).join(), /does not exist/);
  assert.match(withPortals([{ lecture: 8, step: 1 }]).join(), /its own lecture/);
  assert.match(withPortals([{ lecture: 11 }]).join(), /needs a lecture and a step/);
  assert.match(validateLecture({ ...base, story: false, steps: [{ title: 'S', idea: 'I', portals: [{ lecture: 11, step: 1 }] }] }, known).join(), /need "story": true/);
});

// ---------------------------------------------------------------- #134 scientist cards
test('scientist cards: every card a story step shows is in the roster, lists that lecture, and its longer text is valid', () => {
  const roster = read('lectures/scientists.json').scientists;
  let cards = 0;
  for (const s of stories)
    s.steps.forEach((step, i) => {
      for (const slug of step.scientists ?? []) {
        cards++;
        const p = roster.find((x) => x.slug === slug);
        assert.ok(p, `L${s.lecture} step ${i + 1}: ${slug} is in scientists.json`);
        assert.ok(p.lectures.includes(s.lecture), `L${s.lecture} step ${i + 1}: ${slug} lists lecture ${s.lecture}`);
        assert.ok(p.more, `L${s.lecture} step ${i + 1}: ${slug} has the longer card text`);
      }
    });
  assert.ok(cards >= 3);
  for (const p of roster.filter((x) => x.more))
    for (const part of splitMath(p.more)) if (part.math) assert.doesNotThrow(() => katex.renderToString(part.value, { throwOnError: true }), `${p.slug}: ${part.value}`);
});
