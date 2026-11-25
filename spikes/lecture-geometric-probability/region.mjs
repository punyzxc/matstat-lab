// A region of the unit square typed as inequalities in x and y (#90), for example `y < x^2`,
// `x^2 + y^2 < 1 and y > x` or `0.2 < x < 0.8`. A small parser builds a tree and compiles it into a
// closure: no eval, no Function, so nothing typed can run as code. Pure ES module: no DOM.
//
// Grammar, loosest binding first:
//   or     := and (('or' | '||' | '∨') and)*
//   and    := not (('and' | '&&' | '&' | '∧') not)*
//   not    := ('not' | '!' | '¬') not | chain
//   chain  := sum (relation sum)*            relations < <= > >= ≤ ≥, chained as in 0 < x < 1
//   sum    := product (('+' | '-' | '−') product)*
//   product:= unary (('*' | '·' | '×' | '/' | implicit) unary)*      2x, 3(x + 1), xy
//   unary  := ('-' | '+') unary | power
//   power  := atom ('^' unary | '²' | '³')?    right-associative
//   atom   := number | x | y | pi | π | e | function '(' or ')' | '(' or ')' | '|' sum '|'
// A decimal comma between digits is a decimal point (0,5 = 0.5). Where a function is undefined (sqrt of a
// negative number, ln of 0) the comparison is false, so the point is outside the region.

const FUNCTIONS = Object.freeze({
  sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan, cot: (v) => 1 / Math.tan(v), ctg: (v) => 1 / Math.tan(v),
  asin: Math.asin, arcsin: Math.asin, acos: Math.acos, arccos: Math.acos, atan: Math.atan, arctg: Math.atan, arctan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log, lg: Math.log10,
});
const CONSTANTS = Object.freeze({ pi: Math.PI, 'π': Math.PI, e: Math.E });
const RELATIONS = Object.freeze({ '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b });
const WORDS = Object.freeze({ and: 'and', or: 'or', not: 'not', 'и': 'and', 'или': 'or', 'не': 'not' });

/** A typing error, with an English template and its values (the host translates the template). */
export class RegionError extends Error {
  constructor(template, ...values) {
    super(values.reduce((s, v, i) => s.replace(`[[${i + 1}]]`, v), template));
    this.template = template;
    this.values = values;
  }
}

const fnPrefix = (w) => Object.keys(FUNCTIONS).sort((p, q) => q.length - p.length).find((f) => w.startsWith(f) && /^[xy]+$/.test(w.slice(f.length)));

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+([.,]\d+)?|[.,]\d+)/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0].replace(',', '.')), at: i }); i += num[0].length; continue; }
    const word = /^[a-zA-Zа-яА-ЯёЁπ]+/.exec(src.slice(i));
    if (word) {
      const w = word[0].toLowerCase();
      if (WORDS[w]) out.push({ t: WORDS[w], at: i });
      else if (FUNCTIONS[w] || CONSTANTS[w] || w === 'x' || w === 'y') out.push({ t: 'name', v: w, at: i });
      else if (/^[xy]+$/.test(w)) for (const ch of w) out.push({ t: 'name', v: ch, at: i }); // xy = x·y
      else if (fnPrefix(w)) { out.push({ t: 'name', v: fnPrefix(w), at: i }); for (const ch of w.slice(fnPrefix(w).length)) out.push({ t: 'name', v: ch, at: i }); } // sinx = sin x
      else throw new RegionError('Unknown name “[[1]]”: use x, y, numbers, pi and functions such as sin, sqrt, ln.', word[0]);
      i += word[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '&&', '||', '**'].includes(two)) { out.push({ t: two === '**' ? '^' : two === '&&' ? 'and' : two === '||' ? 'or' : two, at: i }); i += 2; continue; }
    if (two === '==' || two === '!=') throw new RegionError('“[[1]]” is not allowed: a curve has area 0, so compare with <, ≤, > or ≥.', two);
    const one = { '≤': '<=', '≥': '>=', '⩽': '<=', '⩾': '>=', '−': '-', '·': '*', '×': '*', '∧': 'and', '∨': 'or', '¬': 'not', '!': 'not', '&': 'and' }[c];
    if (c === '√') { out.push({ t: 'name', v: 'sqrt', at: i }); i++; continue; }
    if (one) { out.push({ t: one, at: i }); i++; continue; }
    if ('<>+-*/^()|²³'.includes(c)) { out.push({ t: c, at: i }); i++; continue; }
    if (c === '=') throw new RegionError('“=” is not allowed: a curve has area 0, so compare with <, ≤, > or ≥.');
    throw new RegionError('Unexpected character “[[1]]”.', c);
  }
  return out;
}

/** Parses `src` into a tree; throws a RegionError that says what is wrong. */
export function parseRegion(src) {
  const text = String(src ?? '').trim();
  if (!text) throw new RegionError('Type a region, for example y < x^2.');
  if (text.length > 200) throw new RegionError('The region is too long: keep it under 200 characters.');
  const tokens = tokenize(text);
  let k = 0;
  const peek = () => tokens[k]?.t;
  const take = (t) => (peek() === t ? tokens[k++] : null);
  const need = (t) => {
    if (take(t)) return;
    throw peek() === undefined ? new RegionError('The region ends too early: “[[1]]” is missing.', t) : new RegionError('Expected “[[1]]” near “[[2]]”.', t, text.slice(tokens[k].at, tokens[k].at + 8));
  };
  const or = () => {
    let a = and();
    while (take('or')) a = { op: 'or', a, b: and() };
    return a;
  };
  const and = () => {
    let a = not();
    while (take('and')) a = { op: 'and', a, b: not() };
    return a;
  };
  const not = () => (take('not') ? { op: 'not', a: not() } : chain());
  const chain = () => {
    const first = sum();
    const links = [];
    while (RELATIONS[peek()]) {
      const rel = tokens[k++].t;
      links.push({ rel, b: sum() });
    }
    if (!links.length) return first;
    let left = first, node = null;
    for (const { rel, b } of links) {
      const cmp = { op: 'cmp', rel, a: left, b };
      node = node ? { op: 'and', a: node, b: cmp } : cmp;
      left = b;
    }
    return node;
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
      else if (startsAtom()) a = { op: '*', a, b: power() }; // implicit: 2x, 3(x + 1), x sin x
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
    if (!tok) throw new RegionError('The region ends too early: a number, x or y is missing.');
    if (take('num')) return { op: 'num', v: tok.v };
    if (take('name')) {
      if (tok.v === 'x' || tok.v === 'y') return { op: tok.v };
      if (tok.v in CONSTANTS) return { op: 'num', v: CONSTANTS[tok.v] };
      // A function takes a bracketed argument, or a single factor as in sin x, sqrt 2.
      if (take('(')) {
        const arg = or();
        need(')');
        return { op: 'fn', f: tok.v, a: arg };
      }
      return { op: 'fn', f: tok.v, a: power() };
    }
    if (take('(')) {
      const inner = or();
      need(')');
      return inner;
    }
    if (take('|')) {
      const inner = sum();
      need('|');
      return { op: 'fn', f: 'abs', a: inner };
    }
    throw new RegionError('Unexpected “[[1]]”.', text.slice(tok.at, tok.at + 8).trim());
  };
  const tree = or();
  if (k < tokens.length) throw new RegionError('Unexpected “[[1]]”.', text.slice(tokens[k].at, tokens[k].at + 8).trim());
  // Types: the whole region must be a condition; arithmetic takes numbers only.
  const kind = (n) => {
    switch (n.op) {
      case 'or': case 'and':
        if (kind(n.a) !== 'bool' || kind(n.b) !== 'bool') throw new RegionError('“and” and “or” join inequalities, for example y < x and x < 0.5.');
        return 'bool';
      case 'not':
        if (kind(n.a) !== 'bool') throw new RegionError('“not” applies to an inequality, for example not (y < x).');
        return 'bool';
      case 'cmp':
        if (kind(n.a) !== 'num' || kind(n.b) !== 'num') throw new RegionError('Compare numbers, not conditions.');
        return 'bool';
      case 'num': case 'x': case 'y': return 'num';
      case 'fn': case 'neg':
        if (kind(n.a) !== 'num') throw new RegionError('A function takes a number, not a condition.');
        return 'num';
      default:
        if (kind(n.a) !== 'num' || kind(n.b) !== 'num') throw new RegionError('Arithmetic takes numbers, not conditions.');
        return 'num';
    }
  };
  if (kind(tree) !== 'bool') throw new RegionError('Write an inequality, for example y < x^2: an expression alone is not a region.');
  if (!uses(tree, 'x') && !uses(tree, 'y')) throw new RegionError('The region does not depend on x or y.');
  return tree;
}
const uses = (n, v) => n.op === v || (n.a != null && uses(n.a, v)) || (n.b != null && uses(n.b, v));

/** Compiles a tree into `(x, y) => boolean`. */
export function compileRegion(tree) {
  const num = (n) => {
    switch (n.op) {
      case 'num': { const v = n.v; return () => v; }
      case 'x': return (x) => x;
      case 'y': return (_x, y) => y;
      case 'neg': { const a = num(n.a); return (x, y) => -a(x, y); }
      case 'fn': { const f = FUNCTIONS[n.f], a = num(n.a); return (x, y) => f(a(x, y)); }
      case '+': { const a = num(n.a), b = num(n.b); return (x, y) => a(x, y) + b(x, y); }
      case '-': { const a = num(n.a), b = num(n.b); return (x, y) => a(x, y) - b(x, y); }
      case '*': { const a = num(n.a), b = num(n.b); return (x, y) => a(x, y) * b(x, y); }
      case '/': { const a = num(n.a), b = num(n.b); return (x, y) => a(x, y) / b(x, y); }
      case '^': { const a = num(n.a), b = num(n.b); return (x, y) => a(x, y) ** b(x, y); }
      default: throw new Error(`not a number: ${n.op}`);
    }
  };
  const bool = (n) => {
    switch (n.op) {
      case 'or': { const a = bool(n.a), b = bool(n.b); return (x, y) => a(x, y) || b(x, y); }
      case 'and': { const a = bool(n.a), b = bool(n.b); return (x, y) => a(x, y) && b(x, y); }
      case 'not': { const a = bool(n.a); return (x, y) => !a(x, y); }
      case 'cmp': {
        const a = num(n.a), b = num(n.b), r = RELATIONS[n.rel];
        // NaN (outside a function's domain) makes every comparison false: the point is outside.
        return (x, y) => r(a(x, y), b(x, y));
      }
      default: throw new Error(`not a condition: ${n.op}`);
    }
  };
  return bool(tree);
}

/** The region as TeX, for the live formula: x^2 → x^{2}, sqrt → \sqrt{}, ≤ → \le. */
export function regionTex(tree) {
  const P = { or: 1, and: 2, not: 3, cmp: 4, '+': 5, '-': 5, '*': 6, '/': 6, neg: 7, '^': 8 };
  const prec = (n) => P[n.op] ?? 9;
  const wrap = (n, min) => (prec(n) < min ? `\\left(${tex(n)}\\right)` : tex(n));
  const REL = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' };
  const FN = { sin: '\\sin', cos: '\\cos', tan: '\\tan', tg: '\\operatorname{tg}', cot: '\\cot', ctg: '\\operatorname{ctg}', asin: '\\arcsin', arcsin: '\\arcsin',
    acos: '\\arccos', arccos: '\\arccos', atan: '\\operatorname{arctg}', arctg: '\\operatorname{arctg}', arctan: '\\operatorname{arctg}', exp: '\\exp', ln: '\\ln', log: '\\ln', lg: '\\lg' };
  const numText = (v) => (Math.abs(v - Math.PI) < 1e-15 ? '\\pi' : Math.abs(v - Math.E) < 1e-15 ? 'e' : String(Number(v.toPrecision(10))));
  const tex = (n) => {
    switch (n.op) {
      case 'num': return numText(n.v);
      case 'x': case 'y': return n.op;
      case 'or': return `${wrap(n.a, 1)} \\lor ${wrap(n.b, 2)}`;
      case 'and': return `${wrap(n.a, 2)} \\land ${wrap(n.b, 3)}`;
      case 'not': return `\\neg ${wrap(n.a, 9)}`;
      case 'cmp': return `${tex(n.a)} ${REL[n.rel]} ${tex(n.b)}`;
      case '+': return `${wrap(n.a, 5)} + ${wrap(n.b, 6)}`;
      case '-': return `${wrap(n.a, 5)} - ${wrap(n.b, 6)}`;
      case '*': {
        const implicit = n.b.op === 'x' || n.b.op === 'y' || n.b.op === 'fn' || (n.b.op === '^' && n.b.a.op !== 'num');
        const numeral = n.a.op === 'num' || (n.a.op === 'neg' && n.a.a.op === 'num');
        return `${wrap(n.a, 6)}${implicit && numeral ? ' ' : ' \\cdot '}${wrap(n.b, 7)}`;
      }
      case '/': return `\\dfrac{${tex(n.a)}}{${tex(n.b)}}`;
      case 'neg': return `-${wrap(n.a, 7)}`;
      case '^': return `${wrap(n.a, 9)}^{${tex(n.b)}}`;
      case 'fn':
        if (n.f === 'sqrt') return `\\sqrt{${tex(n.a)}}`;
        if (n.f === 'abs') return `\\left|${tex(n.a)}\\right|`;
        return `${FN[n.f]}${n.a.op === 'x' || n.a.op === 'y' || n.a.op === 'num' ? ' ' + tex(n.a) : `\\left(${tex(n.a)}\\right)`}`;
      default: return '?';
    }
  };
  // Chains of comparisons were split into "and": show 0 < x and x < 1 as 0 < x < 1.
  const chain = (n) => {
    if (n.op === 'and' && n.b.op === 'cmp') {
      const left = n.a.op === 'cmp' ? [n.a] : n.a.op === 'and' ? collect(n.a) : null;
      if (left && left.at(-1).b === n.b.a) return [...left, n.b];
    }
    return null;
  };
  const collect = (n) => (n.op === 'cmp' ? [n] : chain(n));
  const top = (n) => {
    const links = chain(n);
    if (links) return [tex(links[0].a), ...links.map((c) => `${REL[c.rel]} ${tex(c.b)}`)].join(' ');
    if (n.op === 'and') return `${n.a.op === 'or' ? `\\left(${top(n.a)}\\right)` : top(n.a)} \\land ${n.b.op === 'or' ? `\\left(${top(n.b)}\\right)` : top(n.b)}`;
    if (n.op === 'or') return `${top(n.a)} \\lor ${top(n.b)}`;
    return tex(n);
  };
  return top(tree);
}

/** Area of the region in [0, 1]² by the midpoint rule on a `G × G` grid, and the grid's own uncertainty. */
export function regionArea(inside, G = 1000) {
  let count = 0, edge = 0;
  const h = 1 / G;
  let prev = null;
  for (let j = 0; j < G; j++) {
    const y = (j + 0.5) * h;
    const row = new Uint8Array(G);
    for (let i = 0; i < G; i++) {
      const v = inside((i + 0.5) * h, y) ? 1 : 0;
      row[i] = v;
      count += v;
      // Cells whose neighbour differs straddle the boundary: they bound the grid error.
      if (i > 0 && v !== row[i - 1]) edge++;
      if (prev && v !== prev[i]) edge++;
    }
    prev = row;
  }
  return { area: count / (G * G), error: edge / (G * G) / 2, grid: G };
}

/** The region as horizontal runs of `cells × cells` grid cells, [x0, y0, width, height] in unit coordinates. */
export function regionRuns(inside, cells = 72) {
  const runs = [];
  const h = 1 / cells;
  for (let j = 0; j < cells; j++) {
    let start = -1;
    for (let i = 0; i <= cells; i++) {
      const on = i < cells && inside((i + 0.5) * h, (j + 0.5) * h);
      if (on && start < 0) start = i;
      if (!on && start >= 0) { runs.push([start * h, j * h, (i - start) * h, h]); start = -1; }
    }
  }
  return runs;
}
