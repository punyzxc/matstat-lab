import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateLecture } from '../visual-foundation/src/lectures/script.ts';
import katex from '../visual-foundation/node_modules/katex/dist/katex.mjs';
import { splitMath } from '../visual-foundation/src/math-text.mjs';

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const manifest = read('../lecture-worked-examples-audit/fixtures/source-manifest.json');
const references = read('../lecture-worked-examples-audit/fixtures/references.json').values;
const catalog = readFileSync(new URL('../visual-foundation/src/stations/catalog.ts', import.meta.url), 'utf8');
const stations = [...catalog.matchAll(/id: '([a-z-]+)', name:/g)].map(m => m[1]);
const scripts = () => Array.from({ length: 6 }, (_, i) => read(`scripts/L0${i + 4}.json`));

test('six Russian, host-compatible scripts retain explicit source coverage and class questions', () => {
  assert.deepEqual(readdirSync(new URL('scripts/', import.meta.url)).sort(), ['L04.json','L05.json','L06.json','L07.json','L08.json','L09.json']);
  for (const s of scripts()) {
    assert.deepEqual(validateLecture(s, { stations }), [], `L${s.lecture}`);
    assert.equal(s.status, 'draft', 'research proposal must not promote the shipped script');
    assert.match(s.title, /[А-Яа-я]/u);
    assert.ok(s.checks.length >= 2 && s.checks.length <= 3);
    for (const q of s.checks) assert.ok(q.question && q.answer);
    const pages = new Set();
    const ids = new Set();
    for (const step of s.steps) {
      assert.ok(step.id && !ids.has(step.id)); ids.add(step.id);
      assert.match(step.idea, /[А-Яа-я]/u);
      assert.ok(step.source.pages.length && step.source.items.length);
      for (const page of step.source.pages) pages.add(page);
      assert.ok(step.formula?.length, `${step.id}: a mathematical teaching step needs a formula`);
    }
    for (const skip of s.skipped) {
      assert.ok(skip.items.length && skip.reason);
      for (const page of skip.pages) pages.add(page);
    }
    const count = manifest.lectures.find(l => l.lecture === `L0${s.lecture}`).pages;
    assert.deepEqual([...pages].sort((a,b)=>a-b), Array.from({ length: count }, (_, i) => i+1));
    const covered = new Set(s.steps.flatMap(step => step.auditIds ?? []));
    for (const ref of references.filter(r => r.lecture === `L0${s.lecture}`))
      assert.ok(covered.has(ref.id), `${ref.id} needs an explicit step (not an implicit omission)`);
  }
});

test('every proposed experiment is a real unclamped kernel preset and replays its full recorded readouts', async () => {
  const evidence = read('evidence.json');
  let count = 0;
  for (const s of scripts()) for (const step of s.steps) {
    if (!step.experiment) continue;
    const exp = step.experiment;
    const record = evidence.presets[step.id];
    assert.ok(record, `${step.id}: missing expected readouts`);
    assert.deepEqual(record.experiment, exp);
    const mod = await import(new URL(`../${record.kernel}/kernel.mjs`, import.meta.url));
    const kernel = mod.default ?? mod;
    const declared = kernel.stations?.[exp.station]?.params ?? kernel.meta.params;
    const params = Object.fromEntries(declared.map(p => [p.key, p.default]));
    for (const [key, value] of Object.entries(exp.params)) {
      const p = declared.find(p => p.key === key);
      assert.ok(p, `${step.id}: unknown parameter ${key}`);
      assert.ok(Number.isFinite(value) && value >= p.min && value <= p.max);
      const grid = (value-p.min)/p.step;
      assert.ok(Math.abs(grid-Math.round(grid)) < 1e-7 || value === p.max);
      params[key] = value;
    }
    const result = kernel.run(params, { station: exp.station, seed: exp.seed });
    assert.deepEqual(JSON.parse(JSON.stringify(result.readouts)), record.readouts, `${step.id}: frozen JSON expected readouts`);
    const hash = createHash('sha256').update(JSON.stringify(result)).digest('hex');
    assert.equal(hash, record.sha256, `${step.id}: full seeded kernel payload changed`);
    assert.ok(record.readouts.length && step.expected, 'student-facing expectation is explicit');
    count++;
  }
  assert.ok(count >= 12, 'each lecture block has concrete experiments');
  assert.equal(Object.keys(evidence.presets).length, count);
});

test('three-sigma, Poisson tails, Phi conventions and exact binomial corrections stay explicit', () => {
  const all = scripts().map(s => JSON.stringify(s)).join('\n');
  for (const marker of ['0.997300','0.002699','0.00135','0.951972','0.530659','0.796266','0.92135','0.7888'])
    assert.ok(all.includes(marker), `correction ${marker} is stated in the teaching script`);
  assert.match(all, /Коши/);
  assert.match(all, /независим/);
  assert.match(all, /erf/);
});

test('all display and inline formulas render with the actual host KaTeX settings', () => {
  let count = 0;
  const check = (formula, id) => {
    assert.doesNotThrow(() => katex.renderToString(formula, { throwOnError: true, strict: 'error', displayMode: true }), `${id}: ${formula}`);
    count++;
  };
  for (const s of scripts()) {
    for (const step of s.steps) {
      for (const line of step.formula) check(line,step.id);
      for (const field of ['title','idea','example','notes','expected'])
        for (const part of splitMath(step[field] ?? '')) if (part.math) check(part.value,step.id);
    }
    for (const q of s.checks) for (const field of ['question','answer'])
      for (const part of splitMath(q[field])) if (part.math) check(part.value,`L${s.lecture} question`);
  }
  assert.ok(count > 100);
});
