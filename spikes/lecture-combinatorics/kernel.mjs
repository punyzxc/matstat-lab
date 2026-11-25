// L1 combinatorics kernel (#38): urn counts, the hypergeometric law (L1 ex. 8) and the number of empty boxes when
// n balls fall into m boxes (L1, n = 5), each exact next to a seeded simulation. Discovery spike, not product code.
// No DOM and no unseeded randomness: the same params and seed give the same bytes.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { countOf, enumerate } from '../lecture-outcome-space/kernel.mjs';

/** Predeclared Monte Carlo band: a simulated frequency must lie within BAND_Z standard errors of the exact P. */
export const BAND_Z = 4;
/** The band is drawn only when the expected spread R·P(1−P) is at least this (the normal approximation is poor below). */
export const MIN_SPREAD = 9;
/** Outcomes are listed one by one (with exact and simulated probability) only up to this many. */
export const LIST_UP_TO = 60;
const NAMESPACE = 0x0c38;
const u01 = (seed, stream, i) => (fixtureUint32(seed, stream, i, NAMESPACE) + 0.5) / 2 ** 32;
const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));
const band = (P, R) => (R * P * (1 - P) < MIN_SPREAD ? null : [r6(Math.max(0, P - BAND_Z * Math.sqrt((P * (1 - P)) / R))), r6(Math.min(1, P + BAND_Z * Math.sqrt((P * (1 - P)) / R)))]);

// ---------- exact integer arithmetic ----------
export const fact = (m) => { let r = 1n; for (let i = 2n; i <= BigInt(m); i++) r *= i; return r; };
export function binom(n, k) {
  if (k < 0 || n < 0 || k > n) return 0n;
  let r = 1n;
  for (let i = 1n; i <= BigInt(k); i++) r = (r * (BigInt(n) - BigInt(k) + i)) / i;
  return r;
}
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
/** A reduced fraction p/q as a string "p/q" (or "0", "1"). */
export function fraction(p, q) {
  if (p === 0n) return '0';
  const g = gcd(p, q);
  return q / g === 1n ? `${p / g}` : `${p / g}/${q / g}`;
}
/** p/q as a double without overflow for huge BigInts. */
const ratio = (p, q) => {
  const shift = BigInt(Math.max(0, q.toString(2).length - 1000));
  return Number(p >> shift) / Number(q >> shift);
};

// ---------- view 1: the four urn schemes of L1 ----------
/** The schemes of L1 §Combinatorics, with the index of the same scheme in lecture-outcome-space (#130). */
export const URN_SCHEMES = [
  { key: 'Abar', title: 'ordered, with replacement: $\\bar{A}_n^{\\,k} = n^k$', ordered: true, repetition: true, outcomeSpace: 3 },
  { key: 'A', title: 'ordered, without replacement: $A_n^k = n!/(n-k)!$', ordered: true, repetition: false, outcomeSpace: 1 },
  { key: 'C', title: 'unordered, without replacement: $C_n^k$', ordered: false, repetition: false, outcomeSpace: 2 },
  { key: 'Cbar', title: 'unordered, with replacement: $\\bar{C}_n^{\\,k} = C_{n+k-1}^{\\,k}$', ordered: false, repetition: true, outcomeSpace: 4 },
];
/** The exact number of samples of size k from n numbered balls under a scheme (BigInt). */
export const urnCount = (scheme, n, k) => countOf(URN_SCHEMES[scheme].outcomeSpace, n, k);
/** Every sample, in lexicographic order; unordered samples are sorted ascending. */
export const urnOutcomes = (scheme, n, k) => enumerate(URN_SCHEMES[scheme].outcomeSpace, n, k);
/** The lecture's count in ex. 6: n identical balls placed into k boxes, C(n+k−1, k−1). A different problem. */
export const identicalBallsInBoxes = (n, k) => binom(n + k - 1, k - 1);

/** Exact probability of one sample (as numerator over denominator) when k balls are drawn one at a time, uniformly. */
export function urnOutcomeProbability(scheme, n, k, sample) {
  const { ordered, repetition } = URN_SCHEMES[scheme];
  if (!repetition || ordered) return { p: 1n, q: urnCount(scheme, n, k) };
  // A multiset with multiplicities m_i arises from k!/∏m_i! of the n^k equally likely ordered draws.
  const mult = new Map();
  for (const b of sample) mult.set(b, (mult.get(b) ?? 0) + 1);
  let den = 1n;
  for (const m of mult.values()) den *= fact(m);
  return { p: fact(k) / den, q: BigInt(n) ** BigInt(k) };
}

/** One sample drawn ball by ball from an urn (stream 1, indices 64·i + t). */
function drawUrn(scheme, n, k, seed, i) {
  const { ordered, repetition } = URN_SCHEMES[scheme];
  const u = (t) => u01(seed, 1, 64 * i + t);
  let s;
  if (repetition) s = Array.from({ length: k }, (_, t) => Math.min(n - 1, Math.floor(u(t) * n)));
  else {
    const a = Array.from({ length: n }, (_, j) => j);
    for (let t = 0; t < k; t++) { const r = t + Math.min(n - t - 1, Math.floor(u(t) * (n - t))); [a[t], a[r]] = [a[r], a[t]]; }
    s = a.slice(0, k);
  }
  return ordered ? s : s.sort((x, y) => x - y);
}

// ---------- view 2: the hypergeometric law (L1 ex. 8, formula 3) ----------
/** P(A_s) = C(k,s)·C(n−k,r−s)/C(n,r) for s = 0 … r, as exact BigInt numerators over one denominator. */
export function hypergeometric(n, k, r) {
  const q = binom(n, r);
  const p = Array.from({ length: r + 1 }, (_, s) => binom(k, s) * binom(n - k, r - s));
  return { p, q };
}
/** Red balls in r draws without replacement from n balls, k of them red (stream 2, indices 64·i + t). */
function drawRed(n, k, r, seed, i) {
  const a = Array.from({ length: n }, (_, j) => j);
  let red = 0;
  for (let t = 0; t < r; t++) {
    const j = t + Math.min(n - t - 1, Math.floor(u01(seed, 2, 64 * i + t) * (n - t)));
    [a[t], a[j]] = [a[j], a[t]];
    if (a[t] < k) red++;
  }
  return red;
}

// ---------- view 3: n distinguishable balls into m distinguishable boxes ----------
/** Stirling numbers of the second kind S(n, j), j = 0 … n (BigInt). */
function stirling2(n) {
  let row = [1n];
  for (let i = 1; i <= n; i++) {
    const next = new Array(i + 1).fill(0n);
    for (let j = 1; j <= i; j++) next[j] = BigInt(j) * (row[j] ?? 0n) + row[j - 1];
    row = next;
  }
  return row;
}
/** Exactly e boxes stay empty: C(m, e)·S(n, m−e)·(m−e)! of the m^n placements, e = 0 … m−1. */
export function emptyBoxes(n, m) {
  const S = stirling2(n);
  const q = BigInt(m) ** BigInt(n);
  const p = Array.from({ length: m }, (_, e) => (m - e > n ? 0n : binom(m, e) * (S[m - e] ?? 0n) * fact(m - e)));
  return { p, q };
}
/** Count empty boxes over all m^n placements one by one (the check of AC4; only for small m^n). */
export function enumerateEmptyBoxes(n, m) {
  const counts = new Array(m).fill(0);
  const box = new Array(n).fill(0);
  const total = m ** n;
  for (let c = 0; c < total; c++) {
    let x = c;
    for (let b = 0; b < n; b++) { box[b] = x % m; x = Math.floor(x / m); }
    const used = new Set(box);
    counts[m - used.size]++;
  }
  return counts;
}
/** The polynomial coefficient n!/(r_1!…r_k!) of formula (4): placements with r_i balls in box i. */
export function polynomialCoefficient(rs) {
  let den = 1n;
  for (const r of rs) den *= fact(r);
  return fact(rs.reduce((a, b) => a + b, 0)) / den;
}
/** Empty boxes after one random placement (stream 3, indices 64·i + b). */
function drawEmpty(n, m, seed, i) {
  const used = new Set();
  for (let b = 0; b < n; b++) used.add(Math.min(m - 1, Math.floor(u01(seed, 3, 64 * i + b) * m)));
  return m - used.size;
}

/** The lecture's printed answers for n = 5 (L1 §Classical method, the example after formula (4)). */
export const LECTURE_N5 = ['24/625', '48/125', '12/25', '12/125', '1/625'];

// ---------- parameters, stations ----------
const params = [
  { key: 'view', label: 'Show (1 urn counts · 2 hypergeometric law, L1 ex. 8 · 3 balls in boxes, empty boxes)', min: 1, max: 3, step: 1, default: 1 },
  { key: 'scheme', label: 'Scheme (0 ordered with replacement · 1 ordered without · 2 unordered without · 3 unordered with replacement)', min: 0, max: 3, step: 1, default: 3, when: { view: [1] } },
  { key: 'n', label: 'Balls in the urn $n$', min: 1, max: 12, step: 1, default: 3, when: { view: [1] } },
  { key: 'k', label: 'Sample size $k$', min: 0, max: 8, step: 1, default: 2, when: { view: [1] } },
  { key: 'N', label: 'Balls in the urn $n$', min: 2, max: 60, step: 1, default: 10, when: { view: [2] } },
  { key: 'K', label: 'Red balls $k$', min: 0, max: 60, step: 1, default: 4, when: { view: [2] } },
  { key: 'r', label: 'Drawn without replacement $r$', min: 1, max: 60, step: 1, default: 4, when: { view: [2] } },
  { key: 's', label: 'Red in the sample $s$', min: 0, max: 60, step: 1, default: 2, when: { view: [2] } },
  { key: 'balls', label: 'Balls $n$', min: 1, max: 12, step: 1, default: 5, when: { view: [3] } },
  { key: 'boxes', label: 'Boxes $m$', min: 1, max: 12, step: 1, default: 5, when: { view: [3] } },
  { key: 'R', label: 'Simulated repetitions $R$', min: 100, max: 20000, step: 100, default: 2000 },
];
export const meta = { id: 'lecture-combinatorics', lectures: ['L1'], title: 'Urn schemes, the hypergeometric law and balls in boxes', params };
export const stations = { urn: { params } };

const clampInt = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
function normalize(q) {
  const out = {};
  for (const p of params) out[p.key] = clampInt(q[p.key], p.min, p.max, p.default);
  out.K = Math.min(out.K, out.N);
  out.r = Math.min(out.r, out.N);
  out.s = Math.min(out.s, out.r);
  return out;
}

const simNote = (R) => `Simulated frequencies come from ${R} seeded repetitions; bands are $\\pm${BAND_Z}$ standard errors, omitted when $R\\,P(1-P) < ${MIN_SPREAD}$.`;

function runUrn({ scheme, n, k, R }, seed) {
  const N = urnCount(scheme, n, k);
  const listed = N <= BigInt(LIST_UP_TO) && N > 0n;
  const outcomes = listed ? urnOutcomes(scheme, n, k) : [];
  const keyOf = (s) => s.join(',');
  const index = new Map(outcomes.map((s, j) => [keyOf(s), j]));
  const hits = new Array(outcomes.length).fill(0);
  let allEqual = 0;
  if (N > 0n) {
    for (let i = 0; i < R; i++) {
      const s = drawUrn(scheme, n, k, seed, i);
      if (listed) hits[index.get(keyOf(s))]++;
      if (k > 0 && s.every((b) => b === s[0])) allEqual++;
    }
  }
  const exact = outcomes.map((s) => urnOutcomeProbability(scheme, n, k, s));
  const { ordered, repetition } = URN_SCHEMES[scheme];
  // "All k balls show the same number": n of the n^k ordered draws, whatever scheme lists the outcome.
  const pSame = k === 0 ? null : repetition ? ratio(BigInt(n), BigInt(n) ** BigInt(k)) : k === 1 ? 1 : 0;
  const lectureBoxes = identicalBallsInBoxes(n, k);
  const readouts = [
    { key: 'count', label: `Number of samples, ${URN_SCHEMES[scheme].title}`, observed: listed ? outcomes.length : null, theory: N.toString(), unit: 'samples', convention: listed ? 'observed: every sample enumerated and counted' : `more than ${LIST_UP_TO} or none: exact count only` },
    { key: 'cbar', label: 'Combinations with repetition $\\bar{C}_n^{\\,k} = C_{n+k-1}^{\\,k}$ ($k$ balls from $n$, order ignored)', theory: binom(n + k - 1, k).toString(), unit: 'samples', convention: 'formula' },
    { key: 'lectureBoxes', label: 'Lecture ex. 6: $C_{n+k-1}^{\\,k-1}$ counts $n$ identical balls in $k$ boxes', theory: k === 0 ? null : lectureBoxes.toString(), unit: 'placements', convention: 'a different problem: equals $\\bar{C}_n^{\\,k}$ only when $n = k$' },
    { key: 'same', label: 'Probability that all $k$ balls carry the same number, drawn one at a time', theory: r6(pSame), observed: N > 0n && k > 0 ? r6(allEqual / R) : null, band: pSame == null ? null : band(pSame, R), convention: 'exact, sequential draws' },
  ];
  if (ordered === false && repetition) {
    readouts.push({ key: 'sameNaive', label: 'The same event if all $\\bar{C}_n^{\\,k}$ samples were equally likely', theory: k === 0 ? null : r6(Number(n) / Number(binom(n + k - 1, k))), convention: 'wrong model: multisets are not equally likely' });
  }
  const series = listed
    ? [
        { id: 'exact', kind: 'pmf', tone: 'accent', label: 'exact probability of each sample', x: outcomes.map((_, j) => j), y: exact.map(({ p, q }) => r6(ratio(p, q))) },
        { id: 'freq', kind: 'points', tone: 'muted', label: 'simulated frequency', x: outcomes.map((_, j) => j), y: hits.map((h) => r6(h / R)) },
        ...(exact.every(({ p, q }) => band(ratio(p, q), R))
          ? [{ id: 'band', kind: 'band', tone: 'muted', label: `$\\pm${BAND_Z}$ s.e.`, x: outcomes.map((_, j) => j), y: exact.map(({ p, q }) => band(ratio(p, q), R)[0]), y2: exact.map(({ p, q }) => band(ratio(p, q), R)[1]) }]
          : []),
      ]
    : [];
  const notes = [
    ordered ? 'Order matters: (1, 2) and (2, 1) are different samples.' : 'Order is ignored: a sample is the sorted set (or multiset) of numbers.',
    repetition ? 'With replacement: the ball goes back before the next draw.' : 'Without replacement: a ball leaves the urn once drawn.',
    simNote(R),
  ];
  if (ordered === false && repetition) notes.push('Drawn one at a time, a multiset with multiplicities $m_i$ has probability $k!/(m_1!\\cdots m_n!\\,n^k)$: the $\\bar{C}_n^{\\,k}$ samples are counted, not equally likely.');
  return {
    axes: { x: 'sample, in lexicographic order', y: 'probability' },
    readouts, series, notes,
    outcomes: outcomes.map((s, j) => ({ sample: s, exact: fraction(exact[j].p, exact[j].q), observed: hits[j] })),
  };
}

function runHyper({ N, K, r, s, R }, seed) {
  const { p, q } = hypergeometric(N, K, r);
  const freq = new Array(r + 1).fill(0);
  for (let i = 0; i < R; i++) freq[drawRed(N, K, r, seed, i)]++;
  const P = p.map((v) => ratio(v, q));
  const sum = p.reduce((a, b) => a + b, 0n);
  const mean = (r * K) / N;
  const variance = N > 1 ? (r * (K / N) * (1 - K / N) * (N - r)) / (N - 1) : 0;
  const xs = p.map((_, j) => j);
  const bands = P.map((v) => band(v, R));
  const readouts = [
    { key: 'ps', label: `$P(A_{${s}}) = C_{${K}}^{${s}}\\,C_{${N - K}}^{${r - s}} / C_{${N}}^{${r}}$`, theory: r6(P[s]), exact: fraction(p[s], q), observed: r6(freq[s] / R), band: bands[s], convention: 'exact, formula (3)' },
    { key: 'sum', label: '$\\sum_s P(A_s)$', theory: fraction(sum, q), observed: r6(freq.reduce((a, b) => a + b, 0) / R), convention: 'exact: Vandermonde, $\\sum_s C_k^s C_{n-k}^{r-s} = C_n^r$' },
    { key: 'mean', label: 'Mean red count $rk/n$', theory: r6(mean), observed: r6(freq.reduce((a, c, j) => a + c * j, 0) / R), convention: 'exact' },
    { key: 'variance', label: 'Variance $r\\frac{k}{n}(1-\\frac{k}{n})\\frac{n-r}{n-1}$', theory: r6(variance), convention: 'exact' },
  ];
  const series = [
    { id: 'pmf', kind: 'pmf', tone: 'accent', label: 'exact $P(A_s)$', x: xs, y: P.map(r6) },
    { id: 'freq', kind: 'points', tone: 'muted', label: 'simulated frequency', x: xs, y: freq.map((f) => r6(f / R)) },
  ];
  const bx = xs.filter((j) => bands[j]);
  if (bx.length) series.push({ id: 'band', kind: 'band', tone: 'muted', label: `$\\pm${BAND_Z}$ s.e.`, x: bx, y: bx.map((j) => bands[j][0]), y2: bx.map((j) => bands[j][1]) });
  return {
    axes: { x: 'red balls in the sample $s$', y: 'probability' },
    readouts, series,
    notes: [
      `Urn of $n = ${N}$ balls, $k = ${K}$ red; $r = ${r}$ drawn without replacement. $P(A_s) = 0$ outside $\\max(0, r-n+k) \\le s \\le \\min(r, k)$.`,
      simNote(R),
    ],
    pmf: p.map((v) => fraction(v, q)),
  };
}

function runBoxes({ balls, boxes, R }, seed) {
  const { p, q } = emptyBoxes(balls, boxes);
  const freq = new Array(boxes).fill(0);
  for (let i = 0; i < R; i++) freq[drawEmpty(balls, boxes, seed, i)]++;
  const P = p.map((v) => ratio(v, q));
  const xs = p.map((_, e) => e);
  const bands = P.map((v) => band(v, R));
  const readouts = xs.map((e) => ({
    key: `empty${e}`, label: `$P(e = ${e})$, $e$ the number of empty boxes`, theory: r6(P[e]), exact: fraction(p[e], q), observed: r6(freq[e] / R), band: bands[e],
    convention: 'exact: $C_m^e\\,S(n, m-e)\\,(m-e)!/m^n$',
    ...(balls === 5 && boxes === 5 ? { lecture: LECTURE_N5[e] } : {}),
  }));
  readouts.push({ key: 'total', label: 'Placements $m^n$', theory: q.toString(), unit: 'placements', convention: 'each ball picks its box independently' });
  const series = [
    { id: 'pmf', kind: 'pmf', tone: 'accent', label: 'exact $P(e)$', x: xs, y: P.map(r6) },
    { id: 'freq', kind: 'points', tone: 'muted', label: 'simulated frequency', x: xs, y: freq.map((f) => r6(f / R)) },
  ];
  const bx = xs.filter((e) => bands[e]);
  if (bx.length) series.push({ id: 'band', kind: 'band', tone: 'muted', label: `$\\pm${BAND_Z}$ s.e.`, x: bx, y: bx.map((e) => bands[e][0]), y2: bx.map((e) => bands[e][1]) });
  const notes = [
    'Balls and boxes are distinguishable, so all $m^n$ placements are equally likely (L1: a simple random choice).',
    'A placement with $r_i$ balls in box $i$ can happen in $n!/(r_1!\\cdots r_m!)$ ways, the polynomial coefficient of formula (4).',
    simNote(R),
  ];
  if (balls === 5 && boxes === 5) notes.push('The lecture answers for $n = 5$: 24/625, 48/125, 12/25, 12/125, 1/625; all five agree with the exact values.');
  return { axes: { x: 'empty boxes $e$', y: 'probability' }, readouts, series, notes, pmf: p.map((v) => fraction(v, q)) };
}

export function run(q = {}, { seed = 1 } = {}) {
  const v = normalize(q);
  const s = seed >>> 0;
  if (v.view === 2) return runHyper(v, s);
  if (v.view === 3) return runBoxes(v, s);
  return runUrn(v, s);
}
