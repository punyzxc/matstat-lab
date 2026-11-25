// #50: every lecture script and the scientist roster follow the documented format.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { splitMath } from '../src/math-text.mjs';
import { fitPortrait, PORTRAIT, PORTRAIT_LIMIT, portraitScale, revealFrames, revealPortrait, validateLecture, validateRoster, usesStory, experimentForStep, storyText } from '../src/lectures/script.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const roster = read('lectures/scientists.json');
const slugs = roster.scientists.map((s) => s.slug);
const stations = [...readFileSync(root + 'src/stations/catalog.ts', 'utf8').matchAll(/id: '([a-z-]+)', name:/g)].map((m) => m[1]);
const files = readdirSync(root + 'lectures').filter((f) => /^L\d\d\.json$/.test(f)).sort();

test('there is one script per lecture, L01 to L12', () => {
  assert.deepEqual(files, Array.from({ length: 12 }, (_, i) => `L${String(i + 1).padStart(2, '0')}.json`));
});

test('every script is valid and references known stations and scientists', () => {
  assert.ok(stations.includes('urn') && stations.includes('distribution'), 'station ids were read from the catalog');
  for (const f of files) {
    const script = read('lectures/' + f);
    assert.deepEqual(validateLecture(script, { stations, scientists: slugs }), [], f);
    assert.equal(`L${String(script.lecture).padStart(2, '0')}.json`, f, `${f}: lecture number matches the file name`);
  }
});

test('every formula line and every $…$ in the text is valid TeX that KaTeX typesets', () => {
  let formulas = 0;
  for (const f of files) {
    const script = read('lectures/' + f);
    const check = (tex, where) => {
      formulas++;
      assert.doesNotThrow(() => katex.renderToString(tex, { throwOnError: true, strict: 'error', displayMode: true }), `${f} ${where}: ${tex}`);
      assert.doesNotMatch(tex, /[ₙᵢᵏⁿ₀₁₂²√Σ∫]/u, `${f} ${where}: write TeX (x_i, x^2, \\sqrt, \\sum), not Unicode look-alikes`);
    };
    script.steps.forEach((s, i) => {
      for (const line of s.formula ?? []) check(line, `step ${i + 1} formula`);
      for (const key of ['title', 'idea', 'example', 'notes'])
        for (const part of splitMath(s[key] ?? '')) if (part.math) check(part.value, `step ${i + 1} ${key}`);
    });
  }
  assert.ok(formulas >= 44, 'the lectures carry their formulas');
});

test('story beat labels, layers and what-if chips carry valid math in both languages', () => {
  let checked = 0;
  for (const file of files) {
    const script = read('lectures/' + file);
    const texts = [
      ...(script.beats ?? []).map(beat => beat.label),
      ...script.steps.flatMap(step => [...Object.values(step.layers ?? {}), ...(step.whatIf ?? []).map(chip => chip.label)]),
    ];
    for (const text of texts) for (const value of typeof text === 'string' ? [text] : [text.en, text.ru]) {
      assert.ok(value.trim());
      for (const part of splitMath(value)) if (part.math) {
        assert.doesNotThrow(() => katex.renderToString(part.value, { throwOnError: true, strict: 'error' }), `${file}: ${part.value}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, 'the CLT story includes its mathematical definitions');
});

test('the validator reports broken scripts', () => {
  const ok = { lecture: 3, title: 'T', steps: [{ title: 'S', idea: 'I' }] };
  assert.deepEqual(validateLecture(ok), []);
  assert.ok(validateLecture({ ...ok, lecture: 13 }).length);
  assert.ok(validateLecture({ ...ok, steps: [] }).length);
  assert.ok(validateLecture({ ...ok, steps: [{ title: 'S' }] }).length);
  const exp = (experiment) => validateLecture({ ...ok, steps: [{ title: 'S', idea: 'I', experiment }] }, { stations });
  assert.deepEqual(exp({ station: 'urn', seed: 7, params: { n: 5 } }), []);
  assert.ok(exp({ station: 'nowhere' }).length, 'unknown station');
  assert.ok(exp({ station: 'urn', seed: -1 }).length, 'negative seed');
  assert.ok(exp({ station: 'urn', seed: 4294967296 }).length, 'seed out of range');
  assert.ok(exp({ station: 'urn', params: { n: 'five' } }).length, 'text parameter');
  assert.ok(exp({ station: 'urn', params: { lecture: 1 } }).length, 'reserved parameter');
  assert.ok(validateLecture({ ...ok, steps: [{ title: 'S', idea: 'I', scientists: ['nobody'] }] }, { scientists: slugs }).length);
});

test('the roster lists every scientist the lectures name, with name, years, lectures and contribution', () => {
  assert.deepEqual(validateRoster(roster), []);
  for (const f of files) {
    const script = read('lectures/' + f);
    const named = new Set([...(script.scientists ?? []), ...script.steps.flatMap((s) => s.scientists ?? [])]);
    for (const slug of named) {
      const entry = roster.scientists.find((s) => s.slug === slug);
      assert.ok(entry, `${f}: ${slug} is in the roster`);
      assert.ok(entry.lectures.includes(script.lecture), `${slug} lists lecture ${script.lecture}`);
    }
  }
});

test('every scientist has a portrait slot file and the folder has a README', () => {
  for (const slug of slugs) assert.ok(existsSync(root + `public/portraits/${slug}.txt`), slug);
  assert.match(readFileSync(root + 'public/portraits/README.md', 'utf8'), /40 columns × 20 lines/);
});

test('portraits are fitted to the slot; empty files and HTML fallbacks become placeholders', () => {
  assert.equal(fitPortrait(''), null);
  assert.equal(fitPortrait('  \n\n'), null);
  assert.equal(fitPortrait(null), null);
  assert.equal(fitPortrait('<!doctype html><html></html>'), null);
  assert.equal(fitPortrait('﻿ /\\\r\n(oo)\r\n'), ' /\\\n(oo)');
  // #98: art wider or taller than the slot keeps every line whole and is scaled down to fit, never wrapped.
  const big = Array.from({ length: 30 }, () => 'x'.repeat(60)).join('\n');
  const fitted = fitPortrait(big);
  assert.equal(fitted, big);
  const { columns, lines, scale } = portraitScale(fitted);
  assert.deepEqual([columns, lines], [60, 30]);
  assert.equal(scale, Math.min(PORTRAIT.columns / 60, PORTRAIT.lines / 30));
  assert.ok(columns * scale <= PORTRAIT.columns && lines * scale <= PORTRAIT.lines);
  assert.equal(portraitScale('ab\ncd').scale, 1, 'small art is never enlarged');
  // A pasted log is cut at a sane limit so the page never freezes.
  const huge = fitPortrait(Array.from({ length: 500 }, () => 'y'.repeat(1000)).join('\n')).split('\n');
  assert.equal(huge.length, PORTRAIT_LIMIT.lines);
  assert.ok(huge.every((l) => l.length === PORTRAIT_LIMIT.columns));
});

test('the typewriter reveal sweeps in without shifting the art and ends on the art itself', () => {
  const art = ' .---.\n( o o )\n |   |';
  const frames = revealFrames(art);
  assert.equal(revealPortrait(art, 0).replace(/\s/g, ''), '');
  assert.equal(revealPortrait(art, frames), art);
  let shown = 0;
  for (let k = 0; k <= frames; k++) {
    const r = revealPortrait(art, k);
    r.split('\n').forEach((line, i) => Array.from(line).forEach((ch, c) => ch !== ' ' && assert.equal(ch, Array.from(art.split('\n')[i])[c], 'never shifted')));
    const count = r.replace(/\s/g, '').length;
    assert.ok(count >= shown, 'only grows');
    shown = count;
  }
});


test('story helpers preserve legacy scripts and resolve beat overrides without mutation', () => {
  for (const f of files) {
    const { beats, ...script } = read('lectures/' + f);
    script.steps = script.steps.map(({ layers, whatIf, ...step }) => step);
    assert.equal(usesStory(script), false, `${f}: the legacy shape stays on the old player`);
  }
  const legacy = { lecture: 1, title: 'T', steps: [{ title: 'S', idea: 'I', experiment: { station: 'urn', params: { n: 5 } } }] };
  assert.equal(usesStory(legacy), false);
  assert.equal(experimentForStep(legacy, 0), null);
  assert.equal(experimentForStep(legacy, 2), null);
  const oldExperiment = experimentForStep(legacy, 1);
  oldExperiment.params.n = 10;
  assert.equal(legacy.steps[0].experiment.params.n, 5);
  const story = { ...legacy, beats: [{ id: 'first', step: 1, label: { en: 'Try', ru: 'Попробовать' }, experiment: { station: 'urn', params: { n: 8 } } }] };
  assert.equal(usesStory(story), true);
  const override = experimentForStep(story, 1);
  assert.equal(override.params.n, 8);
  override.params.n = 3;
  assert.equal(story.beats[0].experiment.params.n, 8);
  assert.equal(usesStory({ ...legacy, steps: [{ ...legacy.steps[0], layers: {} }] }), true);
  assert.equal(usesStory({ ...legacy, steps: [{ ...legacy.steps[0], whatIf: [] }] }), true);
  assert.equal(storyText('same', 'ru'), 'same');
  assert.equal(storyText({ en: 'Hello', ru: 'Привет' }, 'en'), 'Hello');
  assert.equal(storyText({ en: 'Hello', ru: 'Привет' }, 'ru'), 'Привет');
});

test('story fields validate bilingual text, references, numbers and malformed structures', () => {
  const base = { lecture: 1, title: 'T', steps: [{ title: 'S', idea: 'I' }] };
  const validate = (patch) => validateLecture({ ...base, ...patch }, { stations });
  const step = (patch) => validate({ steps: [{ ...base.steps[0], ...patch }] });
  const goodBeat = { id: 'one', step: 1, label: { en: 'Try', ru: 'Попробовать' }, experiment: { station: 'urn', seed: 4294967295, params: { n: 2 } } };
  assert.deepEqual(validate({ beats: [goodBeat], steps: [{ ...base.steps[0], layers: { intuition: 'Think', formula: { en: 'Formula', ru: 'Формула' } }, whatIf: [{ label: 'Try', params: { n: 3 }, seed: 0 }] }] }), []);
  for (const beats of [null, {}, [null], [[]], [{ ...goodBeat, label: { en: 'Yes', ru: '' } }], [{ ...goodBeat, step: 0 }], [{ ...goodBeat, step: 2 }], [goodBeat, goodBeat], [{ ...goodBeat, experiment: null }], [{ ...goodBeat, experiment: { station: 'missing' } }], [{ ...goodBeat, experiment: { station: 'urn', seed: Infinity } }], [{ ...goodBeat, experiment: { station: 'urn', params: null } }], [{ ...goodBeat, experiment: { station: 'urn', seed: null } }]]) {
    assert.ok(validate({ beats }).length, JSON.stringify(beats));
  }
  assert.ok(validate({ beats: [goodBeat, { ...goodBeat, id: 'two' }] }).length, 'duplicate step');
  for (const layers of [null, [], { extra: 'x' }, { intuition: null }, { intuition: { en: 'x' } }]) assert.ok(step({ layers }).length, JSON.stringify(layers));
  for (const whatIf of [null, {}, [null], [[]], [{ label: '', params: {} }], [{ label: 'x', params: null }], [{ label: 'x', params: { 'bad-name': 1 } }], [{ label: 'x', params: { seed: 1 } }], [{ label: 'x', params: { n: NaN } }], [{ label: 'x', params: {}, seed: -1 }]]) assert.ok(step({ whatIf }).length, JSON.stringify(whatIf));
});
