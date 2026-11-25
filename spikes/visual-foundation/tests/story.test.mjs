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
test('L08 and L11 are story lectures; every story script checks against the figure specs', () => {
  assert.deepEqual(stories.map((s) => s.lecture).sort((a, b) => a - b), [8, 11]);
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
