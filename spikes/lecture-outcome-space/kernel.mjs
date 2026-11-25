// L1 outcome space (#129): every elementary outcome is an object; events A and B light up, the operations on events
// (union, product, complement, difference) are recomputed with the classical P = m/n, and repeated trials show the
// frequency of the chosen event settling at its probability. No DOM, no Math.random: same params and seed, same bytes.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';

const NAMESPACE = 0x0e5a;
const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i, NAMESPACE) + 0.5) / 2 ** 32;
const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));

/**
 * The three experiments of L1. Each outcome carries its parts (what is drawn), a number X and a second feature Y:
 * two dice: X = ω₁ + ω₂, Y = ω₁; three coins: X = the number of heads, Y = 1 when the first coin shows heads;
 * a 36-card deck: X = the rank (6 … 10, jack 11, queen 12, king 13, ace 14), Y = the suit (1 ♠, 2 ♣, 3 ♦, 4 ♥).
 */
export function outcomeSpace(experiment) {
  const items = [];
  if (experiment === 1) {
    for (let m = 0; m < 8; m++) {
      const c = [(m >> 2) & 1, (m >> 1) & 1, m & 1].map((b) => 1 - b); // HHH first
      items.push({ parts: c, X: c[0] + c[1] + c[2], Y: c[0] });
    }
    return { kind: 'coins', cols: 4, items, X: 'the number of heads', Y: 'the indicator of heads on the first coin (1 heads, 0 tails)' };
  }
  if (experiment === 2) {
    for (let suit = 1; suit <= 4; suit++) for (let rank = 6; rank <= 14; rank++) items.push({ parts: [rank, suit], X: rank, Y: suit });
    return { kind: 'cards', cols: 9, items, X: 'the rank: 6 … 10, jack 11, queen 12, king 13, ace 14', Y: 'the suit: 1 ♠, 2 ♣, 3 ♦, 4 ♥' };
  }
  for (let u = 1; u <= 6; u++) for (let v = 1; v <= 6; v++) items.push({ parts: [u, v], X: u + v, Y: u });
  return { kind: 'dice', cols: 6, items, X: 'the sum $\\omega_1 + \\omega_2$', Y: 'the first die $\\omega_1$' };
}

const REL = [(v, k) => v >= k, (v, k) => v === k, (v, k) => v <= k];
const REL_TEX = ['\\ge', '=', '\\le'];
export const OPS = ['A', 'B', 'A \\cup B', 'AB', '\\bar{A}', 'A \\setminus B'];
/** Membership of each outcome in the event shown by `op`, from memberships in A and B. */
const OP_FN = [(p) => p, (p, q) => q, (p, q) => p || q, (p, q) => p && q, (p) => !p, (p, q) => p && !q];
export function combine(op, a, b) {
  const f = OP_FN[op] ?? OP_FN[0];
  return a.map((p, i) => f(p, b[i]));
}

const params = [
  { key: 'experiment', label: 'Experiment (0 two dice · 1 three coins · 2 a deck of 36 cards)', min: 0, max: 2, step: 1, default: 0 },
  { key: 'relA', label: 'Event $A$: relation (0 $X \\ge a$ · 1 $X = a$ · 2 $X \\le a$)', min: 0, max: 2, step: 1, default: 0 },
  { key: 'a', label: 'Value $a$ in $A$', min: 0, max: 14, step: 1, default: 9 },
  { key: 'relB', label: 'Event $B$: relation (0 $Y \\ge b$ · 1 $Y = b$ · 2 $Y \\le b$)', min: 0, max: 2, step: 1, default: 1 },
  { key: 'b', label: 'Value $b$ in $B$', min: 0, max: 6, step: 1, default: 6 },
  { key: 'op', label: 'Show (0 event $A$ · 1 event $B$ · 2 union $A \\cup B$ · 3 product $AB$ · 4 complement $\\bar{A}$ · 5 difference $A \\setminus B$)', min: 0, max: 5, step: 1, default: 2 },
  { key: 'n', label: 'Trials $n$', min: 36, max: 20000, step: 1, default: 720 },
];

export const meta = { id: 'lecture-outcome-space', lectures: ['L1'], title: 'Combinatorics, the space of elementary outcomes and operations on events', params };
/** Trials of each draw that flash their outcome. */
export const FLASHES = 24;
const TRACE_POINTS = 240;

const frac = (m, N) => `\\dfrac{${m}}{${N}}`;

export function run(q, { seed, station = 'events' } = {}) {
  const s = (seed ?? 0) >>> 0;
  if (station === 'combinatorics') return runCombinatorics(q, s);
  const { experiment, relA, a, relB, b, op, n } = q;
  const space = outcomeSpace(experiment);
  const N = space.items.length;
  const inA = space.items.map((it) => REL[relA](it.X, a));
  const inB = space.items.map((it) => REL[relB](it.Y, b));
  const inE = combine(op, inA, inB);
  const count = (m) => m.filter(Boolean).length;
  const mA = count(inA), mB = count(inB), mAB = count(inA.map((x, i) => x && inB[i])), mU = count(inA.map((x, i) => x || inB[i])), mE = count(inE);

  const picks = Array.from({ length: n }, (_, i) => Math.min(N - 1, Math.floor(uni(s, 120, i) * N)));
  const hits = (m) => picks.reduce((k, p) => (m[p] ? k + 1 : k), 0) / n;
  // The running frequency of the shown event, sampled at up to 240 trial counts.
  const T = Math.min(n, TRACE_POINTS), at = Array.from({ length: T }, (_, j) => Math.round(((j + 1) * n) / T));
  const run_ = [];
  let k = 0, h = 0;
  for (const t of at) { while (k < t) { if (inE[picks[k]]) h++; k++; } run_.push(r6(h / t)); }
  const PE = mE / N;
  const eTex = OPS[op];
  const series = [
    { id: 'freq', kind: 'line', label: `Frequency of $${eTex}$ after $t$ trials`, x: at, y: run_ },
    { id: 'prob', kind: 'line', tone: 'signal', label: `$P(${eTex}) = ${r6(PE)}$`, x: [at[0], at.at(-1)], y: [r6(PE), r6(PE)] },
  ];
  const aTex = `A = \\{ X ${REL_TEX[relA]} ${a} \\}`, bTex = `B = \\{ Y ${REL_TEX[relB]} ${b} \\}`;
  const formula = [
    `${aTex} \\qquad ${bTex} \\qquad P(${eTex}) = \\dfrac{m}{n} = ${frac(mE, N)} = ${r6(PE)}`,
    `P(A \\cup B) = P(A) + P(B) - P(AB) = ${frac(mA, N)} + ${frac(mB, N)} - ${frac(mAB, N)} = ${frac(mU, N)}`,
  ];
  const readouts = [
    { key: 'event', label: `$P(${eTex})$, the event shown`, observed: r6(hits(inE)), theory: r6(PE), convention: `$m/n = ${mE}/${N}$; observed: the frequency in $n$ trials` },
    { key: 'A', label: '$P(A)$', observed: r6(hits(inA)), theory: r6(mA / N), convention: `$${mA}/${N}$` },
    { key: 'B', label: '$P(B)$', observed: r6(hits(inB)), theory: r6(mB / N), convention: `$${mB}/${N}$` },
    { key: 'AB', label: '$P(AB)$', observed: r6(hits(inA.map((x, i) => x && inB[i]))), theory: r6(mAB / N), convention: `$${mAB}/${N}$` },
    { key: 'union', label: '$P(A \\cup B)$', observed: r6(hits(inA.map((x, i) => x || inB[i]))), theory: r6(mU / N), convention: 'addition theorem: $P(A) + P(B) - P(AB)$' },
    { key: 'independent', label: 'Independence: $P(AB)$ against $P(A)\\,P(B)$', observed: `$${r6(mAB / N)}$`, theory: `$${r6((mA / N) * (mB / N))}$`, convention: mAB * N === mA * mB ? 'equal: $A$ and $B$ are independent' : 'different: $A$ and $B$ are dependent' },
  ];
  const notes = [
    `L1: the outcome space $\\Omega$ has $n = ${N}$ equally likely elementary outcomes. Here $X$ is ${space.X} and $Y$ is ${space.Y}.`,
    'An event is a set of outcomes. The union $A \\cup B$ takes the outcomes of either, the product $AB$ those of both, the complement $\\bar{A}$ the rest of $\\Omega$, and $A \\setminus B$ those of $A$ outside $B$.',
    'The classical definition: $P = \\dfrac{m}{n}$, the number of favourable outcomes over all. The trials are drawn uniformly from $\\Omega$; the frequency of the event settles at its probability as $t$ grows.',
  ];
  if (mE === 0) notes.push('The event shown is impossible here: no outcome satisfies it, so $P = 0$.');
  else if (mE === N) notes.push('The event shown is certain here: every outcome satisfies it, so $P = 1$.');
  return {
    axes: { x: 'trials $t$', y: 'frequency' },
    domain: { y: [0, 1] },
    readouts, series, notes, formula,
    space: { kind: space.kind, cols: space.cols, parts: space.items.map((it) => it.parts), inA, inB, inE, flashes: picks.slice(0, FLASHES), event: eTex, m: mE, n: N },
  };
}

// ---------------------------------------------------------------- Combinatorics generator (L1, #130)

/** The five counting schemes of L1, in the order of the chips. */
export const SCHEMES = [
  { key: 'P', ordered: true, repetition: false },
  { key: 'A', ordered: true, repetition: false },
  { key: 'C', ordered: false, repetition: false },
  { key: 'Abar', ordered: true, repetition: true },
  { key: 'Cbar', ordered: false, repetition: true },
];
/** Up to this many constructions, every one is laid out; above it only the count and a sample. */
export const ENUMERATE_UP_TO = 120;
export const SAMPLED = 12;

const fact = (m) => { let r = 1n; for (let i = 2n; i <= BigInt(m); i++) r *= i; return r; };
const binom = (n, k) => {
  if (k < 0 || k > n) return 0n;
  let r = 1n;
  for (let i = 1n; i <= BigInt(k); i++) r = (r * (BigInt(n) - BigInt(k) + i)) / i;
  return r;
};
/** The exact number of constructions as a BigInt. Permutations ignore k (all n objects are placed). */
export function countOf(scheme, n, k) {
  if (scheme === 0) return fact(n);
  if (scheme === 1) return k > n ? 0n : fact(n) / fact(n - k);
  if (scheme === 2) return binom(n, k);
  if (scheme === 3) return BigInt(n) ** BigInt(k);
  return binom(n + k - 1, k);
}

/** Every construction in lexicographic order (only called when the count is small). */
export function enumerate(scheme, n, k) {
  const { ordered, repetition } = SCHEMES[scheme];
  const size = scheme === 0 ? n : k;
  const out = [];
  const cur = [];
  const used = new Array(n).fill(false);
  const rec = (start) => {
    if (cur.length === size) { out.push([...cur]); return; }
    for (let i = ordered ? 0 : start; i < n; i++) {
      if (!repetition && used[i]) continue;
      used[i] = true; cur.push(i);
      rec(repetition ? i : i + 1);
      cur.pop(); used[i] = false;
    }
  };
  if (size === 0) return [[]];
  rec(0);
  return out;
}

/** One construction drawn uniformly at random from fixture streams (draw j reads indices 64j + t). */
function sampleOne(scheme, n, k, seed, j) {
  const u = (t) => uni(seed, 130, 64 * j + t);
  if (scheme === 3) return Array.from({ length: k }, (_, t) => Math.min(n - 1, Math.floor(u(t) * n)));
  // A uniform k-subset of m items by a partial Fisher–Yates shuffle.
  const subset = (m, size, order) => {
    const a = Array.from({ length: m }, (_, i) => i);
    for (let t = 0; t < size; t++) { const r = t + Math.min(m - t - 1, Math.floor(u(t) * (m - t))); [a[t], a[r]] = [a[r], a[t]]; }
    const pick = a.slice(0, size);
    return order ? pick : pick.sort((p, q) => p - q);
  };
  if (scheme === 0) return subset(n, n, true);
  if (scheme === 1) return subset(n, k, true);
  if (scheme === 2) return subset(n, k, false);
  // Stars and bars: a uniform k-subset of n + k − 1 positions is a uniform multiset of size k from n.
  return subset(n + k - 1, k, false).map((p, t) => p - t);
}

const groupDigits = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');

const combinatoricsParams = [
  { key: 'scheme', label: 'Construction (0 permutations $P_n$ · 1 arrangements $A_n^k$ · 2 combinations $C_n^k$ · 3 arrangements with repetition $\\bar{A}_n^{\\,k}$ · 4 combinations with repetition $\\bar{C}_n^{\\,k}$)', min: 0, max: 4, step: 1, default: 1 },
  { key: 'n', label: 'Objects $n$', min: 1, max: 25, step: 1, default: 4 },
  { key: 'k', label: 'Places $k$ (not for permutations)', min: 0, max: 25, step: 1, default: 2 },
];

function runCombinatorics({ scheme, n, k }, seed) {
  const N = countOf(scheme, n, k);
  const size = scheme === 0 ? n : k;
  const all = N <= BigInt(ENUMERATE_UP_TO);
  const items = all ? enumerate(scheme, n, k) : N === 0n ? [] : Array.from({ length: SAMPLED }, (_, j) => sampleOne(scheme, n, k, seed, j));
  const big = N > BigInt(Number.MAX_SAFE_INTEGER);
  const exact = N.toString();
  const tex = groupDigits(exact);
  const sym = ['P_n', 'A_n^k', 'C_n^k', '\\bar{A}_n^{\\,k}', '\\bar{C}_n^{\\,k}'][scheme];
  const general = [
    `P_{${n}} = ${n}!`,
    k > n ? `A_{${n}}^{${k}} = 0 \\quad (k > n)` : `A_{${n}}^{${k}} = \\dfrac{n!}{(n-k)!} = \\dfrac{${n}!}{${n - k}!}`,
    k > n ? `C_{${n}}^{${k}} = 0 \\quad (k > n)` : `C_{${n}}^{${k}} = \\dfrac{n!}{k!\\,(n-k)!} = \\dfrac{${n}!}{${k}!\\,${n - k}!}`,
    `\\bar{A}_{${n}}^{\\,${k}} = n^k = ${n}^{${k}}`,
    `\\bar{C}_{${n}}^{\\,${k}} = C_{n+k-1}^{\\,k} = C_{${n + k - 1}}^{\\,${k}}`,
  ][scheme];
  const formula = [(scheme === 1 || scheme === 2) && k > n ? general : `${general} = ${tex}`];
  // The count over k = 0 … n (or m = 1 … n for permutations) on a log scale: how fast each scheme grows.
  const ks = scheme === 0 ? Array.from({ length: n }, (_, i) => i + 1) : Array.from({ length: n + 1 }, (_, i) => i);
  const lg = (b) => (b === 0n ? null : r6(Math.log10(Number(b.toString().slice(0, 15))) + Math.max(0, b.toString().length - 15)));
  const row = ks.map((v) => lg(scheme === 0 ? fact(v) : countOf(scheme, n, v)));
  const series = [
    { id: 'row', kind: 'pmf', tone: 'muted', label: scheme === 0 ? '$\\log_{10} m!$ for $m = 1, \\dots, n$' : `$\\log_{10} ${sym}$ for $k = 0, \\dots, n$`, x: ks, y: row.map((v) => v ?? 0) },
    { id: 'here', kind: 'pmf', tone: 'accent', label: 'the construction shown', x: [scheme === 0 ? n : k], y: [lg(N) ?? 0] },
  ];
  const readouts = [
    { key: 'count', label: `Number of constructions $${sym}$`, observed: all ? items.length : null, theory: big ? `$${tex}$` : Number(exact), convention: all ? 'observed: every construction listed and counted' : `more than ${ENUMERATE_UP_TO}: only the exact count and ${SAMPLED} sampled constructions` },
    { key: 'one', label: 'Probability of one construction, $1/N$', theory: N === 0n ? null : big ? `$\\le 10^{-${exact.length - 1}}$` : r6(1 / Number(N)), convention: 'all constructions equally likely' },
  ];
  if (scheme === 1 || scheme === 2) {
    const other = countOf(scheme === 1 ? 2 : 1, n, k);
    readouts.push({ key: 'identity', label: '$A_n^k = C_n^k \\cdot k!$', observed: `$${groupDigits((scheme === 1 ? N : other).toString())}$`, theory: `$${groupDigits(((scheme === 1 ? other : N) * fact(k)).toString())}$`, convention: 'each combination gives $k!$ orders' });
  }
  const notes = [
    SCHEMES[scheme].ordered
      ? 'Order matters: the same objects in another order are another construction, shown in round brackets.'
      : 'Order does not matter: a construction is a set of objects, shown in braces and sorted.',
    SCHEMES[scheme].repetition ? 'With repetition: an object may be taken again (an urn with replacement).' : 'Without repetition: each object is used at most once (an urn without replacement).',
    all ? `All ${items.length} constructions are laid out; change $n$ or $k$ and they rebuild.` : `There are too many to lay out; each draw samples ${SAMPLED} constructions uniformly, and the count is exact.`,
  ];
  if ((scheme === 1 || scheme === 2) && k > n) notes.push('$k > n$: without repetition there are not enough objects, so there is no construction at all.');
  if (scheme !== 0 && k === 0) notes.push('$k = 0$: exactly one construction, the empty one.');
  return {
    axes: { x: scheme === 0 ? 'objects $m$' : 'places $k$', y: '$\\log_{10}$ of the count' },
    readouts, series, notes, formula,
    constructions: { n, size, ordered: SCHEMES[scheme].ordered, repetition: SCHEMES[scheme].repetition, items, all, count: exact },
  };
}

// One kernel, two stations of L1 (declared last: the combinatorics parameters are defined above).
export const stations = { events: { params, live: true }, combinatorics: { params: combinatoricsParams, live: true } };
