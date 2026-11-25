// The lab speaks Russian by default (English on the EN switch). Every text a kernel computes, every lecture
// script and the scientist roster have a Russian translation; the translation keeps every formula valid TeX.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { stripLiveTex } from '../src/lectures/live-tex.mjs';
import { splitMath } from '../src/math-text.mjs';
import { choicesOf } from '../src/stations/autoplay-math.mjs';
import { kernelTexts } from './i18n-kernel-texts.mjs';
import { bareCyrillicInMath, compileDictionary, decimalComma, englishLeft, lookup, matchedKeys, translateText } from '../src/i18n/translate.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const spikes = fileURLToPath(new URL('../..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const kernels = readdirSync(spikes).filter((d) => existsSync(`${spikes}${d}/kernel.mjs`)).sort();
/** Names and abbreviations that stay in Latin letters in the Russian lab. */
const LATIN = ['ASCII', 'CSV', 'STATUM', 'LAB'];

const LOOSE_MATH = /[ₙᵢₖᵣ₀₁₂₃²³⁴⁺⁻ᵏⁿ√Σ∑∫≤≥≈σμξ̄λχφΦθ∼αβγεηρ≠∞π½δκ]/u;
/** Problems with one translated text: English left, broken TeX, Cyrillic as math italics, math outside `$…$`. */
function problems(ru, where) {
  const out = [];
  const left = englishLeft(ru, LATIN);
  if (left.length) out.push(`${where}: English left (${left.join(', ')}): ${ru}`);
  for (const part of splitMath(ru)) {
    if (!part.math) {
      if (LOOSE_MATH.test(part.value)) out.push(`${where}: formula outside $…$: ${ru}`);
      continue;
    }
    try { katex.renderToString(part.value, { throwOnError: true }); } catch (e) { out.push(`${where}: TeX error ${e.message}: ${ru}`); }
  }
  if (bareCyrillicInMath(ru).length) out.push(`${where}: Cyrillic in a formula outside \\text{}: ${ru}`);
  return out;
}

const kernelDict = (dir) => {
  const file = `${root}i18n/ru/kernels/${dir}.json`;
  return existsSync(file) ? read(file) : null;
};
const common = read(`${root}i18n/ru/kernels/_common.json`);

test('decimalComma uses the Russian decimal comma, in text and in TeX', () => {
  assert.equal(decimalComma('W = 0.5069 after 4040 tosses'), 'W = 0,5069 after 4040 tosses');
  assert.equal(decimalComma('$p = 0.5$'), '$p = 0{,}5$');
  assert.equal(decimalComma('$[0.12, 0.34]$'), '$[0{,}12; 0{,}34]$');
  assert.equal(decimalComma('$N(0,\\,1)$'), '$N(0,\\,1)$');
  assert.equal(decimalComma('between 0.1, 0.2'), 'between 0,1; 0,2');
});

test('templates translate computed text and the parts inserted into it', () => {
  const dict = compileDictionary({
    'Coverage at $n = [[1]]$: [[2]]': 'Покрытие при $n = [[1]]$: [[2]]',
    '[[1]] hits of [[2]]': '[[1]] попаданий из [[2]]',
    'normal interval': 'нормальный интервал',
  });
  assert.equal(lookup('Coverage at $n = 20$: normal interval', dict), 'Покрытие при $n = 20$: нормальный интервал');
  assert.equal(lookup('12 hits of 40', dict), '12 попаданий из 40');
  assert.equal(lookup('unknown', dict), null);
  assert.equal(translateText('$p = 0.25$', dict), '$p = 0{,}25$');
});

test('every kernel has a Russian dictionary that translates everything it shows', async () => {
  const bad = [];
  for (const dir of kernels) {
    const own = kernelDict(dir);
    if (!own) { bad.push(`${dir}: no i18n/ru/kernels/${dir}.json`); continue; }
    const dict = compileDictionary(common, own);
    const { texts, params } = await kernelTexts(dir);
    for (const text of texts) bad.push(...problems(translateText(text, dict), `${dir}: "${text}"`));
    // A choice ("Law (0 normal, 1 uniform)") stays a choice with the same values after translation.
    for (const p of params) {
      const en = choicesOf(p);
      const ru = choicesOf({ ...p, label: translateText(p.label, dict) });
      if (en && (!ru || ru.options.length !== en.options.length)) bad.push(`${dir}: choice "${p.label}" no longer parses as a choice in Russian`);
    }
  }
  assert.deepEqual(bad, []);
});

test('kernel dictionaries hold no entries that no kernel text uses', async () => {
  const stale = [];
  for (const dir of kernels) {
    const own = kernelDict(dir);
    if (!own) continue;
    const dict = compileDictionary(own);
    const used = new Set();
    const { texts } = await kernelTexts(dir);
    for (const text of texts) matchedKeys(text, dict, 0, used);
    // A text of a rare branch (a draw outside a 99.9% band) may not come up in the sweep; its entry stays
    // as long as every word of it is still written in the kernel's source.
    // The kernel and its helper modules (a parser's error messages, #90), not its tests.
    const files = readdirSync(`${spikes}${dir}`).filter((f) => f.endsWith('.mjs') && !f.includes('.test.'));
    const source = files.map((f) => readFileSync(`${spikes}${dir}/${f}`, 'utf8')).join('\n').replace(/\\\\/g, '\\').replace(/\\'/g, "'");
    const inSource = (key) => (key.replace(/\[\[\d+\]\]/g, ' ').match(/[A-Za-z]{3,}/g) ?? []).every((word) => source.includes(word));
    for (const key of Object.keys(own)) if (!key.startsWith('//') && !used.has(key) && !inSource(key)) stale.push(`${dir}: ${key}`);
  }
  assert.deepEqual(stale, []);
});

// ---------------------------------------------------------------- lectures and scientists
const lectureFiles = readdirSync(`${root}lectures`).filter((f) => /^L\d\d\.json$/.test(f)).sort();
/** The texts of a lecture script a reader sees, and the formula lines that hold words in `\text{…}`. */
function lectureTexts(script) {
  const texts = [script.title];
  const formulas = [];
  for (const s of script.steps) {
    texts.push(s.title, s.idea);
    if (s.example) texts.push(s.example);
    if (s.notes) texts.push(s.notes);
    if (s.experiment?.label) texts.push(s.experiment.label);
    // story lectures (#110): layered explanations, "what if" chips, live formula lines with words
    texts.push(...Object.values(s.layers ?? {}), ...(s.whatIf ?? []).map((w) => w.label));
    for (const line of [...(s.formula ?? []), ...(s.live ?? [])]) if (/\\text\{[^}]*[A-Za-z]{2,}/.test(line)) formulas.push(line);
  }
  return { texts, formulas };
}

test('every lecture script has a complete Russian translation with valid formulas', () => {
  const bad = [];
  for (const f of lectureFiles) {
    const file = `${root}i18n/ru/lectures/${f}`;
    if (!existsSync(file)) { bad.push(`${f}: no i18n/ru/lectures/${f}`); continue; }
    const own = read(file);
    const { texts, formulas } = lectureTexts(read(`${root}lectures/${f}`));
    for (const text of texts) {
      if (!(text in own)) { bad.push(`${f}: no translation for "${text}"`); continue; }
      bad.push(...problems(own[text], `${f}`));
    }
    for (const line of formulas) {
      if (!(line in own)) { bad.push(`${f}: no translation for formula "${line}"`); continue; }
      bad.push(...problems(`$${stripLiveTex(own[line])}$`, `${f} formula`));
    }
    const known = new Set([...texts, ...formulas]);
    for (const key of Object.keys(own)) if (!key.startsWith('//') && !known.has(key)) bad.push(`${f}: unused entry "${key}"`);
  }
  assert.deepEqual(bad, []);
});

test('every scientist has a Russian name and contribution', () => {
  const roster = read(`${root}lectures/scientists.json`).scientists;
  const ru = read(`${root}i18n/ru/scientists.json`);
  const bad = [];
  for (const s of roster) {
    const t = ru[s.slug];
    if (!t?.name || !t?.contribution) { bad.push(`${s.slug}: missing`); continue; }
    if (/[A-Za-z]{2,}/.test(t.name)) bad.push(`${s.slug}: name not in Russian`);
    bad.push(...problems(t.contribution, s.slug));
    if (t.years) bad.push(...problems(t.years, s.slug + ' years'));
  }
  for (const slug of Object.keys(ru)) if (!slug.startsWith('//') && !roster.some((s) => s.slug === slug)) bad.push(`${slug}: not in the roster`);
  assert.deepEqual(bad, []);
});
