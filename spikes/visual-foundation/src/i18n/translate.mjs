// Translation of authored and computed text (kernel output, lecture scripts) through a dictionary.
// Plain module (no imports) so that `node --test` can load it directly.
//
// A dictionary maps English text to its translation. A key may hold numbered holes `[[1]]`, `[[2]]`, …
// that stand for the parts a kernel computes (numbers, a law's name); the translation places the same
// holes wherever its grammar needs them. A hole's text is translated again on its own (so a law's name
// inserted into a sentence is translated too), numbers stay as they are.
//
//   "Relative frequency after $n = [[1]]$, first sequence": "Относительная частота после $n = [[1]]$, первая серия"

const HOLE = /\[\[(\d+)\]\]/;
const HOLES = /\[\[(\d+)\]\]/g;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Compiles one or more `{ english: translation }` objects into a lookup. Later dictionaries win on equal keys. */
export function compileDictionary(...dictionaries) {
  const exact = new Map();
  const templates = [];
  for (const dict of dictionaries)
    for (const [en, tr] of Object.entries(dict ?? {})) {
      if (typeof tr !== 'string' || en.startsWith('//')) continue;
      if (!HOLE.test(en)) {
        exact.set(en, tr);
        continue;
      }
      const parts = en.split(HOLES); // literal, hole number, literal, …
      let source = '^';
      let literal = 0;
      const order = [];
      parts.forEach((part, i) => {
        if (i % 2 === 0) {
          source += escape(part);
          literal += part.length;
        } else {
          source += '([\\s\\S]*?)';
          order.push(Number(part));
        }
      });
      templates.push({ en, re: new RegExp(source + '$'), order, tr, literal });
    }
  // The most specific template (the most fixed text) wins.
  templates.sort((a, b) => b.literal - a.literal);
  return { exact, templates, cache: new Map() };
}

/** The translation of `text`, or null when the dictionary has none. */
export function lookup(text, dict, depth = 0) {
  if (typeof text !== 'string' || !text) return null;
  const hit = dict.exact.get(text);
  if (hit != null) return hit;
  if (depth > 3) return null;
  for (const t of dict.templates) {
    const m = t.re.exec(text);
    if (!m) continue;
    const values = new Map();
    t.order.forEach((n, i) => {
      const v = m[i + 1];
      values.set(n, lookup(v, dict, depth + 1) ?? v);
    });
    return t.tr.replace(HOLES, (_, n) => values.get(Number(n)) ?? '');
  }
  return null;
}

/** Which template or exact key translates `text` (for tests: finds dictionary entries nothing uses). */
export function matchedKeys(text, dict, depth = 0, used = new Set()) {
  if (typeof text !== 'string' || !text) return used;
  if (dict.exact.has(text)) return used.add(text);
  if (depth > 3) return used;
  for (const t of dict.templates) {
    const m = t.re.exec(text);
    if (!m) continue;
    used.add(t.en);
    t.order.forEach((_, i) => matchedKeys(m[i + 1], dict, depth + 1, used));
    return used;
  }
  return used;
}

/** Splits text into alternating plain and `$…$` segments, keeping the delimiters (unlike splitMath). */
function segments(text) {
  const out = [];
  let start = 0, math = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] !== '$') continue;
    if (math) { out.push({ math: true, value: text.slice(start, i + 1) }); start = i + 1; math = false; }
    else if (text.indexOf('$', i + 1) > i + 1) { if (i > start) out.push({ math: false, value: text.slice(start, i) }); start = i; math = true; }
  }
  if (start < text.length) out.push({ math, value: text.slice(start) });
  return out;
}

/**
 * Russian number style: a decimal comma (`0,5`; in TeX `0{,}5`, which keeps the spacing of a decimal).
 * Where a comma separated numbers before, a semicolon does now (`(0{,}12;\ 0{,}34)`).
 */
export function decimalComma(text) {
  if (typeof text !== 'string' || !/\d\.\d/.test(text)) return text;
  return segments(text)
    .map(({ math, value }) => {
      if (!/\d\.\d/.test(value)) return value;
      if (math) return value.replace(/(\d)\.(?=\d)/g, '$1{,}').replace(/(?<![{\\]),(?!\})/g, ';');
      return value.replace(/(\d)\.(?=\d)/g, '$1,').replace(/(\d), (?=[−-]?\d)/g, '$1; ');
    })
    .join('');
}

/** Translates `text` with `dict`; text the dictionary does not know stays as it is. Numbers get the decimal comma. */
export function translateText(text, dict) {
  if (typeof text !== 'string' || !text) return text;
  let out = dict.cache.get(text);
  if (out != null) return out;
  out = decimalComma(lookup(text, dict) ?? text);
  if (dict.cache.size > 5000) dict.cache.clear();
  dict.cache.set(text, out);
  return out;
}

/** English words left outside `$…$` (two or more Latin letters), except the names in `allowed`. */
export function englishLeft(text, allowed = []) {
  if (typeof text !== 'string') return [];
  return segments(text)
    .filter((s) => !s.math)
    .flatMap((s) => s.value.match(/[A-Za-z][A-Za-z'’-]*[A-Za-z]/g) ?? [])
    .filter((w) => !allowed.includes(w));
}

/** Cyrillic inside a formula must sit in `\text{…}` (or `\mathrm`, `\operatorname`), or KaTeX sets it as math italics. */
export function bareCyrillicInMath(text) {
  return segments(text)
    .filter((s) => s.math)
    .map((s) => {
      let v = s.value, prev;
      do {
        prev = v;
        v = v.replace(/\\(?:text|textrm|textit|textbf|mathrm|operatorname)\s*\{[^{}]*\}/g, '');
      } while (v !== prev);
      return v;
    })
    .filter((v) => /[А-Яа-яЁё]/.test(v));
}
