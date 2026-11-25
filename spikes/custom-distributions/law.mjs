// Custom distributions (#88): a law typed by the student, used as a source in the CLT, LLN, Sample and Fit stations.
//
//   discrete:    values | probabilities          0 1 2 | 0.2 0.5 0.3        (1/3 and 0,5 are fine)
//   continuous:  formula in x on [a, b]          2x on [0, 1]               (`на` works as `on`)
//
// A small recursive-descent parser builds a tree and compiles it into a closure: no eval, no Function, so nothing
// typed can run as code. A continuous formula is normalised numerically (midpoint rule on G cells); its CDF is then
// piecewise linear on that grid, and the seeded sampler inverts it exactly cell by cell. Pure ES module: no DOM.

/** A typing error with an English template and its values (the host translates the template). */
export class LawError extends Error {
  constructor(template, ...values) {
    super(values.reduce((s, v, i) => s.replace(`[[${i + 1}]]`, v), template));
    this.template = template;
    this.values = values.map(String);
  }
}

const FUNCTIONS = Object.freeze({
  sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan, atan: Math.atan, arctg: Math.atan, arctan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log, lg: Math.log10,
});
const FN_TEX = Object.freeze({ sin: '\\sin', cos: '\\cos', tan: '\\operatorname{tg}', tg: '\\operatorname{tg}', atan: '\\operatorname{arctg}', arctg: '\\operatorname{arctg}', arctan: '\\operatorname{arctg}', ln: '\\ln', log: '\\ln', lg: '\\lg' });
const CONSTANTS = Object.freeze({ pi: Math.PI, 'π': Math.PI, e: Math.E });
const MAX_TEXT = 200, MAX_VALUES = 60;
/** Cells of the numerical grid of a continuous law. */
export const GRID = 4096;

const fnPrefix = (w) => Object.keys(FUNCTIONS).sort((p, q) => q.length - p.length).find((f) => w.startsWith(f) && /^x+$/.test(w.slice(f.length)));

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+([.,]\d+)?|[.,]\d+)/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: Number(num[0].replace(',', '.')), at: i });
      i += num[0].length;
      continue;
    }
    const word = /^[a-zA-Zа-яА-ЯёЁπ]+/.exec(src.slice(i));
    if (word) {
      const w = word[0].toLowerCase();
      if (FUNCTIONS[w] || CONSTANTS[w] || w === 'x') out.push({ t: 'name', v: w, at: i });
      else if (/^x+$/.test(w)) for (const ch of w) out.push({ t: 'name', v: ch, at: i });
      else if (fnPrefix(w)) { out.push({ t: 'name', v: fnPrefix(w), at: i }); for (const ch of w.slice(fnPrefix(w).length)) out.push({ t: 'name', v: ch, at: i }); }
      else throw new LawError('Unknown name “[[1]]”: use x, numbers, pi, e and functions such as exp, sqrt, sin, ln.', word[0]);
      i += word[0].length;
      continue;
    }
    if (src.slice(i, i + 2) === '**') { out.push({ t: '^', at: i }); i += 2; continue; }
    const one = { '−': '-', '·': '*', '×': '*', '√': 'sqrt' }[c];
    if (one === 'sqrt') { out.push({ t: 'name', v: 'sqrt', at: i }); i++; continue; }
    if (one) { out.push({ t: one, at: i }); i++; continue; }
    if ('+-*/^()|²³'.includes(c)) { out.push({ t: c, at: i }); i++; continue; }
    throw new LawError('Unexpected character “[[1]]”.', c);
  }
  return out;
}

/** Parses an arithmetic expression in x (or a constant when `allowX` is false) into a tree. */
export function parseExpression(src, allowX = true) {
  const text = String(src ?? '').trim();
  if (!text) throw new LawError('Type a formula in x, for example 2x.');
  const tokens = tokenize(text);
  let k = 0;
  const peek = () => tokens[k]?.t;
  const take = (t) => (peek() === t ? tokens[k++] : null);
  const near = () => text.slice(tokens[k].at, tokens[k].at + 8).trim();
  const need = (t) => {
    if (take(t)) return;
    throw peek() === undefined ? new LawError('“[[1]]” is missing at the end of “[[2]]”.', t, text) : new LawError('Expected “[[1]]” near “[[2]]”.', t, near());
  };
  const sum = () => {
    let a = product();
    for (;;) {
      if (take('+')) a = { op: '+', a, b: product() };
      else if (take('-')) a = { op: '-', a, b: product() };
      else return a;
    }
  };
  const startsAtom = () => ['num', 'name', '('].includes(peek());
  const product = () => {
    let a = unary();
    for (;;) {
      if (take('*')) a = { op: '*', a, b: unary() };
      else if (take('/')) a = { op: '/', a, b: unary() };
      else if (startsAtom()) a = { op: '*', a, b: power(), implicit: true };
      else return a;
    }
  };
  const unary = () => {
    if (take('-')) return { op: 'neg', a: unary() };
    if (take('+')) return unary();
    return power();
  };
  const power = () => {
    const base = atom();
    if (take('^')) return { op: '^', a: base, b: unary() };
    if (take('²')) return { op: '^', a: base, b: { op: 'num', v: 2 } };
    if (take('³')) return { op: '^', a: base, b: { op: 'num', v: 3 } };
    return base;
  };
  const atom = () => {
    const tok = tokens[k];
    if (!tok) throw new LawError('“[[1]]” ends too early: a number or x is missing.', text);
    if (take('num')) return { op: 'num', v: tok.v };
    if (take('name')) {
      if (tok.v === 'x') {
        if (!allowX) throw new LawError('“[[1]]” must be a number, without x.', text);
        return { op: 'x' };
      }
      if (tok.v in CONSTANTS) return { op: 'const', v: CONSTANTS[tok.v], name: tok.v };
      if (take('(')) {
        const arg = sum();
        need(')');
        return { op: 'fn', f: tok.v, a: arg };
      }
      return { op: 'fn', f: tok.v, a: power() };
    }
    if (take('(')) {
      const inner = sum();
      need(')');
      return { op: 'paren', a: inner };
    }
    if (take('|')) {
      const inner = sum();
      need('|');
      return { op: 'fn', f: 'abs', a: inner };
    }
    throw new LawError('Unexpected “[[1]]”.', near());
  };
  const tree = sum();
  if (k < tokens.length) throw new LawError('Unexpected “[[1]]”.', near());
  return tree;
}

/** Compiles a tree into `x => number` (NaN where the formula is undefined). */
export function compile(tree) {
  const go = (n) => {
    switch (n.op) {
      case 'num': case 'const': { const v = n.v; return () => v; }
      case 'x': return (x) => x;
      case 'paren': return go(n.a);
      case 'neg': { const a = go(n.a); return (x) => -a(x); }
      case 'fn': { const f = FUNCTIONS[n.f], a = go(n.a); return (x) => f(a(x)); }
      default: {
        const a = go(n.a), b = go(n.b);
        if (n.op === '+') return (x) => a(x) + b(x);
        if (n.op === '-') return (x) => a(x) - b(x);
        if (n.op === '*') return (x) => a(x) * b(x);
        if (n.op === '/') return (x) => a(x) / b(x);
        return (x) => a(x) ** b(x);
      }
    }
  };
  return go(tree);
}

const numTex = (v) => {
  const s = String(Number(v.toPrecision(6)));
  return s.includes('e') ? s.replace(/e\+?(-?\d+)/, '\\cdot 10^{$1}') : s;
};
/** The tree as TeX in textbook notation: 2x, \dfrac{1}{2}, e^{-x}, \sqrt{x}, |x|. */
export function toTex(n) {
  switch (n.op) {
    case 'num': return numTex(n.v);
    case 'const': return n.name === 'e' ? 'e' : '\\pi';
    case 'x': return 'x';
    case 'paren': return `\\left(${toTex(n.a)}\\right)`;
    case 'neg': return `-${['+', '-'].includes(n.a.op) ? `\\left(${toTex(n.a)}\\right)` : toTex(n.a)}`;
    case 'fn':
      if (n.f === 'sqrt') return `\\sqrt{${toTex(unparen(n.a))}}`;
      if (n.f === 'abs') return `\\left|${toTex(unparen(n.a))}\\right|`;
      if (n.f === 'exp') return `e^{${toTex(unparen(n.a))}}`;
      return `${FN_TEX[n.f]}${['x', 'num', 'const', 'paren'].includes(n.a.op) ? (n.a.op === 'paren' ? toTex(n.a) : ` ${toTex(n.a)}`) : `\\left(${toTex(n.a)}\\right)`}`;
    case '+': return `${toTex(n.a)} + ${toTex(n.b)}`;
    case '-': return `${toTex(n.a)} - ${['+', '-'].includes(n.b.op) ? `\\left(${toTex(n.b)}\\right)` : toTex(n.b)}`;
    case '/': return `\\dfrac{${toTex(unparen(n.a))}}{${toTex(unparen(n.b))}}`;
    case '^': {
      const base = ['num', 'x', 'const', 'paren'].includes(n.a.op) || (n.a.op === 'fn' && ['abs', 'sqrt'].includes(n.a.f)) ? toTex(n.a) : `\\left(${toTex(n.a)}\\right)`;
      return `${base}^{${toTex(unparen(n.b))}}`;
    }
    case '*': {
      const wrap = (m) => (['+', '-'].includes(m.op) ? `\\left(${toTex(m)}\\right)` : toTex(m));
      const a = wrap(n.a), b = wrap(n.b);
      // 2x, 3\sqrt{x}, x e^{-x}; a number after anything gets a dot: x \cdot 2.
      const tight = n.b.op !== 'num' && n.b.op !== 'neg' && !(n.a.op === 'x' && n.b.op === 'x');
      return tight ? `${a}${/[a-z}]$/i.test(a) && /^[a-z\\]/i.test(b) ? '\\,' : ''}${b}` : `${a} \\cdot ${b}`;
    }
    default: return '?';
  }
}
const unparen = (n) => (n.op === 'paren' ? n.a : n);

const NOT_FINITE = Object.freeze({
  value: 'The value “[[1]]” is not a finite number.', probability: 'The probability “[[1]]” is not a finite number.',
  left: 'The left end “[[1]]” is not a finite number.', right: 'The right end “[[1]]” is not a finite number.',
});
const constant = (src, what) => {
  const tree = parseExpression(src, false);
  const v = compile(tree)(0);
  if (!Number.isFinite(v)) throw new LawError(NOT_FINITE[what] ?? NOT_FINITE.value, src.trim());
  return { v, tex: toTex(tree) };
};

/** Splits "[a, b]" into its two ends: on "; " or ", " first, so that a decimal comma (0,5) survives. */
function splitInterval(inner) {
  for (const sep of [';', ', ', ',']) {
    const parts = inner.split(sep);
    if (parts.length === 2) return parts;
  }
  throw new LawError('Write the interval as [a, b], for example [0, 1].');
}

function discreteLaw(text) {
  const [left, right, extra] = text.split('|');
  if (extra != null) throw new LawError('Use one “|”: values on the left, probabilities on the right.');
  const split = (s) => s.trim().split(/[\s;]+/).filter(Boolean);
  const vs = split(left), ps = split(right ?? '');
  if (!vs.length) throw new LawError('Type the values before “|”, for example 0 1 2 | 0.2 0.5 0.3.');
  if (!ps.length) throw new LawError('Type the probabilities after “|”, for example 0 1 2 | 0.2 0.5 0.3.');
  if (vs.length !== ps.length) throw new LawError('[[1]] values but [[2]] probabilities: give one probability per value.', vs.length, ps.length);
  if (vs.length > MAX_VALUES) throw new LawError('At most [[1]] values.', MAX_VALUES);
  const values = vs.map((s) => constant(s, 'value').v), probs = ps.map((s) => constant(s, 'probability').v);
  probs.forEach((p, i) => { if (p < 0) throw new LawError('The probability of [[1]] is negative ([[2]]): probabilities are ≥ 0.', vs[i], ps[i]); });
  const seen = new Set();
  values.forEach((v, i) => { if (seen.has(v)) throw new LawError('The value [[1]] is listed twice.', vs[i]); seen.add(v); });
  const total = probs.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 1e-9) throw new LawError('The probabilities add up to [[1]], not 1.', String(Number(total.toPrecision(10))));
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const xs = order.map((i) => values[i]), pr = order.map((i) => probs[i]);
  const cum = [];
  pr.reduce((acc, p, i) => (cum[i] = acc + p), 0);
  cum[cum.length - 1] = 1;
  const mean = xs.reduce((a, v, i) => a + v * pr[i], 0);
  const variance = xs.reduce((a, v, i) => a + (v - mean) ** 2 * pr[i], 0);
  if (!(variance > 0)) throw new LawError('All the probability sits on one value, [[1]]: give a second value a positive probability.', String(Number(mean.toPrecision(10))));
  const cdf = (x) => {
    let lo = 0, hi = xs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m + 1; else hi = m; }
    return lo ? cum[lo - 1] : 0;
  };
  const quantile = (u) => {
    let lo = 0, hi = xs.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] >= u) hi = m; else lo = m + 1; }
    return xs[lo];
  };
  const shown = order.map((i) => [vs[i], ps[i]]);
  const tex = `\\begin{array}{c|${'c'.repeat(xs.length)}} x_i & ${shown.map(([v]) => constant(v, 'value').tex).join(' & ')} \\\\ \\hline p_i & ${shown.map(([, p]) => constant(p, 'probability').tex).join(' & ')} \\end{array}`;
  return { kind: 'discrete', text, values: xs, probs: pr, mean, variance, sd: Math.sqrt(variance), lo: xs[0], hi: xs.at(-1), cdf, quantile, tex,
    integer: xs.every((v) => Number.isInteger(v)) };
}

function continuousLaw(text, formula, inner) {
  const [sa, sb] = splitInterval(inner);
  const a = constant(sa, 'left'), b = constant(sb, 'right');
  if (!(b.v > a.v)) throw new LawError('The interval [[[1]], [[2]]] is empty: the right end must be larger.', sa.trim(), sb.trim());
  if (Math.abs(a.v) > 1e6 || Math.abs(b.v) > 1e6) throw new LawError('Keep the interval inside [−10⁶, 10⁶].');
  const tree = parseExpression(formula, true);
  const f = compile(tree);
  const h = (b.v - a.v) / GRID;
  const mass = new Float64Array(GRID);
  let total = 0, m1 = 0;
  for (let i = 0; i < GRID; i++) {
    const x = a.v + (i + 0.5) * h, v = f(x);
    if (!Number.isFinite(v)) throw new LawError('f(x) is not defined at x = [[1]].', fmtX(x));
    if (v < 0) throw new LawError('f(x) is negative at x = [[1]]: a density cannot be negative.', fmtX(x));
    mass[i] = v * h;
    total += mass[i];
    m1 += x * mass[i];
  }
  if (!(total > 0)) throw new LawError('f(x) is 0 on the whole interval: there is nothing to normalise.');
  const c = 1 / total;
  const cum = new Float64Array(GRID + 1);
  for (let i = 0; i < GRID; i++) cum[i + 1] = cum[i] + mass[i] * c;
  cum[GRID] = 1;
  const mean = m1 * c;
  let variance = 0;
  for (let i = 0; i < GRID; i++) variance += (a.v + (i + 0.5) * h - mean) ** 2 * mass[i] * c;
  // Within a cell the density is its midpoint value, so the CDF is linear there and inverts exactly.
  const cdf = (x) => {
    if (x <= a.v) return 0;
    if (x >= b.v) return 1;
    const t = (x - a.v) / h, i = Math.min(GRID - 1, Math.floor(t));
    return cum[i] + (cum[i + 1] - cum[i]) * (t - i);
  };
  const quantile = (u) => {
    let lo = 0, hi = GRID;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m; else hi = m; }
    const w = cum[hi] - cum[lo];
    return a.v + h * (lo + (w > 0 ? (u - cum[lo]) / w : 0.5));
  };
  const pdf = (x) => (x < a.v || x > b.v ? 0 : Math.max(0, f(x)) * c);
  const body = toTex(tree);
  const norm = Math.abs(c - 1) < 1e-6 ? body : `c\\,${['+', '-'].includes(tree.op) ? `\\left(${body}\\right)` : body}`;
  const tex = `f(x) = \\begin{cases} ${norm}, & x \\in [${a.tex}, ${b.tex}] \\\\ 0, & x \\notin [${a.tex}, ${b.tex}] \\end{cases}${Math.abs(c - 1) < 1e-6 ? '' : `\\qquad c = ${numTex(c)}`}`;
  return { kind: 'continuous', text, formula: formula.trim(), mean, variance, sd: Math.sqrt(variance), lo: a.v, hi: b.v, cdf, quantile, pdf, c, tex };
}
const fmtX = (x) => String(Number(x.toPrecision(4)));

/** Parses a typed law; throws a LawError that says what is wrong. */
export function parseLaw(src) {
  const text = String(src ?? '').trim();
  if (!text) throw new LawError('Type a law: 0 1 2 | 0.2 0.5 0.3, or 2x on [0, 1].');
  if (text.length > MAX_TEXT) throw new LawError('The law is too long: keep it under [[1]] characters.', MAX_TEXT);
  const on = /^(.*?)\s+(?:on|на)\s*\[(.*)\]\s*$/i.exec(text);
  if (on) return continuousLaw(text, on[1], on[2]);
  if (text.includes('|') && !/x/i.test(text)) return discreteLaw(text);
  if (/x/i.test(text)) throw new LawError('Add the interval where the density lives: “[[1]] on [0, 1]”.', text);
  throw new LawError('Type values | probabilities (0 1 2 | 0.2 0.5 0.3) or a density in x on [a, b] (2x on [0, 1]).');
}

const cache = new Map();
/** parseLaw with a small cache: the stations call it on every run. */
export function lawOf(text) {
  const key = String(text ?? '').trim();
  let law = cache.get(key);
  if (!law) {
    law = parseLaw(key);
    if (cache.size > 32) cache.clear();
    cache.set(key, law);
  }
  return law;
}

/** null when the text is a valid law, else the error in the TextCheck shape. */
export function checkLaw(text) {
  try {
    lawOf(text);
    return null;
  } catch (e) {
    if (e instanceof LawError) return { message: e.message, template: e.template, values: e.values };
    return { message: String(e?.message ?? e), template: String(e?.message ?? e), values: [] };
  }
}

/** Presets for the text field: a few discrete and continuous laws worth exploring. */
export const LAW_PRESETS = Object.freeze([
  '0 1 2 | 0.2 0.5 0.3',
  '1 2 3 4 5 6 | 1/6 1/6 1/6 1/6 1/6 1/6',
  '-1 0 10 | 0.5 0.45 0.05',
  '2x on [0, 1]',
  '3x^2 on [0, 1]',
  'exp(-x) on [0, 10]',
  '|x| on [-1, 1]',
  'x(1 - x) on [0, 1]',
]);
export const DEFAULT_LAW = '0 1 2 | 0.2 0.5 0.3';
export const LAW_HINT = 'A law: values | probabilities, or a density in x on [a, b]. Enter applies.';

/**
 * Pictures of a custom law for a station: its pmf or pdf and its CDF (as a linked chart), and its formula. The
 * continuous curves are drawn on `points` grid points; the discrete CDF is a step function with open/closed ends.
 */
export function lawPreview(law, points = 241) {
  const r6 = (v) => Number(v.toPrecision(6));
  if (law.kind === 'discrete') {
    const pad = Math.max(0.5, (law.hi - law.lo) * 0.08);
    return {
      series: [
        { id: 'law-pmf', kind: 'pmf', tone: 'signal', label: 'typed law $p_i = P(X = x_i)$', x: law.values, y: law.probs.map(r6) },
        { id: 'law-cdf', kind: 'ecdf', tone: 'default', label: '$F(x)$', x: law.values, y: law.values.map((v) => r6(law.cdf(v))) },
      ],
      domain: { x: [law.lo - pad, law.hi + pad], y: [0, 1.04] },
    };
  }
  const xs = Array.from({ length: points }, (_, i) => law.lo + ((law.hi - law.lo) * i) / (points - 1));
  const fs = xs.map((x) => law.pdf(x)).map((v) => (Number.isFinite(v) ? r6(v) : NaN));
  return {
    series: [
      { id: 'law-pdf', kind: 'pdf', tone: 'signal', label: 'typed density $f(x)$', x: xs.map(r6), y: fs },
      { id: 'law-cdf', kind: 'cdf', tone: 'default', label: '$F(x)$', x: xs.map(r6), y: xs.map((x) => r6(law.cdf(x))) },
    ],
  };
}
