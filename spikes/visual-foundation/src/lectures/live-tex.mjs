// Live formulas (#109): TeX with three macros that tie a formula to a live experiment.
//   \lv{key}{tex}  a symbol bound to variable `key` (coloured, hover lights up the figure)
//   \lval{key}     the current value of parameter `key`, editable in place
//   \lres{key}     a computed result `key`, animated when it changes
// expandLiveTex turns them into KaTeX \htmlData groups, which render as <span data-v="key" …>.
// Pure module: no DOM, so `node --test` can load it.

/** Reads a balanced {…} group starting at `i` (which must be '{'). Returns [content, indexAfter]. */
function group(src, i) {
  if (src[i] !== '{') throw new SyntaxError(`expected "{" at ${i} in ${src}`);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { j++; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return [src.slice(i + 1, j), j + 1];
  }
  throw new SyntaxError(`unbalanced braces in ${src}`);
}
const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;
const MACRO = /\\(lv|lval|lres)(?![A-Za-z])/g;

/** Every variable key a live formula refers to, by role. */
export function liveTexKeys(src) {
  const out = { symbols: new Set(), values: new Set(), results: new Set() };
  walk(src, (kind, key, body) => {
    (kind === 'lv' ? out.symbols : kind === 'lval' ? out.values : out.results).add(key);
    if (body) for (const [k, set] of Object.entries(liveTexKeys(body))) for (const v of set) out[k].add(v);
    return '';
  });
  return out;
}

function walk(src, emit) {
  let out = '', last = 0;
  MACRO.lastIndex = 0;
  for (let m; (m = MACRO.exec(src)); ) {
    const kind = m[1];
    let i = m.index + m[0].length;
    while (src[i] === ' ') i++;
    const [key, afterKey] = group(src, i);
    if (!KEY.test(key)) throw new SyntaxError(`bad live variable "${key}" in ${src}`);
    let body = null, end = afterKey;
    if (kind === 'lv') {
      let k = afterKey;
      while (src[k] === ' ') k++;
      [body, end] = group(src, k);
    }
    out += src.slice(last, m.index) + emit(kind, key, body);
    last = end;
    MACRO.lastIndex = end;
  }
  return out + src.slice(last);
}

/** Number format: `digits` decimals; results drop trailing zeros, parameter values keep them (0.80). */
export function formatLive(value, digits = 3, trim = true) {
  if (value == null || !Number.isFinite(value)) return '\\text{—}';
  let fixed = Math.abs(value) >= 1e5 ? Math.round(value).toString() : value.toFixed(digits);
  if (trim && fixed.includes('.')) fixed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  if (/^-0(\.0*)?$/.test(fixed)) fixed = fixed.slice(1);
  return fixed;
}

/**
 * Expands the macros. `values` and `results` map keys to numbers; `digits` maps keys to decimals.
 * Missing numbers render as a dash, so a formula never breaks while an experiment is warming up.
 */
export function expandLiveTex(src, { values = {}, results = {}, digits = {} } = {}) {
  return walk(src, (kind, key, body) => {
    if (kind === 'lv') return `\\htmlData{v=${key}}{${expandLiveTex(body, { values, results, digits })}}`;
    const v = kind === 'lval' ? values[key] : results[key];
    const role = kind === 'lval' ? 'edit' : 'res';
    return `\\htmlData{v=${key}, role=${role}}{${formatLive(v, digits[key] ?? (kind === 'lval' ? 2 : 3), kind !== 'lval')}}`;
  });
}

/** KaTeX options for live formulas: only \htmlData is trusted. */
export const LIVE_KATEX = Object.freeze({
  throwOnError: false,
  strict: 'ignore',
  output: 'html',
  trust: (ctx) => ctx.command === '\\htmlData',
});

/** Snap a typed value to a parameter's range and step. Returns null for text that is not a number. */
export function snapValue(text, { min = -Infinity, max = Infinity, step = 0 } = {}) {
  const t = String(text).trim().replace(',', '.').replace('−', '-');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  let v = Number(t);
  if (!Number.isFinite(v)) return null;
  if (step > 0 && Number.isFinite(min)) v = min + Math.round((v - min) / step) * step;
  else if (step > 0) v = Math.round(v / step) * step;
  v = Math.min(max, Math.max(min, v));
  const decimals = step > 0 ? Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) + 2 : 6;
  return Number(v.toFixed(Math.min(10, decimals)));
}
