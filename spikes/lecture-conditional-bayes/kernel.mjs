// Lecture kernel (#43): event algebra, conditional and total probability, Bayes (L1, L2).
// Contract: docs/research/lecture-module-map.md. No DOM; randomness only from fixtureUint32.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';

/** Predeclared Monte Carlo band: observed frequencies must lie within BAND_Z standard errors. */
export const BAND_Z = 4;
const SUM_TOL = 1e-9;
const u01 = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;
const clip01 = (v) => Math.min(1, Math.max(0, v));
const band = (p, m) => (m > 0 ? [p - BAND_Z * Math.sqrt((p * (1 - p)) / m), p + BAND_Z * Math.sqrt((p * (1 - p)) / m)] : [0, 1]);
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
      ro('pAB', 'P(AB)', cnt.AB, P.AB), ro('pAuB', 'P(A∪B) = P(A)+P(B)−P(AB)', cnt.AuB, P.AuB),
      ro('pAuBuC', 'P(A∪B∪C), inclusion–exclusion', cnt.AuBuC, P.AuBuC),
      { ...ro('pAgB', 'P(A|B) = P(AB)/P(B)', cnt.AB, P.AgB, cnt.B), band: P.AgB == null ? null : band(P.AgB, n * P.B) },
      { key: 'indep', label: 'P(AB) − P(A)P(B) (0 ⇔ independent)', observed: cnt.AB / n - (cnt.A / n) * (cnt.B / n), theory: P.AB - P.A * P.B },
    ],
    series: [
      { id: 'none', kind: 'points', tone: 'muted', label: 'outside A and B', x: cls.none[0], y: cls.none[1] },
      { id: 'onlyA', kind: 'points', tone: 'default', label: 'A only', x: cls.A[0], y: cls.A[1] },
      { id: 'onlyB', kind: 'points', tone: 'default', label: 'B only', x: cls.B[0], y: cls.B[1] },
      { id: 'AB', kind: 'points', tone: 'accent', label: 'AB', x: cls.AB[0], y: cls.AB[1] },
      outline('rA', rect.A, 'A'), outline('rB', rect.B, 'B'), outline('rC', rect.C, 'C'),
    ],
    notes: [
      'Addition theorem (L1, corollary 4): P(A∪B) = P(A) + P(B) − P(AB).',
      'Conditional probability (L2, formula 6): P(A|B) = P(AB)/P(B); observed value is (#AB)/(#B) over simulated points.',
      `Bands are ±${BAND_Z} standard errors around the exact value; for P(A|B) the expected count of B is used.`,
      'A and C are independent for any sliders (a vertical and a horizontal strip); A and B are independent only when their overlap equals a·|B|.',
    ],
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
      ...labels.map((l) => ({ key: 'p' + l, label: `P(${l})`, observed: hits[l] / p.n, theory: exact(l), band: band(exact(l), p.n), count: hits[l] })),
      { key: 'pairwise', label: 'Pairwise independent (exact)', observed: null, theory: chk.pairwise ? 'yes' : 'no' },
      { key: 'mutual', label: 'Mutually independent (exact)', observed: null, theory: chk.mutual ? 'yes' : 'no' },
    ],
    series: [
      { id: 'exact', kind: 'pmf', tone: 'signal', label: 'exact probability', x, y: labels.map(exact) },
      { id: 'product', kind: 'points', tone: 'muted', label: 'product of single probabilities', x, y: labels.map(product) },
      { id: 'observed', kind: 'points', tone: 'default', label: 'simulated frequency', x, y: labels.map((l) => hits[l] / p.n) },
    ],
    notes: key === 'bernstein'
      ? ['Bernstein: P(AB) = 1/4 = P(A)P(B) for every pair, but P(ABC) = 1/4 ≠ 1/8. Pairwise independence does not give mutual independence (L2).']
      : ['Counterexample: P(ABC) = 1/8 = P(A)P(B)P(C), yet P(AB) = 1/2 ≠ 1/4. A product over the whole family alone does not define independence in aggregate; every sub-family must factor.'],
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
      { key: 'pA', label: 'P(A) = Σ P(Bk)P(A|Bk)', observed: hits / p.n, theory: pA, band: band(pA, p.n), count: hits },
      ...post.map((q, k) => ({ key: `post${k + 1}`, label: `P(B${k + 1}|A), Bayes`, observed: ratio(hitsBy[k], hits), theory: q, band: band(q, p.n * pA), count: hitsBy[k] })),
      { key: 'sum', label: 'Σ P(Bk|A)', observed: hits > 0 ? 1 : null, theory: post.reduce((m, v) => m + v, 0) },
    ],
    series: [
      { id: 'prior', kind: 'pmf', tone: 'muted', label: 'prior P(Bk)', x: x.map((v) => v - 0.12), y: priors },
      { id: 'posterior', kind: 'pmf', tone: 'signal', label: 'posterior P(Bk|A)', x: x.map((v) => v + 0.12), y: post },
      { id: 'observed', kind: 'points', tone: 'default', label: 'share of A-outcomes from Bk', x: x.map((v) => v + 0.12), y: hitsBy.map((h) => (hits ? h / hits : 0)) },
    ],
    notes: [
      'Total probability (L2, formula 9) and Bayes (L2, formula 10). The kernel requires a complete group: priors summing to 1.',
      'L2 also allows disjoint hypotheses that only cover A (Σ P(Bk) ≤ 1). Adding the hypothesis "none of them" with P(A|·) = 0 makes a complete group and changes no number.',
    ],
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
  const bands = grid.map((q, i) => band(curve[i], n * (q + (1 - q) / m)));
  return {
    axes: { x: 'probability p that the student solves the problem', y: 'P(guessed | correct answer)' },
    readouts: [
      { key: 'post', label: 'P(guessed | correct)', observed: ratio(guessedCorrect, correct), theory, band: band(theory, n * pCorrect), count: guessedCorrect },
      { key: 'pCorrect', label: 'P(correct answer)', observed: correct / n, theory: pCorrect, band: band(pCorrect, n), count: correct },
    ],
    series: [
      { id: 'band', kind: 'band', tone: 'muted', label: `±${BAND_Z} s.e. at this n`, x: grid, y: bands.map((b) => b[0]), y2: bands.map((b) => b[1]) },
      { id: 'curve', kind: 'line', tone: 'signal', label: `(1 − p)/((m − 1)p + 1); m = 5 gives (1 − p)/(4p + 1)`, x: grid, y: curve },
      { id: 'observed', kind: 'points', tone: 'accent', label: 'simulated', x: [skill], y: [ratio(guessedCorrect, correct) ?? 0] },
    ],
    notes: ['L2 example: five options, one correct. With m = 5 the posterior is (1 − p)/(4p + 1). In the lecture the letter A names "guessed" in the question but "answered correctly" in the solution; here A = correct answer.'],
  };
}

// ---------- Contract ----------
const P = (key, label, min, max, step, def) => ({ key, label, min, max, step, default: def });
const common = [P('view', 'View: 1 events, 2 independence, 3 Bayes, 4 guessing student', 1, 4, 1, 1), P('n', 'Simulated outcomes n', 100, 20000, 100, 4000)];
const groups = {
  events: [P('a', 'Events: width of A', 0, 1, 0.01, 0.5), P('s', 'Events: left edge of B', 0, 1, 0.01, 0.3), P('b', 'Events: width of B', 0, 1, 0.01, 0.5),
    P('h', 'Events: height of B', 0, 1, 0.01, 0.6), P('c', 'Events: height of C', 0, 1, 0.01, 0.4)],
  independence: [P('model', 'Independence: 1 Bernstein, 2 product-only', 1, 2, 1, 1)],
  bayes: [P('q1', 'Bayes: prior P(B1)', 0, 1, 0.01, 0.5), P('q2', 'Bayes: prior P(B2)', 0, 1, 0.01, 0.3), P('q3', 'Bayes: prior P(B3)', 0, 1, 0.01, 0.2),
    P('l1', 'Bayes: P(A|B1)', 0, 1, 0.01, 0.02), P('l2', 'Bayes: P(A|B2)', 0, 1, 0.01, 0.05), P('l3', 'Bayes: P(A|B3)', 0, 1, 0.01, 0.1)],
  guessing: [P('skill', 'Student: probability p of solving', 0, 1, 0.01, 0.6), P('m', 'Student: number of options m', 2, 10, 1, 5)],
};
const all = [...common, ...Object.values(groups).flat()];

export const meta = { id: 'lecture-conditional-bayes', lectures: ['L1', 'L2'], title: 'Events, conditional probability and Bayes as counts', params: all };
/** Per-view stations for a host that registers them separately; `bayes` (catalog) gets every view. */
export const stations = {
  bayes: { params: all },
  'bayes-events': { params: [common[1], ...groups.events] },
  'bayes-independence': { params: [common[1], ...groups.independence] },
  'bayes-hypotheses': { params: [common[1], ...groups.bayes] },
  'bayes-guessing': { params: [common[1], ...groups.guessing] },
};
const viewOf = { 'bayes-events': 1, 'bayes-independence': 2, 'bayes-hypotheses': 3, 'bayes-guessing': 4 };

export function run(params, { seed = 1, station = 'bayes' } = {}) {
  const p = Object.fromEntries(all.map((d) => [d.key, Number.isFinite(params?.[d.key]) ? params[d.key] : d.default]));
  if (!Number.isInteger(p.n) || p.n < 1) throw new Error('n must be a positive integer.');
  const view = viewOf[station] ?? p.view;
  if (view === 2) return runBernstein(p, seed);
  if (view === 3) return runHypotheses(p, seed);
  if (view === 4) return runGuessing(p, seed);
  return runEvents(p, seed);
}
