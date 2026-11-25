// Pure helpers for the autoplay engine and keyboard-typed parameters. No DOM, unit-tested in node.

/**
 * Parse what a person types into a parameter field. Accepts a plain number, a comma as the decimal
 * mark (0,5), spaces as thousands separators (20 000), the unicode minus, percent (5% = 0.05) and
 * simple arithmetic: + − × ÷ * / ^, parentheses, π / pi, e, sqrt(…). Returns null for anything else.
 */
export function parseNumberInput(text) {
  if (typeof text !== 'string') return null;
  let s = text.trim().toLowerCase()
    .replace(/[−‒–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt');
  // Spaces between digit groups are thousands separators; other whitespace is ignored.
  s = s.replace(/(\d)\s+(?=\d{3}\b)/g, '$1');
  if (/[\d.]\s+[\d.]/.test(s)) return null;
  s = s.replace(/\s+/g, '');
  // A comma between digits is a decimal mark (Russian and most European keyboards).
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  if (!s || s.length > 64) return null;
  let i = 0;
  const peek = () => s[i];
  const eat = (c) => (s[i] === c ? (i++, true) : false);
  function primary() {
    if (eat('(')) {
      const v = expr();
      return eat(')') ? v : NaN;
    }
    if (s.startsWith('pi', i)) return (i += 2), Math.PI;
    if (s.startsWith('sqrt', i)) {
      i += 4;
      return Math.sqrt(unary());
    }
    if (s[i] === 'e' && !/[0-9.]/.test(s[i - 1] ?? '')) return i++, Math.E;
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
    if (!m) return NaN;
    i += m[0].length;
    let v = Number(m[0]);
    if (eat('%')) v /= 100;
    return v;
  }
  function power() {
    const base = primary();
    return eat('^') ? base ** unary() : base;
  }
  function unary() {
    if (eat('-')) return -unary();
    if (eat('+')) return unary();
    return power();
  }
  function term() {
    let v = unary();
    for (;;) {
      if (eat('*')) v *= unary();
      else if (eat('/')) v /= unary();
      else return v;
    }
  }
  function expr() {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  }
  const value = expr();
  if (i !== s.length || peek() !== undefined) return null;
  return Number.isFinite(value) ? value : null;
}

/** Clamp to [min, max] and snap to the step grid from min; both ends stay reachable. */
export function fitToRange(value, min, max, step) {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  const v = Math.min(hi, Math.max(lo, value));
  const snapped = step > 0 && v !== hi && v !== lo ? lo + Math.round((v - lo) / step) * step : v;
  return Number(Math.min(hi, Math.max(lo, snapped)).toPrecision(12));
}

/**
 * A parameter whose label lists its choices — "Law (0 normal, 1 uniform, 2 exponential)" or
 * "Experiment (0 bivariate normal · 1 uniform disc)" — is a choice, not a number.
 * Returns { title, options: [{ value, label }] } or null.
 */
export function choicesOf(param) {
  if (!param || param.step !== 1 || !Number.isInteger(param.min) || !Number.isInteger(param.max)) return null;
  if (param.max - param.min > 7 || param.max <= param.min) return null;
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(param.label);
  if (!m) return null;
  const options = [];
  const re = /(-?\d+)\s+(.+?)\s*(?=[,·;]\s*-?\d+\s|$)/g;
  let hit;
  while ((hit = re.exec(m[2].replace(/\s*[,·;]\s*$/, '')))) options.push({ value: Number(hit[1]), label: hit[2].trim() });
  const expected = param.max - param.min + 1;
  if (options.length !== expected) return null;
  for (let k = 0; k < expected; k++) if (options[k].value !== param.min + k) return null;
  // "Merge cells (0 no, 1 yes)" reads better as a switch, but chips work for it too.
  return { title: m[1].trim(), options };
}

/** The parameter that sets how much is simulated: replicates first, then trials, sample size, Monte Carlo runs. */
export function sizeParamOf(params) {
  const order = ['R', 'N', 'n', 'reps'];
  for (const key of order) {
    const p = params.find((q) => q.key === key);
    if (p && p.max > p.min && p.max >= 50) return p;
  }
  return null;
}

/** Fractions of the target size shown while a fresh experiment grows. */
export const GROWTH = [0.02, 0.05, 0.1, 0.18, 0.3, 0.45, 0.65, 0.85, 1];

/** The size shown at growth frame k (k ≥ GROWTH.length means fully grown). */
export function grownSize(param, target, k) {
  if (k >= GROWTH.length) return target;
  return fitToRange(Math.max(param.min, target * GROWTH[k]), param.min, Math.max(param.min, target), param.step);
}

/** Speeds offered in the play bar, as multipliers of the base pace; any value in SPEED_RANGE can be typed. */
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
export const SPEED_RANGE = [0.25, 8];
/** A typed pace, kept inside SPEED_RANGE (1 when it is not a number). */
export function clampSpeed(v) {
  return Number.isFinite(v) && v > 0 ? Math.min(SPEED_RANGE[1], Math.max(SPEED_RANGE[0], v)) : 1;
}

// ---------------------------------------------------------------- time machine (#113)
// A draw of a kernel station is fully determined by the experiment's parameters and its seed, and draw d of an
// experiment that started at seed `origin` uses seed origin + d − 1. So the timeline needs no stored results: any
// draw is replayed from its seed, and memory stays constant however many draws were made.
/** The seed of draw d (1-based) of an experiment that started at `origin`. */
export const seedAtDraw = (origin, d) => (origin + d - 1) >>> 0;
/** The draw number (1-based) that `seed` has in an experiment that started at `origin`. */
export const drawOfSeed = (origin, seed) => ((seed - origin) >>> 0) + 1;
/**
 * The recorded history after a draw lands: entries of later draws are dropped (they belong to a future the person
 * stepped back from), the new one is appended, and at most `cap` are kept.
 */
export function timelineAppend(list, entry, origin, cap) {
  const at = drawOfSeed(origin, entry.seed);
  const kept = list.filter((e) => drawOfSeed(origin, e.seed) < at);
  return [...kept, entry].slice(-cap);
}

/**
 * Milliseconds between draws: the base pace divided by the speed, but never faster than three times
 * the time one run takes, so a heavy kernel never saturates the machine.
 */
export function tickDelay(speed, runMs, growing = false) {
  const base = growing ? 420 : 1100;
  return Math.round(Math.max(base / speed, 3 * (runMs || 0), 60));
}

/** Linear interpolation of (xs, ys) at x; flat outside the range. */
function interp(xs, ys, x) {
  if (!xs.length) return 0;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
  return ys[lo] + (ys[hi] - ys[lo]) * t;
}

/**
 * Stack the main curve of successive draws into a surface: x is the curve's axis, y the draw number,
 * z the curve's height. Every row is resampled onto the newest row's x grid (at most 48 columns).
 * `rows` is [{ draw, x, y }] oldest first. Returns null with fewer than 3 rows.
 */
export function ridgeOf(rows, labels) {
  const usable = rows.filter((r) => r.x.length > 1 && r.x.length === r.y.length);
  if (usable.length < 3) return null;
  const last = usable[usable.length - 1];
  const stride = Math.max(1, Math.ceil(last.x.length / 48));
  const xs = last.x.filter((_, i) => i % stride === 0);
  const z = usable.map((r) => xs.map((x) => {
    const v = interp(r.x, r.y, x);
    return Number.isFinite(v) ? v : 0;
  }));
  return { x: xs, y: usable.map((r) => r.draw), z, labels, title: 'The last draws, stacked: each ridge is one experiment' };
}

/** Running mean and the share of draws whose value lies within ± tolerance of theory. */
export function traceSummary(values, theory) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { count: 0, mean: null, sd: null };
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  const sd = finite.length > 1 ? Math.sqrt(finite.reduce((a, b) => a + (b - mean) ** 2, 0) / (finite.length - 1)) : null;
  return { count: finite.length, mean, sd, theory: Number.isFinite(theory) ? theory : null };
}
