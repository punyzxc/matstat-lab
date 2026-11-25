// Lecture kernel (#43): event algebra, conditional and total probability, Bayes (L1, L2).
// Contract: docs/research/lecture-module-map.md. No DOM; randomness only from fixtureUint32.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';

/** Predeclared Monte Carlo band: observed frequencies must lie within BAND_Z standard errors. */
export const BAND_Z = 4;
const SUM_TOL = 1e-9;
const u01 = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;
const clip01 = (v) => Math.min(1, Math.max(0, v));
/** Normal-approximation band, clipped to [0, 1]. null when m·p(1−p) < MIN_SPREAD: too few expected outcomes for it to hold. */
export const MIN_SPREAD = 9;
const band = (p, m) => {
  if (!(m > 0) || m * p * (1 - p) < MIN_SPREAD) return null;
  const half = BAND_Z * Math.sqrt((p * (1 - p)) / m);
  return [Math.max(0, p - half), Math.min(1, p + half)];
};
const ratio = (a, b) => (b > 0 ? a / b : null);

// ---------- View 1: events as rectangles in the unit square ----------
/** A = [0,a]×[0,1], B = [s,s+b]∩[0,1] × [0,h], C = [0,1]×[0,c]. Exact areas. */
export function eventGeometry({ a, s, b, h, c }) {
  const bx0 = clip01(s), bx1 = clip01(s + b), bw = Math.max(0, bx1 - bx0);
  const ox = Math.max(0, Math.min(a, bx1) - bx0);
  const P = { A: a, B: bw * h, C: c, AB: ox * h, AC: a * c, BC: bw * Math.min(h, c), ABC: ox * Math.min(h, c) };
  P.AuB = P.A + P.B - P.AB;
  P.AuBuC = P.A + P.B + P.C - P.AB - P.AC - P.BC + P.ABC;
  P.AgB = P.B > 0 ? P.AB / P.B : null;
  P.BgA = P.A > 0 ? P.AB / P.A : null;
  return { P, rect: { A: [0, a, 0, 1], B: [bx0, bx1, 0, h], C: [0, 1, 0, c] } };
}
const inRect = ([x0, x1, y0, y1], x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;

function runEvents(p, seed) {
  const { P, rect } = eventGeometry(p);
  const n = p.n, cnt = { A: 0, B: 0, C: 0, AB: 0, AuB: 0, AuBuC: 0 };
  const cls = { AB: [[], []], A: [[], []], B: [[], []], none: [[], []] };
  for (let i = 0; i < n; i++) {
    const x = u01(seed, 0, i), y = u01(seed, 1, i);
    const A = inRect(rect.A, x, y), B = inRect(rect.B, x, y), C = inRect(rect.C, x, y);
    cnt.A += A; cnt.B += B; cnt.C += C; cnt.AB += A && B; cnt.AuB += A || B; cnt.AuBuC += A || B || C;
    if (i < 1500) { const k = A && B ? 'AB' : A ? 'A' : B ? 'B' : 'none'; cls[k][0].push(x); cls[k][1].push(y); }
  }
  const ro = (key, label, m, theory, denom = n) => ({ key, label, observed: ratio(m, denom), theory, band: theory == null ? null : band(theory, denom), count: m });
  const outline = (id, [x0, x1, y0, y1], label) => ({ id, kind: 'line', tone: 'signal', label, x: [x0, x1, x1, x0, x0], y: [y0, y0, y1, y1, y0] });
  return {
    axes: { x: 'x (unit square)', y: 'y (unit square)' },
    readouts: [
      ro('pA', 'P(A)', cnt.A, P.A), ro('pB', 'P(B)', cnt.B, P.B), ro('pC', 'P(C)', cnt.C, P.C),
      ro('pAB', 'P(AB)', cnt.AB, P.AB), ro('pAuB', '$P(A \\cup B) = P(A) + P(B) - P(AB)$', cnt.AuB, P.AuB),
      ro('pAuBuC', '$P(A \\cup B \\cup C)$, inclusion–exclusion', cnt.AuBuC, P.AuBuC),
      { ...ro('pAgB', 'P(A|B) = P(AB)/P(B)', cnt.AB, P.AgB, cnt.B), band: P.AgB == null ? null : band(P.AgB, n * P.B) },
      { key: 'indep', label: '$P(AB) - P(A)P(B)$ ($0 \\Leftrightarrow$ independent)', observed: cnt.AB / n - (cnt.A / n) * (cnt.B / n), theory: P.AB - P.A * P.B },
    ],
    series: [
      { id: 'none', kind: 'points', tone: 'muted', label: 'outside A and B', x: cls.none[0], y: cls.none[1] },
      { id: 'onlyA', kind: 'points', tone: 'default', label: 'A only', x: cls.A[0], y: cls.A[1] },
      { id: 'onlyB', kind: 'points', tone: 'default', label: 'B only', x: cls.B[0], y: cls.B[1] },
      { id: 'AB', kind: 'points', tone: 'accent', label: 'AB', x: cls.AB[0], y: cls.AB[1] },
      outline('rA', rect.A, 'A'), outline('rB', rect.B, 'B'), outline('rC', rect.C, 'C'),
    ],
    notes: [
      'Addition theorem (L1, corollary 4): $P(A \\cup B) = P(A) + P(B) - P(AB)$.',
      'Conditional probability (L2, formula 6): $P(A \\mid B) = \\dfrac{P(AB)}{P(B)}$; the observed value is $\\#AB / \\#B$ over simulated points.',
      `Bands are $\\pm${BAND_Z}$ standard errors around the exact value (for $P(A \\mid B)$ over the expected count of $B$), clipped to $[0, 1]$; no band is given when the expected spread $m\\,p(1-p)$ is below ${MIN_SPREAD}.`,
      '$A$ and $C$ are independent for any sliders (a vertical and a horizontal strip); $A$ and $B$ are independent only when their overlap equals $a \\cdot |B|$.',
    ],
  };
}

// ---------- Conditional probability as shrinking the world to B (#117) ----------
/** |P(AB) − P(A)P(B)| at or below this counts as independent (the parameters move in steps of 0.01). */
export const INDEP_TOL = 0.002;
/** Points drawn on the square; the counts use all n. */
export const SQUARE_POINTS = 600;
const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));
const dec = (v) => String(Number(v.toPrecision(4)));
/** Log-spaced checkpoints 1 … n (distinct integers), for running frequencies. */
const checkpoints = (n, count = 100) => [...new Set(Array.from({ length: count }, (_, i) => Math.round(Math.exp((Math.log(n) * i) / (count - 1)))))];

export function runConditional(p, seed) {
  const { P, rect } = eventGeometry({ ...p, c: 0 });
  const n = p.n, ns = checkpoints(n);
  let A = 0, B = 0, AB = 0, k = 0;
  const points = [], cls = [], fA = [], fAgB = [], xAgB = [];
  for (let i = 0; i < n; i++) {
    const x = u01(seed, 0, i), y = u01(seed, 1, i);
    const inA = inRect(rect.A, x, y), inB = inRect(rect.B, x, y);
    A += inA; B += inB; AB += inA && inB;
    if (i < SQUARE_POINTS) { points.push([r6(x), r6(y)]); cls.push((inA ? 1 : 0) + (inB ? 2 : 0)); }
    if (i + 1 === ns[k]) {
      fA.push(A / (i + 1));
      if (B > 0) { xAgB.push(Math.log10(i + 1)); fAgB.push(AB / B); }
      k++;
    }
  }
  const gap = Math.round((P.AB - P.A * P.B) * 1e12) / 1e12 + 0;
  const independent = P.B > 0 && P.A > 0 && Math.abs(gap) <= INDEP_TOL;
  const lx = ns.map((v) => Math.log10(v)), ln = Math.log10(n);
  const ro = (key, label, m, theory, denom) => ({ key, label, observed: denom > 0 ? r6(m / denom) : null, theory: r6(theory), band: theory == null ? null : band(theory, denom), count: m });
  const series = [
    { id: 'exactA', kind: 'line', tone: 'muted', label: `$P(A) = ${dec(P.A)}$`, x: [0, ln], y: [P.A, P.A] },
    { id: 'freqA', kind: 'line', tone: 'default', label: 'frequency of $A$', x: lx, y: fA },
  ];
  if (P.AgB != null) series.push(
    { id: 'exactAgB', kind: 'line', tone: 'signal', label: `$P(A \\mid B) = ${dec(P.AgB)}$`, x: [0, ln], y: [P.AgB, P.AgB] },
    { id: 'freqAgB', kind: 'line', tone: 'accent', label: 'share of $A$ among the points of $B$', x: xAgB, y: fAgB },
  );
  const formula = [
    `P(A) = ${dec(P.A)}, \\quad P(B) = ${dec(P.B)}, \\quad P(AB) = ${dec(P.AB)}`,
    P.B > 0 ? `P(A \\mid B) = \\dfrac{P(AB)}{P(B)} = \\dfrac{${dec(P.AB)}}{${dec(P.B)}} = ${dec(P.AgB)}` : 'P(B) = 0 \\Rightarrow P(A \\mid B) \\text{ is not defined}',
    `P(AB) - P(A)\\,P(B) = ${dec(P.AB)} - ${dec(P.A)} \\cdot ${dec(P.B)} = ${dec(gap + 0)}`,
  ];
  const notes = [
    'Conditioning on $B$ (L2): we learn that $B$ happened, so only the outcomes of $B$ remain possible. $B$ becomes the whole world, and $A$ keeps only its part inside $B$: $P(A \\mid B) = \\dfrac{P(AB)}{P(B)}$.',
    `$A$ and $B$ are independent when $P(AB) = P(A)\\,P(B)$, that is, when $P(A \\mid B) = P(A)$: knowing $B$ does not change the chances of $A$. Here it holds when the share of $B$ covered by $A$ equals the width of $A$; the marker shows it within ${INDEP_TOL}.`,
  ];
  if (P.B === 0) notes.unshift('$B$ has zero area: $P(B) = 0$, and conditioning on it is not defined.');
  return {
    axes: { x: '$\\lg n$, points thrown', y: 'frequency' },
    domain: { x: [0, ln], y: [0, 1] },
    readouts: [
      ro('pA', '$P(A)$', A, P.A, n), ro('pB', '$P(B)$', B, P.B, n), ro('pAB', '$P(AB)$', AB, P.AB, n),
      { ...ro('pAgB', '$P(A \\mid B) = \\dfrac{P(AB)}{P(B)}$', AB, P.AgB, B), band: P.AgB == null ? null : band(P.AgB, n * P.B) },
      { key: 'indep', label: '$P(AB) - P(A)\\,P(B)$', observed: r6(AB / n - (A / n) * (B / n)), theory: r6(gap + 0),
        convention: independent ? `equal within ${INDEP_TOL}: $A$ and $B$ are independent` : 'not zero: $A$ and $B$ are dependent' },
    ],
    series,
    formula,
    square: { A: rect.A, B: rect.B, P: { A: P.A, B: P.B, AB: P.AB, AgB: P.AgB }, independent, gap: gap + 0, points, cls,
      keys: { a: p.a, s: p.s, b: p.b, h: p.h }, step: 0.01 },
    notes,
  };
}

// ---------- View 2: Bernstein's tetrahedron and the product-only counterexample ----------
/** Equally likely outcomes, each a set of event labels. Exact integer arithmetic. */
export const MODELS = {
  // Faces: red, green, blue, and one face with all three colours.
  bernstein: [['A'], ['B'], ['C'], ['A', 'B', 'C']],
  // Ω = {1..8}: A = B = {1,2,3,4}, C = {1,5,6,7}. P(ABC) = P(A)P(B)P(C) yet A, B are dependent.
  productOnly: [['A', 'B', 'C'], ['A', 'B'], ['A', 'B'], ['A', 'B'], ['C'], ['C'], ['C'], []],
};
export function independenceCheck(outcomes) {
  const N = outcomes.length, count = (...ev) => outcomes.filter((o) => ev.every((e) => o.includes(e))).length;
  const [a, b, c] = [count('A'), count('B'), count('C')];
  const pairs = { AB: count('A', 'B') * N === a * b, AC: count('A', 'C') * N === a * c, BC: count('B', 'C') * N === b * c };
  const triple = count('A', 'B', 'C') * N * N === a * b * c;
  return { N, counts: { A: a, B: b, C: c, AB: count('A', 'B'), AC: count('A', 'C'), BC: count('B', 'C'), ABC: count('A', 'B', 'C') },
    pairwise: pairs.AB && pairs.AC && pairs.BC, pairs, tripleProduct: triple, mutual: pairs.AB && pairs.AC && pairs.BC && triple };
}

function runBernstein(p, seed) {
  const key = p.model === 2 ? 'productOnly' : 'bernstein', outcomes = MODELS[key], chk = independenceCheck(outcomes), N = chk.N;
  const labels = ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'], hits = Object.fromEntries(labels.map((l) => [l, 0]));
  for (let i = 0; i < p.n; i++) {
    const o = outcomes[Math.floor(u01(seed, 2, i) * N)];
    for (const l of labels) if ([...l].every((e) => o.includes(e))) hits[l]++;
  }
  const exact = (l) => chk.counts[l] / N;
  const product = (l) => [...l].reduce((m, e) => m * exact(e), 1);
  const x = labels.map((_, i) => i + 1);
  return {
    axes: { x: 'event: 1 A, 2 B, 3 C, 4 AB, 5 AC, 6 BC, 7 ABC', y: 'probability' },
    readouts: [
      ...labels.map((l) => ({ key: 'p' + l, label: `$P(${l})$`, observed: hits[l] / p.n, theory: exact(l), band: band(exact(l), p.n), count: hits[l] })),
      { key: 'pairwise', label: 'Pairwise independent (exact)', observed: null, theory: chk.pairwise ? 'yes' : 'no' },
      { key: 'mutual', label: 'Mutually independent (exact)', observed: null, theory: chk.mutual ? 'yes' : 'no' },
    ],
    series: [
      { id: 'exact', kind: 'pmf', tone: 'signal', label: 'exact probability', x, y: labels.map(exact) },
      { id: 'product', kind: 'points', tone: 'muted', label: 'product of single probabilities', x, y: labels.map(product) },
      { id: 'observed', kind: 'points', tone: 'default', label: 'simulated frequency', x, y: labels.map((l) => hits[l] / p.n) },
    ],
    notes: key === 'bernstein'
      ? ['Bernstein: $P(AB) = \\frac14 = P(A)P(B)$ for every pair, but $P(ABC) = \\frac14 \\ne \\frac18$. Pairwise independence does not give mutual independence (L2).']
      : ['Counterexample: $P(ABC) = \\frac18 = P(A)P(B)P(C)$, yet $P(AB) = \\frac12 \\ne \\frac14$. A product over the whole family alone does not define independence in aggregate; every sub-family must factor.'],
  };
}

// ---------- View 3: total probability and Bayes ----------
export function checkHypotheses(priors, likelihoods) {
  if (!Array.isArray(priors) || priors.length < 1 || priors.length !== likelihoods?.length) throw new Error('Give one likelihood for each hypothesis.');
  for (const v of [...priors, ...likelihoods]) if (!(Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Priors and likelihoods must lie in [0, 1].');
  const s = priors.reduce((m, v) => m + v, 0);
  if (Math.abs(s - 1) > SUM_TOL) throw new Error(`The priors sum to ${s.toFixed(4)}, not 1: the hypotheses do not form a complete group.`);
}
export function totalProbability(priors, likelihoods) {
  checkHypotheses(priors, likelihoods);
  return priors.reduce((m, q, k) => m + q * likelihoods[k], 0);
}
export function posteriors(priors, likelihoods) {
  const pA = totalProbability(priors, likelihoods);
  if (!(pA > 0)) throw new Error('P(A) = 0: the posterior is undefined.');
  return priors.map((q, k) => (q * likelihoods[k]) / pA);
}

function runHypotheses(p, seed) {
  const priors = [p.q1, p.q2, p.q3], lik = [p.l1, p.l2, p.l3];
  const pA = totalProbability(priors, lik), post = posteriors(priors, lik);
  const hitsBy = [0, 0, 0];
  let hits = 0;
  for (let i = 0; i < p.n; i++) {
    const u = u01(seed, 3, i);
    const k = u < priors[0] ? 0 : u < priors[0] + priors[1] ? 1 : 2;
    if (u01(seed, 4, i) < lik[k]) { hits++; hitsBy[k]++; }
  }
  const x = [1, 2, 3];
  return {
    axes: { x: 'hypothesis Bk', y: 'probability' },
    readouts: [
      { key: 'pA', label: '$P(A) = \\sum_k P(B_k)\\,P(A \\mid B_k)$', observed: hits / p.n, theory: pA, band: band(pA, p.n), count: hits },
      ...post.map((q, k) => ({ key: `post${k + 1}`, label: `$P(B_{${k + 1}} \\mid A)$, Bayes`, observed: ratio(hitsBy[k], hits), theory: q, band: band(q, p.n * pA), count: hitsBy[k] })),
      { key: 'sum', label: '$\\sum_k P(B_k \\mid A)$', observed: hits > 0 ? hitsBy.reduce((m, h) => m + h / hits, 0) : null, theory: post.reduce((m, v) => m + v, 0) },
    ],
    series: [
      { id: 'prior', kind: 'pmf', tone: 'muted', label: 'prior $P(B_k)$', x: x.map((v) => v - 0.12), y: priors },
      { id: 'posterior', kind: 'pmf', tone: 'signal', label: 'posterior $P(B_k \\mid A)$', x: x.map((v) => v + 0.12), y: post },
      { id: 'observed', kind: 'points', tone: 'default', label: 'share of $A$-outcomes from $B_k$', x: x.map((v) => v + 0.12), y: hitsBy.map((h) => (hits ? h / hits : 0)) },
    ],
    notes: [
      'Total probability (L2, formula 9) and Bayes (L2, formula 10). The kernel requires a complete group: priors summing to 1.',
      'L2 also allows disjoint hypotheses that only cover $A$ ($\\sum_k P(B_k) \\le 1$). Adding the hypothesis "none of them" with $P(A \\mid \\cdot) = 0$ makes a complete group and changes no number.',
    ],
  };
}

// ---------- The living Bayes tree (#118) ----------
/** Particles drawn flowing down the tree; the counts use all n. */
export const TREE_PARTICLES = 90;
const d4 = (v) => String(Number(v.toPrecision(4)));

export function runTree(p, seed) {
  const w = [p.q1, p.q2, p.q3], sw = w.reduce((m, v) => m + v, 0);
  if (!(sw > 0)) throw new Error('At least one prior must be positive.');
  const priors = w.map((v) => v / sw), lik = [p.l1, p.l2, p.l3];
  const joint = priors.map((q, k) => q * lik[k]);
  const pA = joint.reduce((m, v) => m + v, 0);
  const post = pA > 0 ? joint.map((v) => v / pA) : null;
  const H = [0, 0, 0], HA = [0, 0, 0], particles = [];
  for (let i = 0; i < p.n; i++) {
    const u = u01(seed, 5, i);
    const k = u < priors[0] ? 0 : u < priors[0] + priors[1] ? 1 : 2;
    const a = u01(seed, 6, i) < lik[k];
    H[k]++;
    if (a) HA[k]++;
    if (i < TREE_PARTICLES) particles.push([k, a ? 1 : 0]);
  }
  const A = HA.reduce((m, v) => m + v, 0), n = p.n;
  const readouts = [
    { key: 'pA', label: '$P(A) = \\sum_i P(H_i)\\,P(A \\mid H_i)$', observed: r6(A / n), theory: r6(pA), band: band(pA, n), count: A },
    ...priors.map((q, k) => ({ key: `prior${k + 1}`, label: `$P(H_${k + 1})$, share of particles`, observed: r6(H[k] / n), theory: r6(q), band: band(q, n), count: H[k] })),
    ...priors.map((_, k) => ({ key: `post${k + 1}`, label: `$P(H_${k + 1} \\mid A)$, Bayes`, observed: A > 0 ? r6(HA[k] / A) : null, theory: post ? r6(post[k]) : null,
      band: post ? band(post[k], n * pA) : null, count: HA[k] })),
  ];
  const sum = priors.map((q, k) => `${d4(q)} \\cdot ${d4(lik[k])}`).join(' + ');
  const formula = [`P(A) = \\sum_{i=1}^{3} P(H_i)\\,P(A \\mid H_i) = ${sum} = ${d4(pA)}`];
  if (post) formula.push(post.map((q, k) => `P(H_${k + 1} \\mid A) = \\dfrac{${d4(joint[k])}}{${d4(pA)}} = ${d4(q)}`).join(', \\quad '));
  else formula.push('P(A) = 0 \\Rightarrow P(H_k \\mid A) \\text{ is not defined}');
  const notes = [
    'Forward: each particle first picks a hypothesis $H_i$ with probability $P(H_i)$, then $A$ happens with probability $P(A \\mid H_i)$. The width of a branch is the probability of passing along it, so the $A$-ends add up to the total probability $P(A)$.',
    'Inverse: regroup the same particles by the outcome. Among the particles that reached $A$, the share that came through $H_k$ is the posterior $P(H_k \\mid A) = \\dfrac{P(H_k)\\,P(A \\mid H_k)}{P(A)}$: the Bayes formula.',
  ];
  if (Math.abs(sw - 1) > 1e-9) notes.unshift(`The typed priors add up to ${d4(sw)}, not 1, so they are scaled to a complete group: $P(H_i) = q_i / ${d4(sw)}$.`);
  if (!post) notes.unshift('$P(A) = 0$: no particle can reach $A$, and the posteriors are not defined.');
  const x = [1, 2, 3];
  return {
    axes: { x: 'hypothesis $H_i$', y: 'probability' },
    readouts,
    series: [
      { id: 'prior', kind: 'pmf', tone: 'muted', label: 'prior $P(H_i)$', x: x.map((v) => v - 0.12), y: priors },
      ...(post ? [{ id: 'posterior', kind: 'pmf', tone: 'signal', label: 'posterior $P(H_i \\mid A)$', x: x.map((v) => v + 0.12), y: post },
        { id: 'observed', kind: 'points', tone: 'accent', label: 'share of the $A$-particles from $H_i$', x: x.map((v) => v + 0.12), y: HA.map((h) => (A ? h / A : 0)) }] : []),
    ],
    domain: { x: [0.5, 3.5], y: [0, 1] },
    formula,
    tree: { priors, lik, joint, pA, post, H, HA, A, n, particles, keys: ['q1', 'q2', 'q3'] },
    notes,
  };
}

// ---------- View 4: the guessing student ----------
/** P(guessed | correct) when the student knows with probability p and otherwise picks one of m options. */
export const guessingPosterior = (p, m) => posteriors([p, 1 - p], [1, 1 / m])[1];

function runGuessing(p, seed) {
  const { skill, m, n } = p;
  let correct = 0, guessedCorrect = 0;
  for (let i = 0; i < n; i++) {
    const knows = u01(seed, 5, i) < skill;
    const ok = knows || Math.floor(u01(seed, 6, i) * m) === 0;
    if (ok) { correct++; if (!knows) guessedCorrect++; }
  }
  const theory = guessingPosterior(skill, m), pCorrect = skill + (1 - skill) / m;
  const grid = Array.from({ length: 101 }, (_, i) => i / 100);
  const curve = grid.map((q) => (1 - q) / ((m - 1) * q + 1));
  const bands = grid.map((q, i) => band(curve[i], n * (q + (1 - q) / m)) ?? [curve[i], curve[i]]);
  return {
    axes: { x: 'probability p that the student solves the problem', y: 'P(guessed | correct answer)' },
    readouts: [
      { key: 'post', label: '$P(\\text{guessed} \\mid \\text{correct})$', observed: ratio(guessedCorrect, correct), theory, band: band(theory, n * pCorrect), count: guessedCorrect },
      { key: 'pCorrect', label: '$P(\\text{correct answer})$', observed: correct / n, theory: pCorrect, band: band(pCorrect, n), count: correct },
    ],
    series: [
      { id: 'band', kind: 'band', tone: 'muted', label: `$\\pm${BAND_Z}$ s.e. at this $n$`, x: grid, y: bands.map((b) => b[0]), y2: bands.map((b) => b[1]) },
      { id: 'curve', kind: 'line', tone: 'signal', label: `$\\dfrac{1 - p}{(m - 1)p + 1}$; $m = 5$ gives $\\dfrac{1 - p}{4p + 1}$`, x: grid, y: curve },
      { id: 'observed', kind: 'points', tone: 'accent', label: 'simulated', x: [skill], y: [ratio(guessedCorrect, correct) ?? 0] },
    ],
    notes: ['L2 example: five options, one correct. With $m = 5$ the posterior is $\\dfrac{1 - p}{4p + 1}$. In the lecture the letter $A$ names "guessed" in the question but "answered correctly" in the solution; here $A$ = correct answer.'],
  };
}

// ---------- Contract ----------
const P = (key, label, min, max, step, def) => ({ key, label, min, max, step, default: def });
const common = [P('view', 'View: 1 events, 2 independence, 3 Bayes, 4 guessing student', 1, 4, 1, 1), P('n', 'Simulated outcomes $n$', 100, 20000, 100, 4000)];
const groups = {
  events: [P('a', 'Events: width of $A$', 0, 1, 0.01, 0.5), P('s', 'Events: left edge of $B$', 0, 1, 0.01, 0.3), P('b', 'Events: width of $B$', 0, 1, 0.01, 0.5),
    P('h', 'Events: height of $B$', 0, 1, 0.01, 0.6), P('c', 'Events: height of $C$', 0, 1, 0.01, 0.4)],
  independence: [P('model', 'Independence: 1 Bernstein, 2 product-only', 1, 2, 1, 1)],
  bayes: [P('q1', 'Bayes: prior $P(B_1)$', 0, 1, 0.01, 0.5), P('q2', 'Bayes: prior $P(B_2)$', 0, 1, 0.01, 0.3), P('q3', 'Bayes: prior $P(B_3)$', 0, 1, 0.01, 0.2),
    P('l1', 'Bayes: $P(A \\mid B_1)$', 0, 1, 0.01, 0.02), P('l2', 'Bayes: $P(A \\mid B_2)$', 0, 1, 0.01, 0.05), P('l3', 'Bayes: $P(A \\mid B_3)$', 0, 1, 0.01, 0.1)],
  guessing: [P('skill', 'Student: probability $p$ of solving', 0, 1, 0.01, 0.6), P('m', 'Student: number of options $m$', 2, 10, 1, 5)],
};
const all = [...common, ...Object.values(groups).flat()];
const treeParams = [
  P('q1', 'Prior $P(H_1)$', 0, 1, 0.01, 0.5), P('q2', 'Prior $P(H_2)$', 0, 1, 0.01, 0.3), P('q3', 'Prior $P(H_3)$', 0, 1, 0.01, 0.2),
  P('l1', 'Likelihood $P(A \\mid H_1)$', 0, 1, 0.01, 0.2), P('l2', 'Likelihood $P(A \\mid H_2)$', 0, 1, 0.01, 0.5), P('l3', 'Likelihood $P(A \\mid H_3)$', 0, 1, 0.01, 0.9),
  P('n', 'Particles $n$', 100, 20000, 100, 4000),
];
const conditionalParams = [
  P('a', 'Width of $A$', 0, 1, 0.01, 0.5), P('s', 'Left edge of $B$', 0, 1, 0.01, 0.3), P('b', 'Width of $B$', 0, 1, 0.01, 0.5),
  P('h', 'Height of $B$', 0, 1, 0.01, 0.6), P('n', 'Points thrown $n$', 100, 20000, 100, 4000),
];

export const meta = { id: 'lecture-conditional-bayes', lectures: ['L1', 'L2'], title: 'Events, conditional probability and Bayes as counts', params: all };
/** Per-view stations for a host that registers them separately; `bayes` (catalog) gets every view. */
export const stations = {
  bayes: { params: all },
  'bayes-events': { params: [common[1], ...groups.events] },
  'bayes-independence': { params: [common[1], ...groups.independence] },
  'bayes-hypotheses': { params: [common[1], ...groups.bayes] },
  'bayes-guessing': { params: [common[1], ...groups.guessing] },
  conditional: { params: conditionalParams, live: true },
  'bayes-tree': { params: treeParams, live: true },
};
const viewOf = { 'bayes-events': 1, 'bayes-independence': 2, 'bayes-hypotheses': 3, 'bayes-guessing': 4 };

export function run(params, { seed = 1, station = 'bayes' } = {}) {
  if (station === 'bayes-tree') {
    const q = Object.fromEntries(treeParams.map((d) => [d.key, Number.isFinite(params?.[d.key]) ? params[d.key] : d.default]));
    if (!Number.isInteger(q.n) || q.n < 1) throw new Error('n must be a positive integer.');
    return runTree(q, seed);
  }
  if (station === 'conditional') {
    const q = Object.fromEntries(conditionalParams.map((d) => [d.key, Number.isFinite(params?.[d.key]) ? params[d.key] : d.default]));
    if (!Number.isInteger(q.n) || q.n < 1) throw new Error('n must be a positive integer.');
    return runConditional(q, seed);
  }
  const p = Object.fromEntries(all.map((d) => [d.key, Number.isFinite(params?.[d.key]) ? params[d.key] : d.default]));
  if (!Number.isInteger(p.n) || p.n < 1) throw new Error('n must be a positive integer.');
  const view = viewOf[station] ?? p.view;
  if (view === 2) return runBernstein(p, seed);
  if (view === 3) return runHypotheses(p, seed);
  if (view === 4) return runGuessing(p, seed);
  return runEvents(p, seed);
}
