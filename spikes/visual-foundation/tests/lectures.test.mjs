// #50: every lecture script and the scientist roster follow the documented format.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { splitMath } from '../src/math-text.mjs';
import { fitPortrait, PORTRAIT, validateLecture, validateRoster } from '../src/lectures/script.ts';

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
  const big = Array.from({ length: 30 }, () => 'x'.repeat(60)).join('\n');
  const fitted = fitPortrait(big).split('\n');
  assert.equal(fitted.length, PORTRAIT.lines);
  assert.ok(fitted.every((l) => l.length === PORTRAIT.columns));
});
